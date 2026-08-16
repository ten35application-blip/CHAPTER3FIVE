import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { PRICING } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  recordAudit,
  sendAccountRestoredEmail,
} from "@/lib/notifications";
import { scheduleAutoPopulate } from "@/lib/subscription/autoPopulate";
import type Stripe from "stripe";
import { recordGrantFailure } from "@/lib/billing/grantFailure";

export const runtime = "nodejs";

// Subscribe-time auto-populate runs inside after() and can chain
// synth (~30s each × up to 4) + face generation off the same
// invocation. Give the webhook the same 300s headroom as
// /api/identity/new so the background chain has room to finish.
export const maxDuration = 300;

/**
 * Stripe webhook receiver.
 *
 * Handles:
 *   checkout.session.completed        → mark payment paid + grant credit
 *                                        (incl. add-on packs → message/
 *                                        image_credits; inherit-slot
 *                                        purchases → inherited_slot_credits;
 *                                        other-mode legacy mints →
 *                                        other_identity_credits)
 *                                        OR (subscription
 *                                        mode) bind customer/subscription
 *                                        + paid window + subscription_tier
 *   charge.refunded                   → mark refunded + revert credit
 *   invoice.paid                      → renewal — extend pro_until forward
 *   invoice.payment_failed            → note it, don't revoke (Stripe smart
 *                                        retries take multiple days)
 *   customer.subscription.updated     → sync cancel_at_period_end + status
 *   customer.subscription.deleted     → let pro_until expire naturally at
 *                                        current_period_end; clear the sub id
 *
 * Idempotency: every event id is recorded in `stripe_events`. If the same
 * id arrives twice (Stripe retry, replay, our 5xx + Stripe re-fire), we
 * short-circuit before mutating state. Credits are granted via an atomic
 * SQL function so concurrent processing can't double-count.
 */
export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const admin = createAdminClient();

  // Dedupe: have we already processed this event id?
  const { data: existing } = await admin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ received: true, deduped: event.id });
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event, admin);
  } else if (event.type === "charge.refunded") {
    await handleChargeRefunded(event, admin);
  } else if (event.type === "charge.dispute.closed") {
    // A dispute CAN close in the merchant's favor — status='won' means
    // the merchant kept the money and the customer's dispute failed.
    // Only status='lost' should trigger a credit revert. Fable payment
    // audit 2026-07-28: pre-fix, ANY close treated as a refund, which
    // would incorrectly claw back credits the customer legitimately
    // paid for. Statuses that neither win nor lose (needs_response,
    // warning_*, etc.) are also ignored — only a final 'lost' revert.
    const dispute = event.data.object as { status?: string };
    if (dispute.status === "lost") {
      await handleChargeRefunded(event, admin);
    }
  } else if (event.type === "invoice.paid") {
    await handleInvoicePaid(event, admin);
  } else if (event.type === "invoice.payment_failed") {
    await handleInvoicePaymentFailed(event, admin);
  } else if (event.type === "customer.subscription.updated") {
    await handleSubscriptionUpdated(event, admin);
  } else if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(event, admin);
  } else {
    // Unhandled event types: still record so we don't reprocess if Stripe
    // re-fires, but no state change.
    await recordEvent(event, admin, null);
    return NextResponse.json({ received: true, ignored: event.type });
  }

  return NextResponse.json({ received: true });
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function recordEvent(
  event: Stripe.Event,
  admin: AdminClient,
  userId: string | null,
) {
  await admin.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    user_id: userId,
    payload: event.data.object,
  });
}

