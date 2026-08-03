import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { PRICING } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { recordPendingPayment } from "@/lib/billing/pendingPayment";

/**
 * Create a Stripe Checkout session. The `purpose` query/body field
 * decides the SKU:
 *   - "pro_monthly" / "basic_monthly" — recurring subscriptions,
 *     gated on STRIPE_PRICE_ID_PRO_MONTHLY / _BASIC_MONTHLY
 *   - "pack_small" / "pack_medium" / "pack_large" — one-time add-on
 *     packs (STRIPE_PRICE_ID_PACK_*). Each pack credits BOTH
 *     message_credits AND image_credits per Wilson's 2026-07-28
 *     product spec ("you get both that many messages and photos").
 *     Older `pack_type` metadata is silently ignored.
 *   - "inherited_slot_purchase" — one-time $5 inherit-slot credit
 *     (STRIPE_PRICE_ID_INHERITED_SLOT). On payment the webhook adds
 *     1 to profiles.inherited_slot_credits; /identity/inherit
 *     consumes 1 per code redeemed (flat fee — every tier, every
 *     code, no waivers). success_url lands the buyer back on
 *     /identity/inherit so they can enter the code they were
 *     holding when the gate stopped them.
 *   - "other_identity_create" — one-time $5 other-mode legacy-mint
 *     credit (STRIPE_PRICE_ID_OTHER_IDENTITY_CREATE). On payment the
 *     webhook adds 1 to profiles.other_identity_credits;
 *     completeLegacyIdentity consumes 1 per other-mode completion
 *     (self-mode stays free). success_url lands the buyer back on
 *     /identity/legacy/new?paid=1 — the last question with a
 *     "You're paid — finish it" CTA.
 *   - "oracle" — one-time $5 extra-companion credit
 *     (STRIPE_PRICE_ID_EXTRA_ORACLE). On payment the webhook adds 1
 *     to profiles.extra_oracle_credits, which canCreateOracle folds
 *     into the plan's random/photo quota (baseQuota + credits) so a
 *     user over their tier's ceiling can mint one more self-created
 *     identity. Same $5 SKU whether the buyer wants a random or a
 *     from-photo identity — the quota is shared. Restored 2026-08-03
 *     (was PURGED with the Fable payment audit; the webhook branch
 *     never came out, so wiring the checkout branch is enough).
 *     success_url lands the buyer back on /identity/create so they
 *     can immediately pick which flow to use the new slot on.
 *
 * PURGED 2026-07-28 (Fable payment audit): "randomize",
 * "beneficiary_slot", "restore_account", "restore_oracle" — those
 * routes were scrapped in the 2026-06-29 reset. The checkout
 * branches for them survived and would have landed buyers on 404
 * success pages, so they're rejected here.
 */
