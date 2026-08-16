import { NextResponse } from "next/server";
import { scheduleAutoPopulate } from "@/lib/subscription/autoPopulate";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import {
  canSendImageForMonthCap,
  canSendMessageForTierCap,
  getPlanTier,
  monthlyUsageCounts,
} from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * "Where am I this month" — the numbers behind the Upgrade screen's
 * usage card (Wilson, 2026-08-06: "from right there people can
 * purchase packs if they want to talk more").
 *
 * The counting machinery has existed since the pack rework — the cap
 * functions have always computed current/limit on every single send —
 * but nothing ever showed the numbers to the user. So the only way to
 * learn where you stood was to hit the wall: a 402 mid-conversation,
 * which in this app can mean mid-conversation with your mother's
 * archive. A visible meter is the kind version, and the pack buttons
 * live two inches below it.
 *
 * Read-only, cheap (two counts + one profile row), Bearer-capable so
 * the phone's Upgrade screen and the web's upgrade page read the same
 * numbers from the same functions that ENFORCE the caps — the meter
 * can never disagree with the wall.
 */
export async function GET(request: Request) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const plan = await getPlanTier(supabase);
  // Unlimited (admin) accounts: the cap gates short-circuit with 0, so
  // count directly for display — the meters then show real numbers
  // with "no limit" instead of vanishing for exactly the accounts that
  // demo the app.
  let messages: { current: number; limit: number };
  let images: { current: number; limit: number };
  if (plan.unlimited) {
    const counts = await monthlyUsageCounts(supabase, user.id);
    messages = { current: counts.messages, limit: 0 };
    images = { current: counts.images, limit: 0 };
  } else {
    const [m, i] = await Promise.all([
      canSendMessageForTierCap(supabase, plan),
      canSendImageForMonthCap(supabase, plan),
    ]);
    messages = m;
    images = i;
  }

  // Pack-credit balances — billing state, admin read (same posture as
  // getPackCreditBalance; scoped to the caller's own row).
  const { data: credits } = await createAdminClient()
    .from("profiles")
    .select("message_credits, image_credits, plan_source, pro_until")
    .eq("id", user.id)
    .maybeSingle<{
      message_credits: number | null;
      image_credits: number | null;
      plan_source: string | null;
      pro_until: string | null;
    }>();

  // Opportunistic self-heal (2026-08-15, atomic-delivery work): if a
  // subscribe-time populate was truncated or partially failed, finish
  // it whenever the subscriber's app checks usage — the upgrade screen
  // polls this right after purchase, making it the natural repair
  // heartbeat. Lock-guarded and count-driven inside, so repeat calls
  // are cheap no-ops.
  if (plan.tier === "basic" || plan.tier === "pro") {
    scheduleAutoPopulate(user.id, plan.tier);
  }

  // Did this subscription already spend its companions on an earlier
  // account? (Someone deleted their account and signed up again; the
  // mint ledger is keyed to the STORE transaction, so it remembers.)
  // Without a word from us they'd sit on a paid, permanently empty
  // dashboard wondering what they bought — silence is the one thing
  // that must never happen after someone pays (Wilson 2026-08-16:
  // "shouldn't that person get that message?").
  let companionsSpentElsewhere = false;
  if (plan.tier === "basic" || plan.tier === "pro") {
    const admin = createAdminClient();
    const { count: owned } = await admin
      .from("oracles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_concierge", false)
      .eq("is_self_archive", false)
      .is("inherited_at", null)
      .is("deleted_at", null);
    if ((owned ?? 0) === 0) {
      const { data: ent } = await admin
        .from("iap_entitlements")
        .select("original_transaction_id")
        .eq("user_id", user.id)
        .in("entitlement_id", ["basic", "pro"])
        .not("original_transaction_id", "is", null)
        .limit(1)
        .maybeSingle<{ original_transaction_id: string | null }>();
      if (ent?.original_transaction_id) {
        const { data: ledger } = await admin
          .from("iap_mint_ledger")
          .select("minted_random")
          .eq("original_transaction_id", ent.original_transaction_id)
          .maybeSingle<{ minted_random: number }>();
        companionsSpentElsewhere = (ledger?.minted_random ?? 0) > 0;
      }
    }
  }

  return NextResponse.json({
    tier: plan.tier,
    unlimited: plan.unlimited === true,
    // Where the paid window came from ("stripe", "admin_grant", null…).
    // The mobile Upgrade screen needs this to stop showing plan cards —
    // and the App Store manage-subscription link — to a web/Stripe
    // subscriber, who RevenueCat has never heard of and who was one tap
    // from paying twice.
    source: credits?.plan_source ?? null,
    /** End of the paid window. Lets the app say "you're on Pro until
     *  August 17" instead of leaving people guessing when a scheduled
     *  downgrade or renewal actually takes effect. */
    period_end: credits?.pro_until ?? null,
    /** True when this subscription's companions were already created on
     *  an account that has since been deleted. The client explains it
     *  rather than showing an empty dashboard. */
    companions_spent_elsewhere: companionsSpentElsewhere,
    messages: {
      used: messages.current,
      limit: messages.limit,
      credits: Math.max(0, credits?.message_credits ?? 0),
    },
    images: {
      used: images.current,
      limit: images.limit,
      credits: Math.max(0, credits?.image_credits ?? 0),
    },
  });
}
