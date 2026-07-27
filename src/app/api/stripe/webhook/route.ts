import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  recordAudit,
  sendAccountRestoredEmail,
} from "@/lib/notifications";
import type Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook receiver.
 *
 * Handles:
 *   checkout.session.completed        → mark payment paid + grant credit
 *                                        OR (subscription mode) bind
 *                                        customer/subscription + Pro window
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
  } else if (
    event.type === "charge.refunded" ||
    event.type === "charge.dispute.closed"
  ) {
    await handleChargeRefunded(event, admin);
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
      purpose !== "pro_monthly")
  ) {
    await recordEvent(event, admin, userId);
    return;
  }

  // Subscription bootstrap: bind the customer + subscription to the
  // profile so future portal sessions + invoice.paid renewals can
  // reverse-lookup. pro_until is set here from current_period_end;
  // invoice.paid extends it on each renewal.
  if (purpose === "pro_monthly") {
    await handleProMonthlyCheckout(event, session, admin, userId);
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
      await admin
        .from("oracles")
        .update({ deleted_at: null, scheduled_purge_at: null })
        .eq("id", oracleId)
        .eq("user_id", userId);

      // Re-attach as the active oracle so the user lands back in the
      // chat on next dashboard load.
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
    await recordEvent(event, admin, userId);
    return;
  }

  // Credit-grant purposes.
  const column =
    purpose === "oracle"
      ? "extra_oracle_credits"
      : purpose === "beneficiary_slot"
        ? "paid_beneficiary_slots"
        : "randomize_credits";

  await admin.rpc("increment_profile_counter", {
    target_user_id: userId,
    counter_name: column,
    delta: 1,
  });

  await recordEvent(event, admin, userId);
}

async function handleProMonthlyCheckout(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  admin: AdminClient,
  userId: string,
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

  await admin
    .from("profiles")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      subscription_status: sub.status,
      plan_source: "stripe",
      pro_until: periodEnd,
    })
    .eq("id", userId);

  await recordEvent(event, admin, userId);
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

  await admin
    .from("profiles")
    .update({
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      subscription_status: sub.status,
      pro_until: periodEnd,
    })
    .eq("id", profile.id);

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

  await admin
    .from("profiles")
    .update({
      current_period_end: subPeriodEndIso(sub),
      cancel_at_period_end: sub.cancel_at_period_end,
      subscription_status: sub.status,
    })
    .eq("id", profile.id);

  await recordEvent(event, admin, profile.id);
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
  await admin
    .from("profiles")
    .update({
      stripe_subscription_id: null,
      subscription_status: sub.status,
      cancel_at_period_end: null,
      current_period_end: null,
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
    .select("id, user_id, purpose, status, refunded_at")
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
  // negative if the user already spent it.
  if (
    payment.purpose === "randomize" ||
    payment.purpose === "oracle" ||
    payment.purpose === "beneficiary_slot"
  ) {
    const column =
      payment.purpose === "oracle"
        ? "extra_oracle_credits"
        : payment.purpose === "beneficiary_slot"
          ? "paid_beneficiary_slots"
          : "randomize_credits";

    await admin.rpc("increment_profile_counter", {
      target_user_id: payment.user_id,
      counter_name: column,
      delta: -1,
    });
  }

  await recordEvent(event, admin, payment.user_id);
}
