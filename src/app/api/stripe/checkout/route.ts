import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { getStripe, RANDOMIZE_PRICE_USD_CENTS } from "@/lib/stripe";
import { PRICING } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTermsAccepted } from "@/lib/legal/gate";

/**
 * Create a Stripe Checkout session for a $5 credit. The `purpose` query/body
 * field decides what the credit unlocks:
 *   - "randomize" (default) — adds 1 to randomize_credits
 *   - "oracle"             — adds 1 to extra_oracle_credits
 */
export async function POST(request: NextRequest) {
  type Purpose =
    | "randomize"
    | "oracle"
    | "beneficiary_slot"
    | "restore_account"
    | "restore_oracle"
    | "pro_monthly";
  let purpose: Purpose = "randomize";
  let restoreOracleId: string | null = null;
  const isPurpose = (v: unknown): v is Purpose =>
    v === "randomize" ||
    v === "oracle" ||
    v === "beneficiary_slot" ||
    v === "restore_account" ||
    v === "restore_oracle" ||
    v === "pro_monthly";
  try {
    const body = await request.clone().json();
    if (isPurpose(body?.purpose)) {
      purpose = body.purpose;
    }
    if (typeof body?.oracle_id === "string") {
      restoreOracleId = body.oracle_id;
    }
  } catch {
    // body optional
  }
  const url = new URL(request.url);
  const qp = url.searchParams.get("purpose");
  if (isPurpose(qp)) {
    purpose = qp;
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

  // Recurring subscription branch. Feature-flagged on the price env
  // so the code can ship before Wilson has created the Product/Price
  // in Stripe. When the env is absent the upgrade page still shows
  // the mailto fallback.
  if (purpose === "pro_monthly") {
    const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
    if (!priceId) {
      return NextResponse.json(
        { error: "pro_checkout_not_configured" },
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
        metadata: { user_id: user.id, product: "pro_monthly" },
      },
      metadata: {
        user_id: user.id,
        purpose: "pro_monthly",
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
      amount_cents: PRICING.monthlyCents,
      currency: "usd",
      purpose: "pro_monthly",
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