export async function POST(request: NextRequest) {
  type Purpose =
    | "pro_monthly"
    | "basic_monthly"
    | "pack_small"
    | "pack_medium"
    | "pack_large"
    | "inherited_slot_purchase"
    | "other_identity_create"
    | "oracle";
  let purpose: Purpose | null = null;
  const isPurpose = (v: unknown): v is Purpose =>
    v === "pro_monthly" ||
    v === "basic_monthly" ||
    v === "pack_small" ||
    v === "pack_medium" ||
    v === "pack_large" ||
    v === "inherited_slot_purchase" ||
    v === "other_identity_create" ||
    v === "oracle";
  try {
    const body = await request.clone().json();
    if (isPurpose(body?.purpose)) {
      purpose = body.purpose;
    }
  } catch {
    // body optional
  }
  const url = new URL(request.url);
  const qp = url.searchParams.get("purpose");
  if (isPurpose(qp)) {
    purpose = qp;
  }

  if (purpose === null) {
    return NextResponse.json(
      { error: "unknown_or_missing_purpose" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const stripe = getStripe();

  // Recurring subscription branch (Pro + Basic). Feature-flagged on
  // the price envs so the code can ship before Wilson has created the
  // Products/Prices in Stripe. When an env is absent the upgrade page
  // still shows the mailto fallback for that tier.
  if (purpose === "pro_monthly" || purpose === "basic_monthly") {
    const priceId =
      purpose === "basic_monthly"
        ? process.env.STRIPE_PRICE_ID_BASIC_MONTHLY
        : process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
    if (!priceId) {
      return NextResponse.json(
        { error: "subscription_checkout_not_configured" },
        { status: 503 },
      );
    }

    const admin = createAdminClient();
    // Reuse the customer id if we've already made one for this user
    // (previous cancelled subscription, previous one-shot purchase).
    // Otherwise Stripe creates one on session.completed and we bind
    // it in the webhook.
    const { data: profile } = await admin
      .from("profiles")
      .select(
        "stripe_customer_id, stripe_subscription_id, subscription_status",
      )
      .eq("id", user.id)
      .maybeSingle<{
        stripe_customer_id: string | null;
        stripe_subscription_id: string | null;
        subscription_status: string | null;
      }>();

    // Already-subscribed guard. Without this, a crafted second POST
    // (or a client that races the redirect) creates a second Stripe
    // subscription for the same user and orphans the first when
    // stripe_subscription_id gets overwritten by the second webhook.
    // The 409 tells the client to send the user to the billing portal
    // (Manage subscription) instead of starting a new one.
    //
    // Fable Low: previously we also required subscription_status to
    // be truthy. A missed subscription.created webhook (Stripe outage,
    // signature verification failure, DB write hiccup) can leave
    // stripe_subscription_id set with subscription_status still null,
    // so the guard evaluated false and a second subscription got
    // minted. Gate on stripe_subscription_id alone; treat 'canceled' /
    // 'incomplete_expired' as null-equivalent so a genuinely-ended
    // subscription can be replaced.
    const activeSubscription =
      profile?.stripe_subscription_id &&
      profile.subscription_status !== "canceled" &&
      profile.subscription_status !== "incomplete_expired";
    if (activeSubscription) {
      return NextResponse.json(
        { error: "already_subscribed" },
        { status: 409 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: user.email ?? undefined }),
      line_items: [{ price: priceId, quantity: 1 }],
      // App Store 3.1.2 + auto-renew disclosure: this text is repeated
      // on the /terms page and the upgrade CTA copy.
      subscription_data: {
        metadata: { user_id: user.id, product: purpose },
      },
      metadata: {
        user_id: user.id,
        purpose,
      },
      allow_promotion_codes: true,
      success_url: `${origin}/dashboard?upgraded=1`,
      cancel_url: `${origin}/upgrade?cancelled=1`,
    });

    // Pending payment ledger row — mirrors the one-shot flow so
    // /admin/revenue and reconciliation tooling see the same shape.
    // H2 fix: fail-loud if the insert errors, so the customer can't
    // pay for something the webhook won't fulfill.
    const record = await recordPendingPayment({
      admin,
      stripe,
      session,
      row: {
        user_id: user.id,
        amount_cents:
          purpose === "basic_monthly"
            ? PRICING.basicMonthlyCents
            : PRICING.monthlyCents,
        currency: "usd",
        purpose,
      },
    });
    if (!record.ok) return record.response;

    return NextResponse.json({ url: session.url });
  }

  // One-time add-on pack branch. Unlike the legacy one-shot SKUs
  // below (inline price_data at a flat $5), packs use REAL Stripe
  // Price objects so the dashboard shows clean per-pack revenue.
  // pack_type ("message" | "image") was chosen by the buyer in the
  // UI before checkout and rides into metadata; the webhook reads it
  // to credit message_credits or image_credits by the pack's size.
  if (
    purpose === "pack_small" ||
    purpose === "pack_medium" ||
    purpose === "pack_large"
  ) {
    const packKind = purpose.replace("pack_", "") as
      | "small"
      | "medium"
      | "large";
    const priceId =
      packKind === "small"
        ? process.env.STRIPE_PRICE_ID_PACK_SMALL
        : packKind === "medium"
          ? process.env.STRIPE_PRICE_ID_PACK_MEDIUM
          : process.env.STRIPE_PRICE_ID_PACK_LARGE;
    if (!priceId) {
      return NextResponse.json(
        { error: "pack_checkout_not_configured" },
        { status: 503 },
      );
    }

    const amountCents =
      packKind === "small"
        ? PRICING.packSmallCents
        : packKind === "medium"
          ? PRICING.packMediumCents
          : PRICING.packLargeCents;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        purpose,
        pack_kind: packKind,
        // pack_type retired 2026-07-28: packs now credit BOTH counters
        // (message_credits + image_credits) regardless of any prior
        // buyer selection.
      },
      success_url: `${origin}/dashboard?pack=1`,
      cancel_url: `${origin}/upgrade?cancelled=1#packs`,
    });

    const admin = createAdminClient();
    const record = await recordPendingPayment({
      admin,
      stripe,
      session,
      row: {
        user_id: user.id,
        amount_cents: amountCents,
        currency: "usd",
        purpose,
      },
    });
    if (!record.ok) return record.response;

    return NextResponse.json({ url: session.url });
  }

  // One-time inherit-slot credit. Real Stripe Price (like the packs)
  // so the dashboard shows clean per-SKU revenue; feature-flagged on
  // the env so the surface can ship first (absent env → the upgrade
  // page keeps its mailto fallback for this SKU).
  if (purpose === "inherited_slot_purchase") {
    const priceId = process.env.STRIPE_PRICE_ID_INHERITED_SLOT;
    if (!priceId) {
      return NextResponse.json(
        { error: "inherited_slot_checkout_not_configured" },
        { status: 503 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        purpose,
        purchase_kind: "inherited_slot",
      },
      // Back to the redeem screen — the buyer was holding a code when
      // the gate sent them to buy; the webhook grants the credit while
      // they land, and the redeem action consumes it.
      success_url: `${origin}/identity/inherit?purchased=1`,
      cancel_url: `${origin}/upgrade?cancelled=1&reason=inherited-slot`,
    });

    const admin = createAdminClient();
    const record = await recordPendingPayment({
      admin,
      stripe,
      session,
      row: {
        user_id: user.id,
        amount_cents: PRICING.inheritedSlotPurchaseCents,
        currency: "usd",
        purpose,
      },
    });
    if (!record.ok) return record.response;

    return NextResponse.json({ url: session.url });
  }

  // One-time other-mode legacy-mint credit. Same shape as the
  // inherit-slot SKU: real Stripe Price, feature-flagged on the env so
  // the surface can ship before the Price exists in the dashboard
  // (absent env → 503; the completion action turns that into a
  // graceful "not configured yet" banner).
  if (purpose === "other_identity_create") {
    const priceId = process.env.STRIPE_PRICE_ID_OTHER_IDENTITY_CREATE;
    if (!priceId) {
      return NextResponse.json(
        { error: "other_identity_create_checkout_not_configured" },
        { status: 503 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        purpose,
        purchase_kind: "other_identity_create",
      },
      // Back to the flow they were finishing — the draft autosaved, so
      // ?paid=1 lands them on their last question with the paid CTA
      // (Wilson's option B: transparent, one extra click, no
      // auto-magic).
      success_url: `${origin}/identity/legacy/new?paid=1`,
      cancel_url: `${origin}/identity/legacy/new?cancelled=1`,
    });

    const admin = createAdminClient();
    const record = await recordPendingPayment({
      admin,
      stripe,
      session,
      row: {
        user_id: user.id,
        amount_cents: PRICING.otherIdentityCreateCents,
        currency: "usd",
        purpose,
      },
    });
    if (!record.ok) return record.response;

    return NextResponse.json({ url: session.url });
  }

  // One-time extra-companion credit. Same shape as the inherit-slot
  // and other-identity-create SKUs: real Stripe Price, feature-flagged
  // on the env so the surface can ship before the Price exists (absent
  // env → 503; the Add-a-companion card turns that into a graceful
  // "not configured yet" state). The webhook (checkout.session.completed
  // branch keyed on purpose='oracle') increments extra_oracle_credits;
  // canCreateOracle stacks that on top of the base plan ceiling, so a
  // Basic user at 3-of-3 can create one more random OR photo identity
  // per credit — the credit is quota-agnostic.
  if (purpose === "oracle") {
    const priceId = process.env.STRIPE_PRICE_ID_EXTRA_ORACLE;
    if (!priceId) {
      return NextResponse.json(
        { error: "extra_oracle_checkout_not_configured" },
        { status: 503 },
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
        purpose,
        purchase_kind: "extra_oracle",
      },
      // Back to the picker — the buyer just bought +1 slot, land them
      // where they choose random vs photo. ?extra=1 lets the client
      // reveal a "You've got a fresh slot" affirmation without changing
      // the page structure.
      success_url: `${origin}/identity/create?extra=1`,
      cancel_url: `${origin}/identity/create?cancelled=1`,
    });

    const admin = createAdminClient();
    const record = await recordPendingPayment({
      admin,
      stripe,
      session,
      row: {
        user_id: user.id,
        amount_cents: PRICING.extraIdentityCents,
        currency: "usd",
        purpose,
      },
    });
    if (!record.ok) return record.response;

    return NextResponse.json({ url: session.url });
  }

  // Every valid purpose has its own branch above and returns; hitting
  // this point means the isPurpose validator has drifted from the
  // branch table. Fail closed rather than silently minting a garbage
  // session.
  return NextResponse.json(
    { error: "purpose_not_handled" },
    { status: 500 },
  );
}