async function handleCheckoutCompleted(
  event: Stripe.Event,
  admin: AdminClient,
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.user_id ?? null;
  const purpose = session.metadata?.purpose;
  if (
    !userId ||
    (purpose !== "randomize" &&
      purpose !== "oracle" &&
      purpose !== "beneficiary_slot" &&
      purpose !== "restore_account" &&
      purpose !== "restore_oracle" &&
      purpose !== "pro_monthly" &&
      purpose !== "basic_monthly" &&
      purpose !== "pack_small" &&
      purpose !== "pack_medium" &&
      purpose !== "pack_large" &&
      purpose !== "inherited_slot_purchase" &&
      purpose !== "other_identity_create")
  ) {
    await recordEvent(event, admin, userId);
    return;
  }

  // Subscription bootstrap: bind the customer + subscription to the
  // profile so future portal sessions + invoice.paid renewals can
  // reverse-lookup. pro_until is set here from current_period_end;
  // invoice.paid extends it on each renewal. subscription_tier is
  // written from the purchased tier so getPlanTier can split Basic
  // from Pro.
  if (purpose === "pro_monthly" || purpose === "basic_monthly") {
    await handleSubscriptionCheckout(
      event,
      session,
      admin,
      userId,
      purpose === "basic_monthly" ? "basic" : "pro",
    );
    return;
  }

  // Mark payment paid + tag with this event id so a future refund can find it.
  // Only updates if still pending — re-fires won't double-mark.
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  // Claim the pending row. If 0 rows come back, another webhook delivery
  // already processed this — short-circuit before re-granting credit.
  // (Belt and suspenders on top of the stripe_events dedup, which can race
  // if a re-fire arrives before the previous run finished recordEvent().)
  const { data: claimed } = await admin
    .from("payments")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      stripe_event_id: event.id,
      paid_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending")
    .select("id");

  if (!claimed || claimed.length === 0) {
    await recordEvent(event, admin, userId);
    return;
  }

  // Restore flows don't grant credits — they reverse a soft-delete.
  if (purpose === "restore_account") {
    // Take the account's delete stamp BEFORE clearing it. The web
    // delete action (settings/delete/actions.ts) cascades that exact
    // timestamp onto every one of the user's oracles so the dashboard
    // looks empty during signout — the user never deleted those
    // identities individually. Restoring the profile alone leaves them
    // soft-deleted, and once 0136 gives soft-deleted rows a purge date
    // that means a restored account loses every identity 30 days
    // later. Clearing the countdown on exactly the rows that went down
    // with the account keeps them in Trash (still $5 each to restore,
    // unchanged) without putting them on a timer.
    //
    // Matched on the shared stamp, so an identity the user genuinely
    // deleted on its own keeps its own countdown.
    const { data: deletedProfile, error: stampErr } = await admin
      .from("profiles")
      .select("deleted_at")
      .eq("id", userId)
      .maybeSingle<{ deleted_at: string | null }>();

    if (stampErr) {
      // The READ failing is as damaging as the write failing — without
      // the stamp we skip the clear entirely and the identities stay on
      // their countdown, silently. Same unretryable posture, so it gets
      // the same visible record.
      await recordGrantFailure({
        kind: "restore_account_oracle_purge_dates",
        userId,
        stripeEventId: event.id,
        stripeSessionId: session.id,
        purpose,
        error: stampErr,
      });
    }

    if (deletedProfile?.deleted_at) {
      const { error: cascadeErr } = await admin
        .from("oracles")
        .update({ scheduled_purge_at: null })
        .eq("user_id", userId)
        .eq("deleted_at", deletedProfile.deleted_at);
      if (cascadeErr) {
        // A log line is not a signal — same reasoning as 0133. This one
        // is unrecoverable by retry: the payments row was already
        // claimed paid further up, so a Stripe re-delivery
        // short-circuits before ever reaching this branch. Left as a
        // console.error, one transient DB blip here costs a customer
        // who PAID to restore their account every identity in it, 30
        // days later, silently. It goes in grant_failures so a person
        // sees it while the 30 days are still running.
        await recordGrantFailure({
          kind: "restore_account_oracle_purge_dates",
          userId,
          stripeEventId: event.id,
          stripeSessionId: session.id,
          purpose,
          error: cascadeErr,
        });
      }
    }

    await admin
      .from("profiles")
      .update({ deleted_at: null, scheduled_purge_at: null })
      .eq("id", userId);

    // Tell them they're back.
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    if (authUser?.user?.email) {
      sendAccountRestoredEmail({
        to: authUser.user.email,
        userId,
      }).catch((e) => console.error("restored email failed:", e));
    }

    await recordAudit({
      actorUserId: userId,
      actorEmail: authUser?.user?.email ?? null,
      action: "account_restored",
      targetUserId: userId,
    });
    await recordEvent(event, admin, userId);
    return;
  }

  if (purpose === "restore_oracle") {
    const oracleId = session.metadata?.oracle_id;
    if (oracleId) {
      // Same unretryable posture as restore_account above: the payments
      // row is already claimed paid, so a Stripe re-delivery
      // short-circuits before reaching this branch. If the un-delete
      // fails, the customer paid $5 and the identity keeps counting down
      // to permanent purge — that must land in front of a person while
      // the countdown is still running, not in a log line.
      const { data: restored, error: restoreErr } = await admin
        .from("oracles")
        .update({ deleted_at: null, scheduled_purge_at: null })
        .eq("id", oracleId)
        .eq("user_id", userId)
        .select("id");
      if (restoreErr || !restored || restored.length === 0) {
        await recordGrantFailure({
          kind: "restore_oracle",
          userId,
          stripeEventId: event.id,
          stripeSessionId: session.id,
          purpose,
          error:
            restoreErr ??
            `un-delete matched 0 rows for oracle ${oracleId} (wrong owner, or already purged)`,
        });
      } else {
        // Re-attach as the active oracle so the user lands back in the
        // chat on next dashboard load. Best-effort — the restore itself
        // already stuck, so a miss here costs a click, not the identity.
        await admin
          .from("profiles")
          .update({ active_oracle_id: oracleId, onboarding_completed: true })
          .eq("id", userId);

        await recordAudit({
          actorUserId: userId,
          action: "oracle_restored",
          targetUserId: userId,
          targetId: oracleId,
        });
      }
    } else {
      // Money arrived for a restore with no target. Unresolvable
      // automatically; a person has to match the session to the trash.
      await recordGrantFailure({
        kind: "restore_oracle",
        userId,
        stripeEventId: event.id,
        stripeSessionId: session.id,
        purpose,
        error: "session metadata carried no oracle_id",
      });
    }
    await recordEvent(event, admin, userId);
    return;
  }

  // Add-on packs: one-time top-ups that credit message_credits or
  // image_credits by the pack's size. The type (messages vs images)
  // was the buyer's pick at checkout and rides in metadata.
  //
  // Idempotency is two layers deep: the stripe_events dedupe at the
  // top of POST, plus the pending→paid payments claim above — if the
  // claim returned 0 rows we already short-circuited, so a duplicate
  // delivery of this event id can never double-credit.
  if (
    purpose === "pack_small" ||
    purpose === "pack_medium" ||
    purpose === "pack_large"
  ) {
    // Every pack credits BOTH counters -- Wilson's product spec
    // 2026-07-28: "you get both that many messages and photos, its
    // not separate." A $5 pack grants 100 messages AND 12 photos, a
    // $10 pack grants 250 messages AND 30 photos, and so on. The old
    // pack_type metadata is ignored now; it may still ride along from
    // in-flight sessions -- doing nothing with it is fine.
    const packKind = session.metadata?.pack_kind;
    const grants =
      packKind === "small"
        ? {
            messages: PRICING.packSmallMessages,
            images: PRICING.packSmallImages,
          }
        : packKind === "medium"
          ? {
              messages: PRICING.packMediumMessages,
              images: PRICING.packMediumImages,
            }
          : packKind === "large"
            ? {
                messages: PRICING.packLargeMessages,
                images: PRICING.packLargeImages,
              }
            : null;

    if (grants) {
      const { error: msgErr } = await admin.rpc(
        "increment_profile_counter",
        {
          target_user_id: userId,
          counter_name: "message_credits",
          delta: grants.messages,
        },
      );
      if (msgErr) {
        // The user PAID and the grant failed. Stripe WILL retry the
        // event, but the payments row is already claimed paid, so the
        // retry short-circuits by design — there is no automatic
        // recovery here. This used to be a console.error and nothing
        // else, which meant the only record of an under-delivery was a
        // log line nobody reads. Now it lands in grant_failures with
        // everything needed to re-grant by hand (0133).
        await recordGrantFailure({
          kind: "message_credits",
          userId,
          stripeEventId: event.id,
          stripeSessionId: session.id,
          delta: grants.messages,
          purpose,
          error: msgErr,
        });
      }
      const { error: imgErr } = await admin.rpc(
        "increment_profile_counter",
        {
          target_user_id: userId,
          counter_name: "image_credits",
          delta: grants.images,
        },
      );
      if (imgErr) {
        await recordGrantFailure({
          kind: "image_credits",
          userId,
          stripeEventId: event.id,
          stripeSessionId: session.id,
          delta: grants.images,
          purpose,
          error: imgErr,
        });
      }
    } else {
      // Worst case of the set: the money arrived and we cannot map it
      // to anything, so we know they paid and not what for. Recorded
      // with the raw pack_kind so it is still resolvable by hand.
      await recordGrantFailure({
        kind: "unrecognized_purchase",
        userId,
        stripeEventId: event.id,
        stripeSessionId: session.id,
        purpose,
        error: `unrecognized pack_kind: ${session.metadata?.pack_kind ?? "(none)"}`,
      });
    }

    await recordEvent(event, admin, userId);
    return;
  }

  // Inherit-slot purchase: one-time $5 credit toward redeeming one
  // inherit code (mode=payment; purchase_kind rides in metadata from
  // the checkout route). Same two-layer idempotency as the packs:
  // stripe_events dedupe + the pending→paid payments claim above.
  if (purpose === "inherited_slot_purchase") {
    if (
      session.mode === "payment" &&
      session.metadata?.purchase_kind === "inherited_slot"
    ) {
      const { error: grantErr } = await admin.rpc(
        "increment_profile_counter",
        {
          target_user_id: userId,
          counter_name: "inherited_slot_credits",
          delta: 1,
        },
      );
      if (grantErr) {
        // THIS IS THE ONE THAT MATTERS MOST. Someone paid $5 to open
        // the archive of a person who died. If this grant fails they
        // are charged, the archive stays shut, and — before 0133 —
        // the only record was a log line. The payments row is already
        // claimed paid so a Stripe retry short-circuits; there is no
        // automatic recovery. It has to be visible to a person.
        await recordGrantFailure({
          kind: "inherited_slot",
          userId,
          stripeEventId: event.id,
          stripeSessionId: session.id,
          delta: 1,
          purpose,
          error: grantErr,
        });
      }
    } else {
      await recordGrantFailure({
        kind: "inherited_slot",
        userId,
        stripeEventId: event.id,
        stripeSessionId: session.id,
        delta: 1,
        purpose,
        error: `unexpected mode/metadata: mode=${session.mode} purchase_kind=${session.metadata?.purchase_kind ?? "(none)"}`,
      });
    }

    await recordEvent(event, admin, userId);
    return;
  }

  // Other-mode legacy-mint purchase: one-time $5 credit toward
  // completing one other-mode legacy identity (mode=payment;
  // purchase_kind rides in metadata from the checkout route). Same
  // two-layer idempotency as the packs: stripe_events dedupe + the
  // pending→paid payments claim above.
  if (purpose === "other_identity_create") {
    if (
      session.mode === "payment" &&
      session.metadata?.purchase_kind === "other_identity_create"
    ) {
      const { error: grantErr } = await admin.rpc(
        "increment_profile_counter",
        {
          target_user_id: userId,
          counter_name: "other_identity_credits",
          delta: 1,
        },
      );
      if (grantErr) {
        await recordGrantFailure({
          kind: "other_identity_create",
          userId,
          stripeEventId: event.id,
          stripeSessionId: session.id,
          delta: 1,
          purpose,
          error: grantErr,
        });
      }
    } else {
      await recordGrantFailure({
        kind: "other_identity_create",
        userId,
        stripeEventId: event.id,
        stripeSessionId: session.id,
        delta: 1,
        purpose,
        error: `unexpected mode/metadata: mode=${session.mode} purchase_kind=${session.metadata?.purchase_kind ?? "(none)"}`,
      });
    }

    await recordEvent(event, admin, userId);
    return;
  }

  // Credit-grant purposes. Same paid-but-not-granted exposure as the
  // packs above — this bare-await branch was the last one without a
  // failure record.
  const column =
    purpose === "oracle"
      ? "extra_oracle_credits"
      : purpose === "beneficiary_slot"
        ? "paid_beneficiary_slots"
        : "randomize_credits";

  const { error: counterErr } = await admin.rpc("increment_profile_counter", {
    target_user_id: userId,
    counter_name: column,
    delta: 1,
  });
  if (counterErr) {
    await recordGrantFailure({
      kind: "profile_counter_credit",
      userId,
      stripeEventId: event.id,
      stripeSessionId: session.id,
      delta: 1,
      purpose,
      error: counterErr,
    });
  }

  await recordEvent(event, admin, userId);
}

