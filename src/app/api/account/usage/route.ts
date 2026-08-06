import { NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import {
  canSendImageForMonthCap,
  canSendMessageForTierCap,
  getPlanTier,
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
  const [messages, images] = await Promise.all([
    canSendMessageForTierCap(supabase, plan),
    canSendImageForMonthCap(supabase, plan),
  ]);

  // Pack-credit balances — billing state, admin read (same posture as
  // getPackCreditBalance; scoped to the caller's own row).
  const { data: credits } = await createAdminClient()
    .from("profiles")
    .select("message_credits, image_credits, plan_source")
    .eq("id", user.id)
    .maybeSingle<{
      message_credits: number | null;
      image_credits: number | null;
      plan_source: string | null;
    }>();

  return NextResponse.json({
    tier: plan.tier,
    unlimited: plan.unlimited === true,
    // Where the paid window came from ("stripe", "admin_grant", null…).
    // The mobile Upgrade screen needs this to stop showing plan cards —
    // and the App Store manage-subscription link — to a web/Stripe
    // subscriber, who RevenueCat has never heard of and who was one tap
    // from paying twice.
    source: credits?.plan_source ?? null,
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
