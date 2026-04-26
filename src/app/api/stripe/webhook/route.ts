import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Stripe webhook receiver. Verifies the signature, then on
 * `checkout.session.completed` marks the payment paid and grants the user
 * one randomize credit.
 *
 * Stripe → Webhooks → endpoint at https://chapter3five.app/api/stripe/webhook
 * Send the signing secret to env as STRIPE_WEBHOOK_SECRET.
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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.user_id;
  const purpose = session.metadata?.purpose;
  if (
    !userId ||
    (purpose !== "randomize" &&
      purpose !== "oracle" &&
      purpose !== "beneficiary_slot")
  ) {
    return NextResponse.json({ received: true, ignored: "no metadata" });
  }

  const admin = createAdminClient();

  // Mark payment paid (idempotent).
  await admin
    .from("payments")
    .update({
      status: "paid",
      stripe_payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      paid_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending");

  // Grant the credit in the right pool.
  const column =
    purpose === "oracle"
      ? "extra_oracle_credits"
      : purpose === "beneficiary_slot"
        ? "paid_beneficiary_slots"
        : "randomize_credits";

  const { data: profile } = await admin
    .from("profiles")
    .select(column)
    .eq("id", userId)
    .single();

  const current = (profile as Record<string, number> | null)?.[column] ?? 0;
  await admin
    .from("profiles")
    .update({ [column]: current + 1 })
    .eq("id", userId);

  return NextResponse.json({ received: true });
}