async function handleSubscriptionCheckout(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  admin: AdminClient,
  userId: string,
  tier: "basic" | "pro",
) {
  const customerId =
    typeof session.customer === "string" ? session.customer : null;
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : null;
  if (!customerId || !subscriptionId) {
    await recordEvent(event, admin, userId);
    return;
  }

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const periodEnd = subPeriodEndIso(sub);

  // Claim the pending payment row for this session, same shape as
  // one-shot purchases so /admin/revenue reconciles cleanly.
  await admin
    .from("payments")
    .update({
      status: "paid",
      stripe_event_id: event.id,
      paid_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending");

  // Belt: prefer the tier derived from the subscription's actual
  // Price ID when it matches a configured env — the metadata purpose
  // is the fallback. Guards against a stale client POSTing one
  // purpose while checkout was created against the other Price.
  const priceTier = tierFromPriceId(sub);

  const resolvedTier: "basic" | "pro" = priceTier ?? tier;

  // This write is the only thing that ties the Stripe subscription to
  // the profile. If it fails, the damage compounds: no tier today, AND
  // every future invoice.paid / subscription.updated / .deleted event
  // reverse-looks-up the profile by stripe_subscription_id — which was
  // never written — so each one no-ops. The card is charged monthly
  // forever while the account stays Free, and no later event self-heals
  // it. That must reach a person, not a log.
  const { error: bindErr } = await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      subscription_status: sub.status,
      plan_source: "stripe",
      pro_until: periodEnd,
      subscription_tier: resolvedTier,
    })
    .eq("id", userId);
  if (bindErr) {
    await recordGrantFailure({
      kind: "subscription_bind",
      userId,
      stripeEventId: event.id,
      stripeSessionId: session.id,
      purpose: `${resolvedTier}_monthly sub=${subscriptionId}`,
      error: bindErr,
    });
  }

  await recordEvent(event, admin, userId);

  // Phase 3: fill their circle so it isn't empty on first
  // post-payment open. Runs as background work via after(); the
  // helper is idempotent (existing-count top-up) and concurrent-
  // safe (per-user lock in migration 0126) so a Stripe retry
  // that gets past the stripe_events dedupe still never
  // double-populates.
  scheduleAutoPopulate(userId, resolvedTier);
}

