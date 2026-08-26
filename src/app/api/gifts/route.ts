import { NextResponse, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/gifts — the signed-in user's UNCLAIMED admin gifts, oldest
 * first. Both clients call this on dashboard open and show the
 * branded "the team has given you…" moment for the first one.
 * Cookie (web) or Bearer (mobile) auth; RLS scopes to own rows.
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

  const { data } = await supabase
    .from("admin_gifts")
    .select("id, kind, created_at")
    .is("claimed_at", null)
    .order("created_at", { ascending: true })
    .limit(5);

  return NextResponse.json({ gifts: data ?? [] });
}
