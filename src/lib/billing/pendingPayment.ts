import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { NextResponse } from "next/server";

/**
 * Record a pending payments-ledger row and REFUSE the checkout if
 * the insert fails.
 *
 * Fable full-audit H2: every checkout route was inserting the
 * pending row with a bare `await` — no error check. The webhook
 * gates fulfillment on claiming that row (webhook/route.ts:169-184,
 * silent short-circuit if 0 rows), so a failed insert = customer
 * pays via Stripe and receives nothing, unlogged.
 *
 * On insert failure we:
 *   1. Expire the Stripe Checkout session so the customer can't
 *      inadvertently pay for a purchase that would never fulfill.
 *   2. Log LOUDLY (`console.error`) with enough context for a Vercel
 *      log search to reconcile.
 *   3. Return a 500 NextResponse the caller should short-circuit
 *      with.
 *
 * Session-expire is best-effort: if THAT fails (Stripe outage,
 * network) we still return the 500 so the client doesn't proceed;
 * the session will Stripe-auto-expire after 24h regardless.
 */
export async function recordPendingPayment(opts: {
  admin: SupabaseClient;
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  row: {
    user_id: string;
    amount_cents: number;
    currency: string;
    purpose: string;
  };
}): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const { admin, stripe, session, row } = opts;

  const { error } = await admin.from("payments").insert({
    ...row,
    stripe_session_id: session.id,
    status: "pending",
  });

  if (error) {
    console.error(
      `[billing] pending-payment insert failed for session ${session.id} ` +
        `(user ${row.user_id}, purpose ${row.purpose}, ${row.amount_cents}c) — ` +
        `expiring the Stripe session to prevent orphaned charge. DB error:`,
      error,
    );
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch (expireErr) {
      console.error(
        `[billing] stripe session expire also failed for ${session.id}:`,
        expireErr,
      );
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "checkout_ledger_failure" },
        { status: 500 },
      ),
    };
  }

  return { ok: true };
}