/**
 * Map a subscription's Price ID to our tier by matching the
 * configured price envs. Returns null when the price matches
 * neither (unconfigured env, test subscription, unknown SKU) so
 * callers can fall back rather than clobbering a known tier.
 */
function tierFromPriceId(sub: Stripe.Subscription): "basic" | "pro" | null {
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_BASIC_MONTHLY) return "basic";
  if (priceId === process.env.STRIPE_PRICE_ID_PRO_MONTHLY) return "pro";
  return null;
}

async function handleInvoicePaid(event: Stripe.Event, admin: AdminClient) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    await recordEvent(event, admin, null);
    return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle<{ id: string }>();
  if (!profile) {
    // Renewal for a subscription we don't track — likely a manual test
    // subscription or a legacy row. Record and move on.
    await recordEvent(event, admin, null);
    return;
  }

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const periodEnd = subPeriodEndIso(sub);

  // If extending pro_until fails, the subscriber PAID for this month and
  // lapses to Free when the old period end passes. Self-heals only at
  // next month's invoice — a person should re-sync it before then.
  const { error: renewErr } = await admin
    .from("profiles")
    .update({
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      subscription_status: sub.status,
      pro_until: periodEnd,
    })
    .eq("id", profile.id);
  if (renewErr) {
    await recordGrantFailure({
      kind: "subscription_renewal_sync",
      userId: profile.id,
      stripeEventId: event.id,
      purpose: `invoice.paid sub=${subscriptionId} period_end=${periodEnd}`,
      error: renewErr,
    });
  }

  // Renewal ledger row — one per invoice.paid so /admin/revenue MRR
  // math has something to sum. The initial checkout also writes a
  // paid row via handleProMonthlyCheckout; skip on the first invoice
  // (billing_reason='subscription_create') so we don't double-book.
  // Idempotency: 0085 adds a partial unique index on
  // payments.stripe_event_id so a concurrent duplicate delivery of
  // the same invoice.paid collides on 23505 and the losing insert
  // becomes a no-op. amount_cents mirrors invoice.amount_paid so
  // coupon-discounted renewals ledger the true charged amount rather
  // than the sticker price.
  if (invoice.billing_reason !== "subscription_create") {
    const { error: ledgerErr } = await admin.from("payments").insert({
      user_id: profile.id,
      stripe_payment_intent_id: invoicePaymentIntentId(invoice),
      amount_cents: invoice.amount_paid ?? 0,
      currency: invoice.currency ?? "usd",
      purpose: "pro_monthly_renewal",
      status: "paid",
      stripe_event_id: event.id,
      paid_at: new Date().toISOString(),
    });
    if (ledgerErr && ledgerErr.code !== "23505") {
      console.error(
        "[stripe/webhook] renewal ledger insert failed:",
        ledgerErr,
      );
    }
  }

  await recordEvent(event, admin, profile.id);
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  admin: AdminClient,
) {
  const invoice = event.data.object as Stripe.Invoice;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    await recordEvent(event, admin, null);
    return;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle<{ id: string }>();
  if (!profile) {
    await recordEvent(event, admin, null);
    return;
  }

  // We DO NOT revoke pro_until here. Stripe smart retries run for
  // ~3 weeks; revoking on the first failed payment would flap Pro
  // access on transient card issues. Instead we just sync status
  // and let the eventual customer.subscription.deleted (if the card
  // ultimately fails) drive the lapse.
  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  await admin
    .from("profiles")
    .update({
      subscription_status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end,
    })
    .eq("id", profile.id);

  await recordEvent(event, admin, profile.id);
}

