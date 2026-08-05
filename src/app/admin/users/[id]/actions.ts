"use server";

import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/notifications";
import { revalidatePath } from "next/cache";

/**
 * Admin actions — REAL implementations.
 *
 * These four shipped as console.log stubs that returned { ok: true }
 * with a "(stub)" message, wired to live buttons on the user detail
 * page. The admin saw a success toast; nothing happened. Which meant:
 * there was NO working way, on any surface, to revoke a leaked
 * inherit code — the mobile API route's revoke case selected
 * inherit_codes.user_id, a column that does not exist (the table is
 * id, oracle_id, created_by, code, revoked_at, created_at), so it
 * 404'd every call. Both halves fixed together.
 *
 * Every destructive action writes audit_log via recordAudit — the same
 * ledger delete-account and the Stripe webhook already use. An admin
 * action that leaves no trace is unattributable the day a session is
 * stolen.
 *
 * Semantics mirror the mobile twin (api/admin/users/[id]/action):
 *   - soft-deletes, never hard: the 0136 trigger arms the 30-day
 *     purge countdown automatically; restore stays possible.
 *   - accurate no-op messages: a second click reports what is, not
 *     what the click wished.
 *   - the shared concierge is untouchable.
 */

export type ActionResult = { ok: boolean; message: string };

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createAdminClient();

  // Only stamp a not-yet-deleted profile — re-stamping desyncs the
  // oracle-cascade stamp the restore paths match on (see the mobile
  // twin's delete_user case for the full story).
  const { data: stamped, error } = await service
    .from("profiles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", userId)
    .is("deleted_at", null)
    .select("id");
  if (error) {
    return { ok: false, message: `Failed: ${error.message}` };
  }
  if (!stamped || stamped.length === 0) {
    return {
      ok: true,
      message:
        "Account was already soft-deleted. Its original 30-day window is still running.",
    };
  }

  await recordAudit({
    actorUserId: admin.id,
    actorEmail: admin.email ?? null,
    action: "admin_soft_deleted_user",
    targetUserId: userId,
  });
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  return {
    ok: true,
    message:
      "Account soft-deleted. They'll be signed out on next open; the 30-day purge countdown is running. Undelete restores.",
  };
}

export async function deleteIdentityAction(
  oracleId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createAdminClient();

  const { data: oracle } = await service
    .from("oracles")
    .select("id, user_id, deleted_at, is_concierge")
    .eq("id", oracleId)
    .maybeSingle<{
      id: string;
      user_id: string;
      deleted_at: string | null;
      is_concierge: boolean;
    }>();
  if (!oracle) {
    return { ok: false, message: "Identity not found." };
  }
  if (oracle.is_concierge) {
    return {
      ok: false,
      message:
        "That's the shared concierge — it can't be deleted. Every free-tier user talks to that one row.",
    };
  }
  if (oracle.deleted_at) {
    return { ok: true, message: "Identity was already deleted." };
  }

  const { error } = await service
    .from("oracles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", oracleId)
    .eq("is_concierge", false);
  if (error) {
    return { ok: false, message: `Failed: ${error.message}` };
  }

  await recordAudit({
    actorUserId: admin.id,
    actorEmail: admin.email ?? null,
    action: "admin_soft_deleted_identity",
    targetUserId: oracle.user_id,
    targetId: oracleId,
  });
  revalidatePath(`/admin/users/${oracle.user_id}`);
  return {
    ok: true,
    message: "Identity soft-deleted (30-day recover window).",
  };
}

export async function revokeInheritCodeAction(
  codeId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createAdminClient();

  const { data: code } = await service
    .from("inherit_codes")
    .select("id, code, created_by, revoked_at")
    .eq("id", codeId)
    .maybeSingle<{
      id: string;
      code: string;
      created_by: string | null;
      revoked_at: string | null;
    }>();
  if (!code) {
    return { ok: false, message: "Code not found." };
  }
  if (code.revoked_at) {
    return { ok: true, message: "Code was already revoked." };
  }

  const { error } = await service
    .from("inherit_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", codeId);
  if (error) {
    return { ok: false, message: `Failed: ${error.message}` };
  }

  await recordAudit({
    actorUserId: admin.id,
    actorEmail: admin.email ?? null,
    action: "admin_revoked_inherit_code",
    targetUserId: code.created_by,
    targetId: codeId,
  });
  revalidatePath(`/admin/users/${code.created_by ?? ""}`);
  return {
    ok: true,
    message: `Code ${code.code} revoked. Existing redeemed copies stay with their owners; new redemptions stop now.`,
  };
}

