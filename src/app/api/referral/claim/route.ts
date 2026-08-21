import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { claimReferral } from "@/lib/referral";

export const runtime = "nodejs";

/**
 * POST /api/referral/claim { code } — called once, right after a new
 * account is created, when the signup carried a ?ref= code.
 *
 * Always answers ok. Whether the referral stuck is none of the new
 * user's concern, and a rejected code (unknown, self-referral, already
 * referred) must never make someone's first minute in the app feel
 * like a failure.
 */
export async function POST(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}) as { code?: unknown });
  const code = typeof body.code === "string" ? body.code : "";
  if (code) await claimReferral(code, user.id);
  return NextResponse.json({ ok: true });
}