async function handleSubscriptionUpdated(
  event: Stripe.Event,
  admin: AdminClient,
) {
  const sub = event.data.object as Stripe.Subscription;
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle<{ id: string }>();
  if (!profile) {
    await recordEvent(event, admin, null);
    return;
  }

  // Tier sync: a plan change through the billing portal (Basic ⇄ Pro)
  // arrives as subscription.updated with the new Price. Only write
  // when the Price maps to a configured env — an unknown Price never
  // clobbers a known tier.
  const updatedTier = tierFromPriceId(sub);
  await admin
    .from("profiles")
    .update({
      current_period_end: subPeriodEndIso(sub),
      cancel_at_period_end: sub.cancel_at_period_end,
      subscription_status: sub.status,
      ...(updatedTier ? { subscription_tier: updatedTier } : {}),
    })
    .eq("id", profile.id);

  await recordEvent(event, admin, profile.id);

  // Phase 3: a Basic → Pro upgrade via the billing portal fires
  // here (subscription.updated with the new Price). Re-run the
  // populate so a Basic user who upgrades to Pro gets the extra
  // random slots topped up. Idempotent — a Pro → Pro no-op update
  // (metadata change, etc.) sees the quota already filled and
  // exits without creating anything.
  if (updatedTier === "basic" || updatedTier === "pro") {
    scheduleAutoPopulate(profile.id, updatedTier);
  }
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
  admin: AdminClient,
) {
  const sub = event.data.object as Stripe.Subscription;
  const { data: profile } = await admin
    .from("profiles")
    .select("id, pro_until")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle<{ id: string; pro_until: string | null }>();
  if (!profile) {
    await recordEvent(event, admin, null);
    return;
  }

  // Do NOT clear pro_until — the user paid for the period. They
  // keep Pro until pro_until (= last period end) passes naturally.
  // Clear the subscription id + status + period mirror fields so
  // Settings stops rendering "Renews on X" (or "Cancels on X") for
  // a dead sub. pro_until still drives the isPro check; the mirror
  // columns are display-only.
  //
  // subscription_tier is cleared here too. Stripe fires
  // customer.subscription.deleted AT the period end for a
  // cancel_at_period_end sub, so this IS the end-of-period clear —
  // and since getPlanTier gates on pro_until > now() first, the
  // residual paid window (usually minutes) resolves as Pro-tier
  // rather than mis-labeling a still-paid Basic user as Free.
  await admin
    .from("profiles")
    .update({
      stripe_subscription_id: null,
      subscription_status: sub.status,
      cancel_at_period_end: null,
      current_period_end: null,
      subscription_tier: null,
      // Stale "stripe" here mis-steered a user who later subscribed
      // via the store: the app told them to cancel on the web for a
      // sub that only existed in Apple (audit finding #9).
      plan_source: "none",
    })
    .eq("id", profile.id);

  await recordEvent(event, admin, profile.id);
}

