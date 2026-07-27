import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";
import { ensureAdrianAvatar } from "@/lib/faces/adrian";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Manual admin trigger for Adrian's avatar. Forces regeneration on
 * every hit so re-runs iterate on the Flux prompt / seed rather than
 * short-circuiting on the idempotency guard. The zero-touch path
 * (lazy trigger on dashboard load, see dashboard/page.tsx) covers the
 * general case; this route is for when Wilson wants a specific re-roll.
 */
export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const result = await ensureAdrianAvatar({ force: true });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: result.url });
}
