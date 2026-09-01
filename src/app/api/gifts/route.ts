import { NextResponse, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReferralStatus } from "@/lib/referral";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/gifts — the signed-in user's UNCLAIMED admin gifts, oldest
 * first. Both clients call this on dashboard open and show the
 * branded "the team has given you…" moment for the first one.
 * Cookie (web) or Bearer (mobile) auth; RLS scopes to own rows.
 *
 * SIGNUP PROMOS (Wilson 2026-09-01) ride this same route rather than a
 * new hook: before reading the gift list we try to claim a slot in the
 * running campaign, so a brand-new account is handed its free identity
 * the first time it opens the app. claim_signup_promo is atomic and
 * self-limiting — it hands back NULL when no promo is running, the
 * quota is gone, or this account already took a slot — so calling it
 * on every dashboard open is cheap and safe. Failures are swallowed:
 * a promo hiccup must never break the dashboard.
 *
 * A promo gift also carries the referral code back with it, because
 * the moment that announces the gift is the same moment that asks
 * them to share — Wilson: "instructions right there WITH THE LINK."
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;
  const supabase = bearer
    ? createPlainClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { global: { headers: { Authorization: `Bearer ${bearer}` } } },
      )
    : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser(bearer ?? undefined);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Claim a signup-promo slot if one is running. Server-only RPC.
  try {
    await createAdminClient().rpc("claim_signup_promo", {
      target_user_id: user.id,
    });
  } catch {
    /* no promo, quota gone, or already claimed — nothing to do */
  }

  const { data } = await supabase
    .from("admin_gifts")
    .select("id, kind, created_at, promo_id")
    .is("claimed_at", null)
    .order("created_at", { ascending: true })
    .limit(5);

  const gifts = data ?? [];

  // Promo gifts show the share link inside the same moment.
  let referral: { code: string | null; goal: number } | null = null;
  if (gifts.some((g) => g.promo_id)) {
    try {
      const status = await getReferralStatus(user.id);
      referral = { code: status.code, goal: status.goal };
    } catch {
      /* the moment still works without the link */
    }
  }

  return NextResponse.json({ gifts, referral });
}