/**
 * Stripe 2024 API moved current_period_end from the Subscription root
 * to Subscription.items[i].current_period_end (each item can now
 * bill on its own cadence). Our Pro plan is a single-item subscription
 * so item[0] is authoritative. Fallback = now + 1 minute if the shape
 * changes again, so a busted read never fabricates infinite Pro access.
 */
function subPeriodEndIso(sub: Stripe.Subscription): string {
  const item = sub.items?.data?.[0];
  const unix =
    (item as unknown as { current_period_end?: number } | undefined)
      ?.current_period_end ?? null;
  if (typeof unix !== "number") {
    // Loud on purpose. A silent fallback would silently de-Pro the
    // user in 60s. Logging here surfaces in Vercel + Stripe's failing-
    // webhook alerts so Wilson notices when the shape moves again.
    console.error(
      "[stripe/webhook] subPeriodEndIso: items[0].current_period_end missing on sub",
      sub.id,
    );
    return new Date(Date.now() + 60_000).toISOString();
  }
  return new Date(unix * 1000).toISOString();
}

/**
 * Stripe 2024 API moved invoice.subscription off the root and onto
 * invoice.parent.subscription_details.subscription. Returns the
 * subscription id (string) or null when the invoice isn't
 * subscription-driven (one-off invoices, receipts).
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = (invoice as unknown as { parent?: unknown }).parent as
    | {
        subscription_details?: {
          subscription?: string | Stripe.Subscription;
        };
      }
    | null
    | undefined;
  const s = parent?.subscription_details?.subscription;
  if (typeof s === "string") return s;
  if (s && typeof s === "object" && "id" in s) return (s as { id: string }).id;
  return null;
}

/**
 * Stripe 2024 API removed invoice.payment_intent. The PaymentIntent
 * now lives inside invoice.payments[0].payment.payment_intent (paid
 * invoices always have at least one payment). Returns the intent id
 * or null when the invoice hasn't been paid or the shape shifts.
 */
