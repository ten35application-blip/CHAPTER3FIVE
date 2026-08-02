import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Beneficiary-claim landing info. Mobile mirror of the web page's
 * server-side load at src/app/legacy/[token]/page.tsx.
 *
 * body: { token: string }
 *
 * Bearer optional. When Bearer is present + valid, `alreadyMine`
 * reflects whether the current user is the claimed_user_id (used to
 * render the "Already yours" state). Anonymous callers get the
 * public state (designated/activated/claimed/notfound) without any
 * personal disclosure.
 *
 * Never reveals whether a token existed — invalid + declined +
 * removed + claimed-by-someone-else all render as notfound. Same
 * posture as the web page.
 */
export async function POST(request: NextRequest) {
  const body = await request
    .json()
    .catch(() => ({}) as { token?: unknown });
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ state: "notfound" });
  }

  const admin = createAdminClient();
  const { data: ben } = await admin
    .from("beneficiaries")
    .select("id, status, name, owner_user_id, claimed_user_id")
    .eq("claim_token", token)
    .maybeSingle<{
      id: string;
      status: string;
      name: string | null;
      owner_user_id: string;
      claimed_user_id: string | null;
    }>();

  if (!ben || ben.status === "declined" || ben.status === "removed") {
    return NextResponse.json({ state: "notfound" });
  }

  // Owner name for the greeting.
  const { data: owner } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", ben.owner_user_id)
    .maybeSingle<{ full_name: string | null }>();
  const ownerName = owner?.full_name ?? null;

  // Already-claimed: only reveal to the person who actually owns the
  // claim. Everyone else sees notfound.
  if (ben.status === "claimed") {
    const { user } = await getRequestAuth(request);
    if (user && ben.claimed_user_id === user.id) {
      return NextResponse.json({
        state: "already_mine",
        owner_name: ownerName,
      });
    }
    return NextResponse.json({ state: "notfound" });
  }

  const isPostMortem = ben.status === "activated";
  return NextResponse.json({
    state: isPostMortem ? "activated" : "designated",
    owner_name: ownerName,
  });
}
