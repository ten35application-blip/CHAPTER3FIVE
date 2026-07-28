import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getStripe, RANDOMIZE_PRICE_USD_CENTS } from "@/lib/stripe";
import { PRICING } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTermsAccepted } from "@/lib/legal/gate";

/**
 * Create a Stripe Checkout session. The `purpose` query/body field
 * decides the SKU:
 *   - "randomize" (default) — adds 1 to randomize_credits
 *   - "oracle"              — adds 1 to extra_oracle_credits
 *   - "beneficiary_slot" / "restore_account" / "restore_oracle"
 *   - "pro_monthly" / "basic_monthly" — recurring subscriptions,
 *     gated on STRIPE_PRICE_ID_PRO_MONTHLY / _BASIC_MONTHLY
 *   - "pack_small" / "pack_medium" / "pack_large" — one-time add-on
 *     packs (STRIPE_PRICE_ID_PACK_*). The buyer picks the pack TYPE
 *     (messages or images) in the UI before hitting checkout; it
 *     arrives as `pack_type` in the body/query and rides into the
 *     session metadata so the webhook credits the right column.
 *   - "inherited_slot_purchase" — one-time $5 inherit-slot credit
 *     (STRIPE_PRICE_ID_INHERITED_SLOT). On payment the webhook adds
 *     1 to profiles.inherited_slot_credits; the /identity/inherit
 *     redeem action consumes 1 per code redeemed (flat fee — every
 *     tier, every code, no waivers). success_url
 *     lands the buyer back on /identity/inherit so they can enter
 *     the code they were holding when the gate stopped them.
 */
export async function POST(request: NextRequest) {
  type Purpose =
    | "randomize"
    | "oracle"
    | "beneficiary_slot"
    | "restore_account"
    | "restore_oracle"
    | "pro_monthly"
    | "basic_monthly"
    | "pack_small"
    | "pack_medium"
    | "pack_large"
    | "inherited_slot_purchase";
  let purpose: Purpose = "randomize";
  let restoreOracleId: string | null = null;
  let packType: "message" | "image" = "message";
  const isPurpose = (v: unknown): v is Purpose =>
    v === "randomize" ||
    v === "oracle" ||
    v === "beneficiary_slot" ||
    v === "restore_account" ||
    v === "restore_oracle" ||
    v === "pro_monthly" ||
    v === "basic_monthly" ||
    v === "pack_small" ||
    v === "pack_medium" ||
    v === "pack_large" ||
    v === "inherited_slot_purchase";
  const isPackType = (v: unknown): v is "message" | "image" =>
    v === "message" || v === "image";
  try {
    const body = await request.clone().json();
    if (isPurpose(body?.purpose)) {
      purpose = body.purpose;
    }
    if (typeof body?.oracle_id === "string") {
      restoreOracleId = body.oracle_id;
    }
    if (isPackType(body?.pack_type)) {
      packType = body.pack_type;
    }
  } catch {
    // body optional
  }
  const url = new URL(request.url);
  const qp = url.searchParams.get("purpose");
  if (isPurpose(qp)) {
    purpose = qp;
  }
  const qpPackType = url.searchParams.get("pack_type");
  if (isPackType(qpPackType)) {
    packType = qpPackType;
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
    if (
      profile?.stripe_subscription_id &&
      profile.subscription_status &&
      profile.subscription_status !== "canceled" &&
      profile.subscription_status !== "incomplete_expired"
    ) {
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
    await admin.from("payments").insert({
      user_id: user.id,
      stripe_session_id: session.id,
      amount_cents:
        purpose === "basic_monthly"
          ? PRICING.basicMonthlyCents
          : PRICING.monthlyCents,
      currency: "usd",
      purpose,
      status: "pending",
    });

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
        pack_type: packType,
      },
      success_url: `${origin}/dashboard?pack=1`,
      cancel_url: `${origin}/upgrade?cancelled=1#packs`,
    });

    const admin = createAdminClient();
    await admin.from("payments").insert({
      user_id: user.id,
      stripe_session_id: session.id,
      amount_cents: amountCents,
      currency: "usd",
      purpose,
      status: "pending",
    });

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
    await admin.from("payments").insert({
      user_id: user.id,
      stripe_session_id: session.id,
      amount_cents: PRICING.inheritedSlotPurchaseCents,
      currency: "usd",
      purpose,
      status: "pending",
    });

    return NextResponse.json({ url: session.url });
  }

  const productName =
    purpose === "oracle"
      ? "chapter3five — new identity"
      : purpose === "beneficiary_slot"
        ? "chapter3five — extra beneficiary"
        : purpose === "restore_account"
          ? "chapter3five — restore account"
          : purpose === "restore_oracle"
            ? "chapter3five — restore identity"
            : "chapter3five — randomize";
  const productDesc =
    purpose === "oracle"
      ? "Create one additional identity in your account."
      : purpose === "beneficiary_slot"
        ? "Designate one additional beneficiary for your archive."
        : purpose === "restore_account"
          ? "Bring your archive back from the 30-day grace period."
          : purpose === "restore_oracle"
            ? "Restore one of your identities from the 30-day grace period."
            : "One additional randomized character generation.";
  const successPath =
    purpose === "oracle"
      ? "/oracle/success?session_id={CHECKOUT_SESSION_ID}"
      : purpose === "beneficiary_slot"
        ? "/sharing?saved=beneficiary-slot"
        : purpose === "restore_account"
          ? "/dashboard?restored=1"
          : purpose === "restore_oracle"
            ? "/identities?saved=oracle-restored"
            : "/randomize/success?session_id={CHECKOUT_SESSION_ID}";
  const cancelPath =
    purpose === "oracle"
      ? "/oracle/cancel"
      : purpose === "beneficiary_slot"
        ? "/sharing?error=Payment%20cancelled"
        : purpose === "restore_account"
          ? "/restore?error=Payment%20cancelled"
          : purpose === "restore_oracle"
            ? "/identities?error=Payment%20cancelled"
            : "/randomize/cancel";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: user.email ?? undefined,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: RANDOMIZE_PRICE_USD_CENTS,
          product_data: {
            name: productName,
            description: productDesc,
          },
        },
      },
    ],
    metadata: {
      user_id: user.id,
      purpose,
      ...(purpose === "restore_oracle" && restoreOracleId
        ? { oracle_id: restoreOracleId }
        : {}),
    },
    success_url: `${origin}${successPath}`,
    cancel_url: `${origin}${cancelPath}`,
  });

  // Record a pending payment row so we can reconcile.
  const admin = createAdminClient();
  await admin.from("payments").insert({
    user_id: user.id,
    stripe_session_id: session.id,
    amount_cents: RANDOMIZE_PRICE_USD_CENTS,
    currency: "usd",
    purpose,
    status: "pending",
  });

  return NextResponse.json({ url: session.url });
}