function invoicePaymentIntentId(invoice: Stripe.Invoice): string | null {
  const payments = (invoice as unknown as {
    payments?: { data?: Array<{ payment?: { payment_intent?: unknown } }> };
  }).payments;
  const raw = payments?.data?.[0]?.payment?.payment_intent;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "id" in raw) {
    return (raw as { id: string }).id;
  }
  return null;
}

async function handleChargeRefunded(event: Stripe.Event, admin: AdminClient) {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) {
    await recordEvent(event, admin, null);
    return;
  }

  // Find the payment row for this PI. If we never saw the original
  // checkout.session.completed (e.g. test data), there's nothing to revert.
  const { data: payment } = await admin
    .from("payments")
    .select("id, user_id, purpose, status, refunded_at, stripe_session_id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!payment || payment.refunded_at) {
    await recordEvent(event, admin, payment?.user_id ?? null);
    return;
  }

  // Claim the refund: only proceed if this row hadn't already been refunded
  // by a racing webhook delivery. Mirrors the pending→paid claim above.
  const { data: refundClaimed } = await admin
    .from("payments")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .is("refunded_at", null)
    .select("id");

  if (!refundClaimed || refundClaimed.length === 0) {
    await recordEvent(event, admin, payment.user_id);
    return;
  }

  // Revert the credit. greatest(0, ...) in the SQL function prevents going
  // negative if the user already spent it — an already-redeemed inherit
  // slot simply floors at zero (the share itself is not clawed back).
  if (
    payment.purpose === "randomize" ||
    payment.purpose === "oracle" ||
    payment.purpose === "beneficiary_slot" ||
    payment.purpose === "inherited_slot_purchase" ||
    payment.purpose === "other_identity_create"
  ) {
    const column =
      payment.purpose === "oracle"
        ? "extra_oracle_credits"
        : payment.purpose === "beneficiary_slot"
          ? "paid_beneficiary_slots"
          : payment.purpose === "inherited_slot_purchase"
            ? "inherited_slot_credits"
            : payment.purpose === "other_identity_create"
              ? "other_identity_credits"
              : "randomize_credits";

    await admin.rpc("increment_profile_counter", {
      target_user_id: payment.user_id,
      counter_name: column,
      delta: -1,
    });
  }

  // Pack refunds revert the granted credits. The pack's type
  // (message vs image) only lives in the checkout session metadata,
  // so retrieve it from Stripe; greatest(0, ...) in the counter fn
  // means already-spent credits simply floor at zero rather than
  // driving the balance negative. Best-effort — a failed lookup
  // logs loudly and leaves the (refunded) credits for manual claw-back.
  if (
    (payment.purpose === "pack_small" ||
      payment.purpose === "pack_medium" ||
      payment.purpose === "pack_large") &&
    payment.stripe_session_id
  ) {
    try {
      // Refund revert mirrors the grant path (2026-07-28 pack rework):
      // grants BOTH counters, so a refund reverts BOTH counters too.
      // Session retrieve stays only for future-proofing (metadata may
      // grow to carry per-pack overrides); not needed for the math.
      const grants =
        payment.purpose === "pack_small"
          ? {
              messages: PRICING.packSmallMessages,
              images: PRICING.packSmallImages,
            }
          : payment.purpose === "pack_medium"
            ? {
                messages: PRICING.packMediumMessages,
                images: PRICING.packMediumImages,
              }
            : {
                messages: PRICING.packLargeMessages,
                images: PRICING.packLargeImages,
              };
      await admin.rpc("increment_profile_counter", {
        target_user_id: payment.user_id,
        counter_name: "message_credits",
        delta: -grants.messages,
      });
      await admin.rpc("increment_profile_counter", {
        target_user_id: payment.user_id,
        counter_name: "image_credits",
        delta: -grants.images,
      });
    } catch (err) {
      console.error(
        "[stripe/webhook] pack refund credit revert failed:",
        payment.id,
        err,
      );
    }
  }

  await recordEvent(event, admin, payment.user_id);
}
