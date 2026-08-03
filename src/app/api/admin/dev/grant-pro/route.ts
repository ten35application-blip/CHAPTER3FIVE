import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { scheduleAutoPopulate } from "@/lib/subscription/autoPopulate";

export const runtime = "nodejs";
// Same headroom as the Stripe + RevenueCat webhooks — the auto-
// populate helper the endpoint fires runs the same Anthropic +
// Replicate chain in after() and can take up to a few minutes.
export const maxDuration = 300;

/**
 * DEV/DEMO admin tool: promote a target user to Basic or Pro AND
 * fire the same auto-populate helper that the Stripe + RevenueCat
 * webhooks fire. Wilson uses this to test the full "pay → circle
 * fills" flow without actually paying — repeatable across demo
 * runs. Companion to /api/admin/dev/reset-user which unwinds the
 * grant + wipes the circle.
 *
 * Admin-only via requireAdminApi (allowlist email; 404 for
 * signed-in-non-admins so the path never reveals it exists).
 *
 * Body: { user_id: string, tier: "basic" | "pro" }
 * Effect:
 *   1. Stamps profiles.pro_until = now + 1 year (well past any demo
 *      window), profiles.subscription_tier = tier, plan_source =
 *      "admin_grant". protect_billing_columns (0087+) blocks
 *      authenticated writes to these; admin client bypasses.
 *   2. Fires scheduleAutoPopulate(user_id, tier) inside after().
 *      Basic → 2 randoms + 1 photo placeholder. Pro → 4 + 1.
 *      Idempotent — a re-grant to a user with a full circle no-ops.
 *
 * Not for production billing paths — real subscriptions run
 * through the Stripe / RevenueCat webhooks with real dollar
 * amounts. This endpoint bypasses all of that and only exists so
 * the demo path is exercisable without a real payment.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  let body: { user_id?: unknown; tier?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId =
    typeof body.user_id === "string" ? body.user_id.trim() : "";
  const tierRaw =
    typeof body.tier === "string" ? body.tier.trim().toLowerCase() : "";
  const tier: "basic" | "pro" | null =
    tierRaw === "basic" || tierRaw === "pro" ? tierRaw : null;
  if (!userId || !tier) {
    return NextResponse.json(
      { error: "Missing or invalid user_id / tier ('basic' | 'pro')" },
      { status: 400 },
    );
  }

  // Verify the target user actually exists — admin.auth.admin
  // .getUserById is the cheapest lookup that fails clean on unknown
  // ids (returns { user: null } rather than throwing).
  const { data: authRes } = await gate.admin.auth.admin.getUserById(userId);
  if (!authRes?.user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // 1 year of Pro — well past any demo window. plan_source =
  // "admin_grant" so canCreateOracle's isBasicUser check exempts
  // this grant from the Basic-tier ceiling (admin_grants stay on
  // Pro ceiling by intent).
  const oneYearOut = new Date(
    Date.now() + 365 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error: updateErr } = await gate.admin
    .from("profiles")
    .update({
      pro_until: oneYearOut,
      subscription_tier: tier,
      plan_source: "admin_grant",
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (updateErr) {
    console.error(
      `[dev/grant-pro] profile update failed for ${userId}: ${updateErr.message}`,
    );
    return NextResponse.json(
      { error: "grant_failed", details: updateErr.message },
      { status: 500 },
    );
  }

  scheduleAutoPopulate(userId, tier);

  return NextResponse.json({
    ok: true,
    user_id: userId,
    tier,
    pro_until: oneYearOut,
    auto_populate: "scheduled",
  });
}
