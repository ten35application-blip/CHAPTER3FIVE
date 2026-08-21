import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { getReferralStatus } from "@/lib/referral";

export const runtime = "nodejs";

/**
 * GET /api/referral/status → the referral card's whole state.
 *
 * Returns NUMBERS ONLY — never the accounts behind them. Wilson's
 * rule: "a counter of how many people actually made an account but
 * does not tell them who." Someone's decision to sign up for a grief
 * app is not the referrer's business, even when they were the reason.
 */
export async function GET(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const status = await getReferralStatus(user.id);
  return NextResponse.json(status);
}
