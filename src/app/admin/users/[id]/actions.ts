"use server";

import { requireAdmin } from "@/lib/admin/guard";

/**
 * Admin actions — INTENT STUBS. Each verifies the caller is an admin,
 * logs the intent server-side, and returns a success message so the UI
 * flow exists end-to-end. The destructive backends are a follow-up task.
 *
 * TODO(0057): when these go live, add supabase/migrations/0057_admin_audit.sql
 * (admin_actions: id, admin_user_id, action_type, target_user_id,
 * target_resource_id, metadata jsonb, created_at; RLS locked to
 * service-role) and insert an audit row inside each action before the
 * destructive call.
 */

export type ActionResult = { ok: boolean; message: string };

export async function deleteUserAction(userId: string): Promise<ActionResult> {
  const admin = await requireAdmin();

  // Full implementation:
  //   1. Insert admin_actions audit row (action_type: 'delete_user').
  //   2. createAdminClient().auth.admin.deleteUser(userId) — FK cascades
  //      wipe profiles, oracles, messages, payments, inherit_codes, etc.
  //      (all reference auth.users on delete cascade).
  //   3. Consider soft-delete first (profiles.deleted_at, 0024 grace
  //      period) instead of a hard GoTrue delete, to match the consumer
  //      restore flow.
  //   4. revalidatePath('/admin/users').
  console.log(
    `[admin] ${admin.email} requested DELETE USER ${userId} (stub — no-op)`,
  );
  return {
    ok: true,
    message: "Delete recorded (stub). Destructive backend lands with the audit-log task.",
  };
}

export async function deleteIdentityAction(
  oracleId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  // Full implementation: audit row, then soft-delete the oracle the same
  // way the consumer flow does (set oracles.deleted_at = now()) so the
  // grace-period restore path keeps working; then revalidatePath.
  console.log(
    `[admin] ${admin.email} requested DELETE IDENTITY ${oracleId} (stub — no-op)`,
  );
  return { ok: true, message: "Identity delete recorded (stub)." };
}

export async function revokeInheritCodeAction(
  codeId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  // Full implementation: audit row, then set inherit_codes.revoked_at =
  // now() via the service-role client. Existing oracle_shares rows stay —
  // revocation stops NEW redemptions only (matches the consumer model).
  console.log(
    `[admin] ${admin.email} requested REVOKE INHERIT CODE ${codeId} (stub — no-op)`,
  );
  return { ok: true, message: "Revoke recorded (stub)." };
}

export async function refundPaymentAction(
  paymentId: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();

  // Full implementation: audit row, then stripe.refunds.create({
  // payment_intent: payments.stripe_payment_intent_id }) and let the
  // webhook flip payments.status to 'refunded'. Blocked on Stripe billing
  // being wired.
  console.log(
    `[admin] ${admin.email} requested REFUND PAYMENT ${paymentId} (stub — no-op)`,
  );
  return { ok: true, message: "Refund recorded (stub). Needs Stripe wiring." };
}
