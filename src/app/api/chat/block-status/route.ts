import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lightweight read for the Chat component to know whether the
 * persona has stepped out of this conversation. Returns
 * { blocked: false } or { blocked: true, blocked_until, severity }.
 */
export async function GET(request: NextRequest) {
  const oracleId = request.nextUrl.searchParams.get("oracle_id");
  if (!oracleId || !UUID_RE.test(oracleId)) {
    return NextResponse.json({ blocked: false });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ blocked: false });

  const admin = createAdminClient();
  const { data } = await admin
    .from("chat_blocks")
    .select("blocked_until, severity")
    .eq("oracle_id", oracleId)
    .eq("user_id", user.id)
    .is("unblocked_at", null)
    .order("blocked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return NextResponse.json({ blocked: false });
  return NextResponse.json({
    blocked: true,
    blocked_until: data.blocked_until,
    severity: data.severity,
  });
}
