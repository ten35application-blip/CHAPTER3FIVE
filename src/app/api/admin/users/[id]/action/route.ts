import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/[id]/action — Bearer-authed twin of the web
 * server actions in src/app/admin/users/[id]/actions.ts. Every action
 * that exists on the web detail page is reachable here; the logic is
 * a verbatim port (including which ones are still intent stubs — the
 * destructive backends land with the audit-log task, TODO(0057)).
 *
 * Body: { action, target_id? }
 *   grant_pro                     — real: extends profiles.pro_until 30d
 *   grant_inherited_slot_credit   — real: +1 via increment_profile_counter RPC
 *   delete_user                   — stub: logs intent, no-op
 *   delete_identity  (target_id = oracle id)  — stub
 *   revoke_inherit_code (target_id = code id) — stub
 *   refund_payment (target_id = payment id)   — stub, needs Stripe wiring
 *
 * Success: { ok: true, message }. Failure: { error, code } with 400/500.
 * Web actions call revalidatePath after mutating; the API skips that —
 * mobile refetches on next screen open.
 */
const USER_ACTIONS = ["grant_pro", "grant_inherited_slot_credit", "delete_user"];
const TARGET_ACTIONS = ["delete_identity", "revoke_inherit_code", "refund_payment"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const service = gate.admin;
  const adminEmail = gate.user.email;
  const { id: userId } = await params;

  let body: { action?: unknown; target_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "bad_json" },
      { status: 400 },
    );
  }
  const action = typeof body.action === "string" ? body.action : "";
  const targetId = typeof body.target_id === "string" ? body.target_id : "";

  if (![...USER_ACTIONS, ...TARGET_ACTIONS].includes(action)) {
    return NextResponse.json(
      { error: `Unknown action "${action}"`, code: "unknown_action" },
      { status: 400 },
    );
  }
  if (TARGET_ACTIONS.includes(action) && !targetId) {
    return NextResponse.json(
      { error: "target_id is required for this action", code: "missing_target" },
      { status: 400 },
    );
  }

  switch (action) {
    // -----------------------------------------------------------------
    // grant_pro — real. Sets profiles.pro_until to 30d out (extends
    // from CURRENT expiration if that's in the future, else from now),
    // plan_source='admin_grant'. Service role bypasses RLS's
    // "users update their own profile" scope.
    // -----------------------------------------------------------------
    case "grant_pro": {
      const { data: existing } = await service
        .from("profiles")
        .select("pro_until")
        .eq("id", userId)
        .maybeSingle<{ pro_until: string | null }>();

      const base = existing?.pro_until
        ? Math.max(Date.now(), new Date(existing.pro_until).getTime())
        : Date.now();
      const newProUntil = new Date(
        base + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { error } = await service
        .from("profiles")
        .update({ pro_until: newProUntil, plan_source: "admin_grant" })
        .eq("id", userId);

      if (error) {
        console.error(
          `[admin] ${adminEmail} FAILED grant Pro for ${userId}:`,
          error,
        );
        return NextResponse.json(
          { error: `Failed: ${error.message}`, code: "db_error" },
          { status: 500 },
        );
      }

      console.log(
        `[admin] ${adminEmail} granted Pro to ${userId} until ${newProUntil}`,
      );
      return NextResponse.json({
        ok: true,
        message: `Pro granted through ${new Date(newProUntil).toLocaleDateString()}.`,
      });
    }

    // -----------------------------------------------------------------
    // grant_inherited_slot_credit — real. +1 inherited_slot_credits via
    // the same increment_profile_counter RPC as pack purchases, so admin
    // comps flow through the same allowlist + trigger surface as paid
    // grants — no ad-hoc UPDATE that skirts protect_billing_columns.
    // -----------------------------------------------------------------
    case "grant_inherited_slot_credit": {
      const { error } = await service.rpc("increment_profile_counter", {
        target_user_id: userId,
        counter_name: "inherited_slot_credits",
        delta: 1,
      });

      if (error) {
        console.error(
          `[admin] ${adminEmail} FAILED grant inherited slot credit for ${userId}:`,
          error,
        );
        return NextResponse.json(
          { error: `Failed: ${error.message}`, code: "db_error" },
          { status: 500 },
        );
      }

      // Read back for a truthful message. Best-effort — if the SELECT
      // fails we still return success since the increment already landed.
      const { data: after } = await service
        .from("profiles")
        .select("inherited_slot_credits")
        .eq("id", userId)
        .maybeSingle<{ inherited_slot_credits: number | null }>();
      const nextCount = after?.inherited_slot_credits ?? null;

      console.log(
        `[admin] ${adminEmail} granted 1 inherited slot credit to ${userId}${
          nextCount !== null ? ` (now ${nextCount})` : ""
        }`,
      );
      return NextResponse.json({
        ok: true,
        message:
          nextCount !== null
            ? `Inherited slot credit granted — they now have ${nextCount}.`
            : `Inherited slot credit granted.`,
      });
    }

    // -----------------------------------------------------------------
    // delete_user — INTENT STUB (matches web). Full implementation:
    // audit row, then auth.admin.deleteUser (FK cascades), or
    // soft-delete first to match the consumer restore flow.
    // -----------------------------------------------------------------
    case "delete_user": {
      console.log(
        `[admin] ${adminEmail} requested DELETE USER ${userId} (stub — no-op)`,
      );
      return NextResponse.json({
        ok: true,
        message:
          "Delete recorded (stub). Destructive backend lands with the audit-log task.",
      });
    }

    // -----------------------------------------------------------------
    // delete_identity — INTENT STUB (matches web). Full implementation:
    // audit row, then soft-delete the oracle (deleted_at = now()) so
    // the grace-period restore path keeps working.
    // -----------------------------------------------------------------
    case "delete_identity": {
      console.log(
        `[admin] ${adminEmail} requested DELETE IDENTITY ${targetId} (stub — no-op)`,
      );
      return NextResponse.json({
        ok: true,
        message: "Identity delete recorded (stub).",
      });
    }

    // -----------------------------------------------------------------
    // revoke_inherit_code — INTENT STUB (matches web). Full
    // implementation: audit row, then inherit_codes.revoked_at = now().
    // Already-redeemed copies stay with their owners.
    // -----------------------------------------------------------------
    case "revoke_inherit_code": {
      console.log(
        `[admin] ${adminEmail} requested REVOKE INHERIT CODE ${targetId} (stub — no-op)`,
      );
      return NextResponse.json({ ok: true, message: "Revoke recorded (stub)." });
    }

    // -----------------------------------------------------------------
    // refund_payment — INTENT STUB (matches web). Full implementation:
    // audit row, then stripe.refunds.create and let the webhook flip
    // payments.status to 'refunded'. Blocked on Stripe billing wiring.
    // -----------------------------------------------------------------
    case "refund_payment": {
      console.log(
        `[admin] ${adminEmail} requested REFUND PAYMENT ${targetId} (stub — no-op)`,
      );
      return NextResponse.json({
        ok: true,
        message: "Refund recorded (stub). Needs Stripe wiring.",
      });
    }
  }

  // Unreachable — the allowlist check above covers every case.
  return NextResponse.json(
    { error: "Unhandled action", code: "unknown_action" },
    { status: 400 },
  );
}