export async function refundPaymentAction(
  paymentId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createAdminClient();

  const { data: payment } = await service
    .from("payments")
    .select("id, user_id, amount_cents, status, stripe_payment_intent_id")
    .eq("id", paymentId)
    .maybeSingle<{
      id: string;
      user_id: string;
      amount_cents: number;
      status: string;
      stripe_payment_intent_id: string | null;
    }>();
  if (!payment) {
    return { ok: false, message: "Payment not found." };
  }
  if (payment.status === "refunded") {
    return { ok: true, message: "Payment was already refunded." };
  }
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return {
      ok: false,
      message:
        "Stripe isn't wired in this environment, so the refund can't be issued from here.",
    };
  }
  if (!payment.stripe_payment_intent_id) {
    return {
      ok: false,
      message:
        "This payment row has no Stripe PaymentIntent id — nothing to refund.",
    };
  }

  // Late import so cold-start doesn't pay for Stripe on every admin
  // page load. The charge.refunded webhook flips payments.status and
  // claws back the granted credits — same path a Dashboard refund
  // takes, one implementation to trust.
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(stripeSecret);
    await stripe.refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
    });
  } catch (err) {
    return {
      ok: false,
      message: `Stripe refused the refund: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    };
  }

  await recordAudit({
    actorUserId: admin.id,
    actorEmail: admin.email ?? null,
    action: "admin_refund_initiated",
    targetUserId: payment.user_id,
    targetId: paymentId,
    details: { amount_cents: payment.amount_cents },
  });
  revalidatePath(`/admin/users/${payment.user_id}`);
  return {
    ok: true,
    message: `Refund of $${(payment.amount_cents / 100).toFixed(2)} sent to Stripe. The webhook marks the row refunded and reverts credits when it lands.`,
  };
}

/**
 * Grant a target user 30 days of Pro on the house. Real: sets
 * profiles.pro_until to 30d from now (extends further if already
 * granted), plan_source='admin_grant'. Uses service-role to bypass
 * RLS's "users update their own profile" scope.
 *
 * Used to comp friends/family without Stripe being wired end-to-end
 * yet. Extending: hitting it a second time keeps pushing the
 * expiration further out (adds another 30d from CURRENT expiration
 * if that's in the future, else 30d from now).
 */
export async function grantProAction(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createAdminClient();

  const { data: existing } = await service
    .from("profiles")
    .select("pro_until")
    .eq("id", userId)
    .maybeSingle<{ pro_until: string | null }>();

  const base = existing?.pro_until
    ? Math.max(Date.now(), new Date(existing.pro_until).getTime())
    : Date.now();
  const newProUntil = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await service
    .from("profiles")
    .update({ pro_until: newProUntil, plan_source: "admin_grant" })
    .eq("id", userId);

  if (error) {
    console.error(
      `[admin] ${admin.email} FAILED grant Pro for ${userId}:`,
      error,
    );
    return { ok: false, message: `Failed: ${error.message}` };
  }

  await recordAudit({
    actorUserId: admin.id,
    actorEmail: admin.email ?? null,
    action: "admin_granted_pro",
    targetUserId: userId,
    details: { pro_until: newProUntil },
  });
  revalidatePath(`/admin/users/${userId}`);
  return {
    ok: true,
    message: `Pro granted through ${new Date(newProUntil).toLocaleDateString()}.`,
  };
}

/**
 * Grant one inherited-slot credit on the house — repurposed from the
 * pre-rework "extra inherited slot ($5/mo add-on)" tool. The
 * `extra_inherited_slots` column no longer gates redemption anywhere
 * (migration 0107 unbundled inherit slots to a one-time $5 credit
 * model tracked in `inherited_slot_credits`), so this action now
 * increments the credit column that redemption actually consumes.
 *
 * Uses the same `increment_profile_counter` RPC as pack purchases
 * so admin comps flow through the same allowlist + trigger surface
 * as paid grants — no ad-hoc UPDATE that skirts protect_billing_columns.
 */
export async function grantExtraInheritedSlotAction(
  userId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const service = createAdminClient();

  const { error } = await service.rpc("increment_profile_counter", {
    target_user_id: userId,
    counter_name: "inherited_slot_credits",
    delta: 1,
  });

  if (error) {
    console.error(
      `[admin] ${admin.email} FAILED grant inherited slot credit for ${userId}:`,
      error,
    );
    return { ok: false, message: `Failed: ${error.message}` };
  }

  // Read back for a truthful message. Best-effort — if the SELECT fails
  // we still return success since the increment already landed.
  const { data: after } = await service
    .from("profiles")
    .select("inherited_slot_credits")
    .eq("id", userId)
    .maybeSingle<{ inherited_slot_credits: number | null }>();
  const nextCount = after?.inherited_slot_credits ?? null;

  await recordAudit({
    actorUserId: admin.id,
    actorEmail: admin.email ?? null,
    action: "admin_granted_inherited_slot_credit",
    targetUserId: userId,
  });
  revalidatePath(`/admin/users/${userId}`);
  return {
    ok: true,
    message: nextCount !== null
      ? `Inherited slot credit granted — they now have ${nextCount}.`
      : `Inherited slot credit granted.`,
  };
}
