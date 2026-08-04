import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
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

  // Cross-device read state (0121): stamp "this thread was open now"
  // so the mobile dashboard + Home Screen widget clear their red dot
  // for this conversation. User-scoped client on purpose — RLS pins
  // the row to auth.uid(), no service role needed. Best-effort: a
  // failed upsert just means the dot lingers one extra open.
  await supabase.from("oracle_read_state").upsert(
    {
      user_id: user.id,
      oracle_id: oracleId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,oracle_id" },
  );

  // Clear the EXPLICIT unread flag too. The dashboard renders a row as
  // unread on (auto_unread OR manually_unread); the upsert above only
  // kills the auto half. Previously manually_unread was cleared ONLY by
  // the stream route, i.e. only if the user SENT something — so a row
  // swiped to "Mark as unread" kept its highlight forever, and merely
  // reading the thread never restored the original color (Wilson
  // 2026-08-03). Mobile markThreadRead does the same. User-scoped
  // client: manually_unread is on the writable column allowlist
  // (migration 0070) and RLS pins the row to its owner.
  await supabase
    .from("oracles")
    .update({ manually_unread: false })
    .eq("id", oracleId)
    .eq("manually_unread", true);

  // Invalidate the dashboard's RSC cache so back-navigation shows the
  // freshly-cleared unread state (Wilson 2026-07-29: "I go into it
  // and leave it and there is STILL the dot"). Without this, the
  // router-cache keeps yesterday's payload and the bold-name signal
  // never clears until a hard refresh.
  revalidatePath("/dashboard");

  return new NextResponse(null, { status: 204 });
}
