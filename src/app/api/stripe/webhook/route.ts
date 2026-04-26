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
 *   checkout.session.completed   → mark payment paid + grant the right credit
 *   charge.refunded              → mark payment refunded + revert credit
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
      purpose !== "restore_oracle")
  ) {
    await recordEvent(event, admin, userId);
    return;
  }

  // Mark payment paid + tag with this event id so a future refund can find it.
  // Only updates if still pending — re-fires won't double-mark.
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  await admin
    .from("payments")
    .update({
      status: "paid",
      stripe_payment_intent_id: paymentIntentId,
      stripe_event_id: event.id,
      paid_at: new Date().toISOString(),
    })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending");

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

  await admin
    .from("payments")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

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
