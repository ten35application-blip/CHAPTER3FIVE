import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";

export const runtime = "nodejs";

/**
 * DEV/DEMO admin tool: reset a target user back to Free-tier
 * pre-onboarding state so Wilson can re-walk the demo path from
 * scratch. Companion to /api/admin/dev/grant-pro.
 *
 * Body: { user_id: string }
 * Effect:
 *   1. Soft-deletes every non-concierge / non-inherited oracle
 *      the user owns (respects the concierge exclusion + inherited
 *      copies which were paid for separately).
 *   2. Clears all subscription state on profiles: pro_until,
 *      subscription_tier, stripe_customer_id, stripe_subscription_id,
 *      trial_ends_at, plan_source, extra_oracle_credits, cancel_at_
 *      period_end, subscription_status.
 *   3. Clears auto-populate lifecycle timestamps so a subsequent
 *      grant-pro fires the banner + populate flow again.
 *   4. Clears terms_accepted_at + terms_version_accepted +
 *      onboarding_completed so the user's next sign-in lands on
 *      /agreements again (walk the 8-checkbox screen fresh).
 *   5. Clears first_launch_ai_ack_at so the AI-nature modal fires
 *      on the next Adrian tap.
 *
 * Does NOT delete the auth.users row itself — sign-in still works.
 * Does NOT touch chat_blocks / oracle_reports / message_reports —
 * those are audit records that outlive a demo reset. Delete them
 * manually via SQL if you actually need a truly-fresh slate.
 *
 * Admin-only via requireAdminApi. 404 for signed-in-non-admins.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  let body: { user_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId =
    typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!userId) {
    return NextResponse.json(
      { error: "Missing user_id" },
      { status: 400 },
    );
  }

  const { data: authRes } = await gate.admin.auth.admin.getUserById(userId);
  if (!authRes?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // 1. Soft-delete oracles. Skip concierge (shared row, not owned in
  //    the sense that matters here) + inherited copies (paid for
  //    separately, don't wipe a legit purchase because you're
  //    resetting your own test account).
  const nowIso = new Date().toISOString();
  const { error: oracleErr } = await gate.admin
    .from("oracles")
    .update({ deleted_at: nowIso })
    .eq("user_id", userId)
    .eq("is_concierge", false)
    .is("inherited_at", null)
    .is("deleted_at", null);
  if (oracleErr) {
    console.error(
      `[dev/reset-user] oracle soft-delete failed for ${userId}: ${oracleErr.message}`,
    );
    // Continue — the profile reset is more critical than the
    // per-oracle cleanup. Failed oracles surface via the log.
  }

  // 2-5. Clear all subscription + onboarding + one-time state on
  //      profiles in one round trip. protect_billing_columns +
  //      protect_terms_columns block authenticated writes; admin
  //      bypasses.
  const { error: profileErr } = await gate.admin
    .from("profiles")
    .update({
      pro_until: null,
      subscription_tier: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      trial_ends_at: null,
      plan_source: null,
      extra_oracle_credits: 0,
      cancel_at_period_end: false,
      subscription_status: null,
      auto_populate_started_at: null,
      auto_populate_completed_at: null,
      terms_accepted_at: null,
      terms_version_accepted: null,
      onboarding_completed: false,
      first_launch_ai_ack_at: null,
      updated_at: nowIso,
    })
    .eq("id", userId);
  if (profileErr) {
    console.error(
      `[dev/reset-user] profile reset failed for ${userId}: ${profileErr.message}`,
    );
    return NextResponse.json(
      { error: "reset_failed", details: profileErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    user_id: userId,
    reset: true,
  });
}
