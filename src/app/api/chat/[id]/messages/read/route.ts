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
    .is("deleted_at", null)
    // Neither do delayed replies that haven't "arrived" — a read
    // stamp on a message the user has never seen is a tripwire for
    // whoever reads read_at next.
    .or(`visible_at.is.null,visible_at.lte.${new Date().toISOString()}`);

  // Cross-device read state (0121): stamp "this thread was open now"
  // so the mobile dashboard + Home Screen widget clear their red dot
  // for this conversation. User-scoped client on purpose — RLS pins
  // the row to auth.uid(), no service role needed. Best-effort: a
  // failed upsert just means the dot lingers one extra open.
  // Via the RPC (migration 0128) so both surfaces stamp from the SAME
  // clock — the database's. This route was already correct (Node's now
  // is the server's now), but mobile was writing a handset timestamp,
  // and two surfaces computing "read" from two different clocks is
  // exactly the drift that made a thread stay unread forever on a
  // phone running behind. One code path, one clock.
  await supabase.rpc("mark_thread_read", { p_oracle_id: oracleId });

  // NOTE — deliberately does NOT clear `oracles.manually_unread`.
  //
  // A 2026-08-03 pass added that clear here, on the theory that a row
  // marked unread stayed highlighted forever because only the stream
  // route (i.e. SENDING) ever reset it. That theory was wrong on two
  // counts, both confirmed by audit:
  //
  //   1. Nothing in either codebase ever sets manually_unread to TRUE.
  //      `markUnread` in dashboard/actions.ts is exported and never
  //      imported; mobile's row swipes are Archive and Delete only. So
  //      the clear matched zero rows on every conversation open,
  //      forever — pure round-trip cost.
  //   2. Clearing it on OPEN breaks stream/route.ts:397, which reads
  //      manually_unread on SEND to build the persona's "you flagged me
  //      to come back to" acknowledgment. Opening might just be
  //      reviewing; sending means the thread is genuinely re-engaged.
  //      That distinction is the whole point, and an open-time clear
  //      erases the flag before the stream route can ever see it.
  //
  // The real gap is upstream: there is no Mark-as-unread affordance on
  // either surface. Wire that first; this route stays out of it.

  // Invalidate the dashboard's RSC cache so back-navigation shows the
  // freshly-cleared unread state (Wilson 2026-07-29: "I go into it
  // and leave it and there is STILL the dot"). Without this, the
  // router-cache keeps yesterday's payload and the bold-name signal
  // never clears until a hard refresh.
  revalidatePath("/dashboard");

  return new NextResponse(null, { status: 204 });
}
