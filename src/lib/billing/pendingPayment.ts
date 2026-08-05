import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { NextResponse } from "next/server";

/**
 * Dedupe an inline checkout gate against a session the user already
 * has in flight.
 *
 * THE WINDOW THIS CLOSES. The redeem and other-mode-mint gates create
 * a Stripe session inline when the credit balance reads 0. But the
 * balance is granted by the WEBHOOK, asynchronously — so a user who
 * pays and is bounced back before the webhook lands still reads 0,
 * re-submits, and the gate happily creates a SECOND session. They pay
 * $5 twice and end up holding a spare credit, not a refund. (Fable
 * legacy-domain audit, finding 4.)
 *
 * Before creating a session, callers ask here whether a recent
 * pending row for (user, purpose) already resolves the situation:
 *
 *   'paid_pending_grant' — a recent session is PAID and the webhook
 *       just hasn't granted yet. Don't charge again; tell the user
 *       their payment landed and to retry in a few seconds.
 *   'open' — a recent session is still open (they closed the tab, or
 *       double-submitted). Reuse ITS url instead of minting another,
 *       so there is never more than one live checkout per purpose.
 *   'none' — nothing reusable; create a session as before.
 *
 * Fail-open on every error: a Stripe/DB hiccup here must never block
 * a legitimate first purchase. The worst case of failing open is the
 * pre-existing behavior (a duplicate session), never a lost payment.
 * Window: 30 minutes — Stripe sessions live 24h, but a stale
 * yesterday-session shouldn't hijack today's genuine retry.
 */
export async function findReusableCheckout(opts: {
  admin: SupabaseClient;
  stripe: Stripe;
  userId: string;
  purpose: string;
}): Promise<
  | { kind: "paid_pending_grant" }
  | { kind: "open"; url: string }
  | { kind: "none" }
> {
  const { admin, stripe, userId, purpose } = opts;
  try {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("payments")
      .select("stripe_session_id")
      .eq("user_id", userId)
      .eq("purpose", purpose)
      .eq("status", "pending")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(3);

    for (const row of recent ?? []) {
      if (!row.stripe_session_id) continue;
      try {
        const session = await stripe.checkout.sessions.retrieve(
          row.stripe_session_id as string,
        );
        if (session.payment_status === "paid") {
          return { kind: "paid_pending_grant" };
        }
        if (session.status === "open" && session.url) {
          return { kind: "open", url: session.url };
        }
      } catch (err) {
        console.error(
          `[billing] reusable-checkout retrieve failed for ${row.stripe_session_id}:`,
          err,
        );
      }
    }
  } catch (err) {
    console.error("[billing] reusable-checkout lookup failed:", err);
  }
  return { kind: "none" };
}

/**
 * Shared insert + failure handling. Extracted so
 * recordPendingPayment (API-route shape) and
 * recordPendingPaymentOrThrow (server-action shape) share the exact
 * same log line and Stripe-session cleanup on failure.
 */
async function attemptPendingInsert(opts: {
  admin: SupabaseClient;
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  row: {
    user_id: string;
    amount_cents: number;
    currency: string;
    purpose: string;
  };
}): Promise<{ ok: true } | { ok: false }> {
  const { admin, stripe, session, row } = opts;
  const { error } = await admin.from("payments").insert({
    ...row,
    stripe_session_id: session.id,
    status: "pending",
  });
  if (!error) return { ok: true };

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
  return { ok: false };
}

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
  const result = await attemptPendingInsert(opts);
  if (result.ok) return { ok: true };
  return {
    ok: false,
    response: NextResponse.json(
      { error: "checkout_ledger_failure" },
      { status: 500 },
    ),
  };
}

/**
 * Server-action variant that THROWS on insert failure. Server
 * actions can't return a NextResponse; the caller's existing
 * try/catch (usually wrapping it in redirectWithError) handles the
 * failure. Side effects (log + Stripe session expire) run before
 * the throw so orphan charges are still prevented.
 *
 * Same H2 guarantee as recordPendingPayment: on DB failure, no
 * Stripe session survives and the ledger row was never written, so
 * the webhook can never fulfill a charge that has no matching
 * pending row. Fable's "identity/inherit/actions.ts + identity/
 * legacy/new/actions.ts + capNotice.ts have the same bug" finding.
 */
export async function recordPendingPaymentOrThrow(opts: {
  admin: SupabaseClient;
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  row: {
    user_id: string;
    amount_cents: number;
    currency: string;
    purpose: string;
  };
}): Promise<void> {
  const result = await attemptPendingInsert(opts);
  if (!result.ok) {
    throw new Error("checkout_ledger_failure");
  }
}
