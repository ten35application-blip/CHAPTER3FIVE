import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/[id]/action — every admin action against a
 * single user, Bearer-authed and admin-gated via requireAdminApi.
 *
 * Body: { action, target_id? }
 *
 * User-scoped actions (no target_id):
 *   grant_pro                     — +30d pro_until, plan_source='admin_grant'
 *   revoke_pro                    — pro_until=null, plan_source=null
 *   comp                          — pro_until=10y out, plan_source='admin_grant'
 *   uncomp                        — clears the admin-grant permanent Pro only
 *   undelete                      — clears profiles.deleted_at
 *   delete_user                   — soft-delete: profiles.deleted_at = now()
 *   grant_inherited_slot_credit   — +1 via increment_profile_counter RPC
 *   reset_password                — email a password-reset link (deep-links
 *                                    into the mobile app via
 *                                    chapter3fiveapp://auth/update-password)
 *
 * Target-scoped actions (target_id required):
 *   delete_identity (oracle id)   — soft-delete: oracles.deleted_at = now()
 *   revoke_inherit_code (code id) — inherit_codes.revoked_at = now()
 *   refund_payment (payment id)   — Stripe refund; falls back to a
 *                                    "Stripe not wired" message if the
 *                                    server has no Stripe secret yet.
 *
 * Success → { ok:true, message }. Failure → { error, code } with 4xx/5xx.
 *
 * Every mutating branch:
 *   - Uses the service-role client (bypasses RLS + column-write triggers).
 *   - Verifies target ownership when applicable (an oracle / code /
 *     payment must belong to the URL's user_id) so a malicious admin
 *     can't hop targets across users through this endpoint.
 *   - Logs to server logs with the acting admin email. Full audit-log
 *     (0057) still to come; the log line is the interim breadcrumb.
 */

const USER_ACTIONS = [
  "grant_pro",
  "revoke_pro",
  "comp",
  "uncomp",
  "undelete",
  "delete_user",
  "grant_inherited_slot_credit",
  "reset_password",
] as const;
const TARGET_ACTIONS = [
  "delete_identity",
  "revoke_inherit_code",
  "refund_payment",
] as const;
type UserAction = (typeof USER_ACTIONS)[number];
type TargetAction = (typeof TARGET_ACTIONS)[number];
type Action = UserAction | TargetAction;

// Ten years — comped users effectively don't expire. Well past the
// horizon we'd expect this table to be around.
const TEN_YEARS_MS = 10 * 365 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
  const action = typeof body.action === "string" ? (body.action as Action) : ("" as Action);
  const targetId = typeof body.target_id === "string" ? body.target_id : "";

  const isUserAction = (USER_ACTIONS as readonly string[]).includes(action);
  const isTargetAction = (TARGET_ACTIONS as readonly string[]).includes(action);
  if (!isUserAction && !isTargetAction) {
    return NextResponse.json(
      { error: `Unknown action "${action}"`, code: "unknown_action" },
      { status: 400 },
    );
  }
  if (isTargetAction && !targetId) {
    return NextResponse.json(
      { error: "target_id is required for this action", code: "missing_target" },
      { status: 400 },
    );
  }

  switch (action) {
    // ----------------------------------------------------------------
    // User-scoped
    // ----------------------------------------------------------------
    case "grant_pro": {
      const { data: existing } = await service
        .from("profiles")
        .select("pro_until")
        .eq("id", userId)
        .maybeSingle<{ pro_until: string | null }>();
      const base = existing?.pro_until
        ? Math.max(Date.now(), new Date(existing.pro_until).getTime())
        : Date.now();
      const newProUntil = new Date(base + THIRTY_DAYS_MS).toISOString();
      const { error } = await service
        .from("profiles")
        .update({ pro_until: newProUntil, plan_source: "admin_grant" })
        .eq("id", userId);
      if (error) return dbError("grant Pro", error, adminEmail, userId);
      log(adminEmail, `granted Pro to ${userId} until ${newProUntil}`);
      return NextResponse.json({
        ok: true,
        message: `Pro granted through ${new Date(newProUntil).toLocaleDateString()}.`,
      });
    }

    case "revoke_pro": {
      // Terminal for admin grants + trials; the paid-subscription case
      // still needs the Stripe billing portal to cancel (that flips
      // subscription_status and pro_until via webhook). This action
      // clears the admin-facing knobs but never lies about it.
      const { data: existing } = await service
        .from("profiles")
        .select("stripe_subscription_id, plan_source")
        .eq("id", userId)
        .maybeSingle<{
          stripe_subscription_id: string | null;
          plan_source: string | null;
        }>();
      const stripeActive = !!existing?.stripe_subscription_id;
      const { error } = await service
        .from("profiles")
        .update({ pro_until: null, plan_source: null })
        .eq("id", userId);
      if (error) return dbError("revoke Pro", error, adminEmail, userId);
      log(adminEmail, `revoked Pro for ${userId}`);
      return NextResponse.json({
        ok: true,
        message: stripeActive
          ? "Admin grant cleared. NOTE: their Stripe subscription is still active — cancel via the billing portal to fully stop billing."
          : "Pro cleared.",
      });
    }

    case "comp": {
      const newProUntil = new Date(Date.now() + TEN_YEARS_MS).toISOString();
      const { error } = await service
        .from("profiles")
        .update({ pro_until: newProUntil, plan_source: "admin_grant" })
        .eq("id", userId);
      if (error) return dbError("comp user", error, adminEmail, userId);
      log(adminEmail, `comped ${userId} through ${newProUntil}`);
      return NextResponse.json({
        ok: true,
        message: `Comped. Pro through ${new Date(newProUntil).toLocaleDateString()}.`,
      });
    }

    case "uncomp": {
      // Only clears rows that were comped (plan_source='admin_grant').
      // Paid subs are untouched — those are managed by Stripe.
      const { data: existing } = await service
        .from("profiles")
        .select("plan_source")
        .eq("id", userId)
        .maybeSingle<{ plan_source: string | null }>();
      if (existing?.plan_source !== "admin_grant") {
        return NextResponse.json({
          ok: true,
          message: "This user isn't comped. No changes.",
        });
      }
      const { error } = await service
        .from("profiles")
        .update({ pro_until: null, plan_source: null })
        .eq("id", userId);
      if (error) return dbError("uncomp user", error, adminEmail, userId);
      log(adminEmail, `uncomped ${userId}`);
      return NextResponse.json({ ok: true, message: "Comp removed." });
    }

    case "undelete": {
      const { error } = await service
        .from("profiles")
        .update({ deleted_at: null })
        .eq("id", userId);
      if (error) return dbError("undelete user", error, adminEmail, userId);
      log(adminEmail, `undeleted ${userId}`);
      return NextResponse.json({ ok: true, message: "Account restored." });
    }

    case "delete_user": {
      // Soft-delete matches the consumer flow — cleared later by the
      // 30-day purge cron. Hard-delete stays out of the admin surface
      // by design; it lives behind the audit-log task.
      const { error } = await service
        .from("profiles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) return dbError("soft-delete user", error, adminEmail, userId);
      log(adminEmail, `soft-deleted ${userId}`);
      return NextResponse.json({
        ok: true,
        message: "Account soft-deleted. They'll be signed out on next open. Undelete within 30 days to restore.",
      });
    }

    case "grant_inherited_slot_credit": {
      const { error } = await service.rpc("increment_profile_counter", {
        target_user_id: userId,
        counter_name: "inherited_slot_credits",
        delta: 1,
      });
      if (error) return dbError("grant inherit slot", error, adminEmail, userId);
      const { data: after } = await service
        .from("profiles")
        .select("inherited_slot_credits")
        .eq("id", userId)
        .maybeSingle<{ inherited_slot_credits: number | null }>();
      const next = after?.inherited_slot_credits ?? null;
      log(
        adminEmail,
        `granted +1 inherit slot to ${userId}${next !== null ? ` (now ${next})` : ""}`,
      );
      return NextResponse.json({
        ok: true,
        message:
          next !== null
            ? `Slot credit granted — they now have ${next}.`
            : "Slot credit granted.",
      });
    }

    case "reset_password": {
      // Uses the same auth call the mobile signin uses. redirectTo
      // deep-links into the app so admin-triggered resets land on
      // the in-app update-password screen — no browser detour.
      // Email lives on auth.users (profiles has no email column).
      const { data: authUser } = await service.auth.admin.getUserById(userId);
      const email = authUser?.user?.email ?? null;
      if (!email) {
        return NextResponse.json(
          { error: "That user has no email on file.", code: "no_email" },
          { status: 400 },
        );
      }
      const { error } = await service.auth.resetPasswordForEmail(email, {
        redirectTo: "chapter3fiveapp://auth/update-password",
      });
      if (error) {
        console.error(
          `[admin] ${adminEmail} FAILED reset password for ${email}:`,
          error,
        );
        return NextResponse.json(
          { error: `Failed: ${error.message}`, code: "auth_error" },
          { status: 500 },
        );
      }
      log(adminEmail, `sent password reset to ${email}`);
      return NextResponse.json({
        ok: true,
        message: `Reset link sent to ${email}.`,
      });
    }

    // ----------------------------------------------------------------
    // Target-scoped — ownership check first so a bad target_id can't
    // reach across users.
    // ----------------------------------------------------------------
    case "delete_identity": {
      const { data: oracle } = await service
        .from("oracles")
        .select("id, user_id, deleted_at")
        .eq("id", targetId)
        .maybeSingle<{
          id: string;
          user_id: string;
          deleted_at: string | null;
        }>();
      if (!oracle || oracle.user_id !== userId) {
        return NextResponse.json(
          {
            error: "That identity isn't owned by this user.",
            code: "wrong_owner",
          },
          { status: 404 },
        );
      }
      if (oracle.deleted_at) {
        return NextResponse.json({
          ok: true,
          message: "Identity was already deleted.",
        });
      }
      const { error } = await service
        .from("oracles")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", targetId);
      if (error) return dbError("delete identity", error, adminEmail, targetId);
      log(adminEmail, `soft-deleted oracle ${targetId} (owner ${userId})`);
      return NextResponse.json({
        ok: true,
        message: "Identity soft-deleted (30-day recover window).",
      });
    }

    case "revoke_inherit_code": {
      const { data: code } = await service
        .from("inherit_codes")
        .select("id, user_id, revoked_at, code")
        .eq("id", targetId)
        .maybeSingle<{
          id: string;
          user_id: string;
          revoked_at: string | null;
          code: string;
        }>();
      if (!code || code.user_id !== userId) {
        return NextResponse.json(
          { error: "That code isn't owned by this user.", code: "wrong_owner" },
          { status: 404 },
        );
      }
      if (code.revoked_at) {
        return NextResponse.json({
          ok: true,
          message: "Code was already revoked.",
        });
      }
      const { error } = await service
        .from("inherit_codes")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", targetId);
      if (error) return dbError("revoke code", error, adminEmail, targetId);
      log(adminEmail, `revoked inherit code ${code.code} (owner ${userId})`);
      return NextResponse.json({
        ok: true,
        message: `Code ${code.code} revoked. Existing redeemed copies stay with their owners.`,
      });
    }

    case "refund_payment": {
      const { data: payment } = await service
        .from("payments")
        .select("id, user_id, amount_cents, status, stripe_payment_intent_id")
        .eq("id", targetId)
        .maybeSingle<{
          id: string;
          user_id: string;
          amount_cents: number;
          status: string;
          stripe_payment_intent_id: string | null;
        }>();
      if (!payment || payment.user_id !== userId) {
        return NextResponse.json(
          {
            error: "That payment isn't attached to this user.",
            code: "wrong_owner",
          },
          { status: 404 },
        );
      }
      if (payment.status === "refunded") {
        return NextResponse.json({
          ok: true,
          message: "Payment was already refunded.",
        });
      }
      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecret) {
        log(adminEmail, `refund attempted for ${targetId} but Stripe not wired`);
        return NextResponse.json(
          {
            error:
              "Stripe billing isn't wired yet, so the refund can't be issued through the API.",
            code: "stripe_not_wired",
          },
          { status: 503 },
        );
      }
      if (!payment.stripe_payment_intent_id) {
        return NextResponse.json(
          {
            error:
              "This payment row has no Stripe PaymentIntent id — nothing to refund.",
            code: "no_stripe_ref",
          },
          { status: 400 },
        );
      }
      // Late import so bundle size / cold-start doesn't pay for
      // Stripe on every admin route.
      try {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(stripeSecret);
        await stripe.refunds.create({
          payment_intent: payment.stripe_payment_intent_id,
        });
        // Status is authoritatively flipped by the Stripe webhook;
        // reflect the intent immediately so the admin UI updates
        // without waiting for webhook propagation.
        await service
          .from("payments")
          .update({ status: "refunded" })
          .eq("id", targetId);
        log(adminEmail, `refunded payment ${targetId}`);
        return NextResponse.json({
          ok: true,
          message: "Refund issued via Stripe.",
        });
      } catch (err) {
        console.error(
          `[admin] ${adminEmail} FAILED refund for ${targetId}:`,
          err,
        );
        return NextResponse.json(
          {
            error: err instanceof Error ? err.message : "Refund failed.",
            code: "stripe_error",
          },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json(
    { error: "Unhandled action", code: "unknown_action" },
    { status: 400 },
  );
}

function log(adminEmail: string | undefined, msg: string) {
  console.log(`[admin] ${adminEmail ?? "?"} ${msg}`);
}

function dbError(
  verb: string,
  err: { message?: string },
  adminEmail: string | undefined,
  target: string,
) {
  console.error(`[admin] ${adminEmail ?? "?"} FAILED ${verb} for ${target}:`, err);
  return NextResponse.json(
    { error: `Failed: ${err.message ?? "db error"}`, code: "db_error" },
    { status: 500 },
  );
}
