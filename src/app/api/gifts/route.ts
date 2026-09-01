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
  // supabase-js returns errors IN-BAND — a try/catch alone would let a
  // broken RPC grant nothing forever with zero logs (audit 2026-09-01).
  const admin = createAdminClient();
  try {
    const { error: promoErr } = await admin.rpc("claim_signup_promo", {
      target_user_id: user.id,
    });
    if (promoErr) console.error("[gifts] claim_signup_promo failed:", promoErr);
  } catch (err) {
    console.error("[gifts] claim_signup_promo threw:", err);
  }

  // THE HEAL (audit 2026-09-01, born from a live 502 mid-mint): the
  // companion pipeline can die between the claimed_at stamp and the
  // reveal — deploy, timeout, Replicate slowness — and the user's gift
  // would be silently lost, because every other heal path (adoptOrphan,
  // the redeem stranded-pass) deliberately skips reward companions.
  // This runs on the surface a gift recipient ALWAYS returns to.
  try {
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: rewards } = await admin
      .from("oracles")
      .select("id, provisioning, persona_prompt, created_at")
      .eq("user_id", user.id)
      .eq("is_referral_reward", true)
      .is("deleted_at", null);
    for (const o of rewards ?? []) {
      if (!o.provisioning || o.created_at >= cutoff) continue;
      if (o.persona_prompt) {
        // Persona exists — reveal it (a missing portrait is degraded,
        // not lost; the face can be regenerated later).
        await admin.from("oracles").update({ provisioning: false }).eq("id", o.id);
      } else {
        // Died before the persona — this row can never speak. Clear it
        // so the re-offered gift can mint clean.
        await admin.from("oracles").delete().eq("id", o.id);
      }
    }
    // A claimed PROMO gift with NO reward companion at all = the mint
    // died before the insert. Un-claim it so the moment re-offers.
    const { count: liveRewards } = await admin
      .from("oracles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_referral_reward", true)
      .is("deleted_at", null);
    if ((liveRewards ?? 0) === 0) {
      const { error: healErr } = await admin
        .from("admin_gifts")
        .update({ claimed_at: null })
        .eq("user_id", user.id)
        .eq("kind", "companion")
        .not("promo_id", "is", null)
        .not("claimed_at", "is", null)
        .lt("claimed_at", cutoff);
      if (healErr) console.error("[gifts] heal unclaim failed:", healErr);
    }
  } catch (err) {
    console.error("[gifts] stranded-gift heal threw:", err);
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
