import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * Group chat orchestration — DISABLED post-reset (2026-06-29).
 *
 * Fable's payment audit (2026-07-28) flagged this as an unbilled
 * fan-out surface: group messages aren't stored in `messages`, so
 * per-user monthly caps + daily rate limits don't count them. Rather
 * than layer cap logic onto dead code (no client surface calls this
 * route anymore), the endpoint now returns 410 Gone.
 *
 * The full orchestration handler (urge judging, farewell lines,
 * cross-replies, etc.) is preserved in git history at the commit
 * before this one. When the group feature is revived it needs a
 * proper billing model — likely counting group_messages as user
 * sends against the monthly cap, or a distinct pack SKU for group
 * turns — before this handler can safely come back online.
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json({ error: "gone" }, { status: 410 });
}
