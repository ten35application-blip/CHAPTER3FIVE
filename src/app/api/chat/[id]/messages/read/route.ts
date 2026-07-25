import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Mark all of this persona's messages in the caller's thread as read.
 *
 * Called by ChatSurface on mount (the user is looking at the thread)
 * and again after each streamed reply completes. Server-side write via
 * the service role — users have no UPDATE policy on messages, which is
 * intentional; the ownership check below is the gate.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: oracleId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Visibility via RLS (owner from 0002, shares from 0055) doubles as
  // the authorization check.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id")
    .eq("id", oracleId)
    .maybeSingle();
  if (!oracle) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  await admin
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("oracle_id", oracleId)
    .eq("user_id", user.id)
    .eq("role", "assistant")
    .is("read_at", null)
    // Soft-deleted messages don't render; don't touch their receipts.
    .is("deleted_at", null);

  return new NextResponse(null, { status: 204 });
}
