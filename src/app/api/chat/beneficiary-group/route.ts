import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Beneficiary-group chat orchestration — DISABLED post-reset
 * (2026-06-29). Same reasoning as `api/chat/group/route.ts`: Fable's
 * payment audit 2026-07-28 flagged it as an unbilled fan-out surface
 * (no monthly cap, no rate limit, messages not counted). Full
 * handler preserved in git history; feature needs a billing model
 * before it comes back online.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: "gone" }, { status: 410 });
}
