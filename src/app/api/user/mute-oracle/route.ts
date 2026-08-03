import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";

/**
 * User blocks/unblocks a persona from initiating contact. Adds (or
 * removes) an entry to profiles.muted_conversations (jsonb array of
 * `{kind, id}` — the schema the persona-outreach + proactive crons
 * already read at 0047_profile_muted.sql). App Store 1.2 and Play
 * UGC both expect a "Block" affordance on a UGC/messaging app; this
 * is chapter3five's version — the user tells the persona to stop
 * reaching out, and the block is reversible.
 *
 * In a 1:1 companion app "block" means "the other party stops
 * contacting me." User-initiated chat is still available if the
 * user chooses to open the thread — same as unblocking then
 * messaging on iMessage would enable. Muting doesn't hide the
 * identity or delete anything; the user can undo without side
 * effects.
 *
 * Auth: cookie OR Bearer (both surfaces call this). RLS on profiles
 * scopes the update to the caller's own row (id = auth.uid()). The
 * column grant in 0116 already allows authenticated updates to
 * muted_conversations.
 */

type MuteEntry = { kind: string; id: string };

export async function POST(request: NextRequest) {
  return mutate(request, "add");
}

export async function DELETE(request: NextRequest) {
  return mutate(request, "remove");
}

async function mutate(
  request: NextRequest,
  op: "add" | "remove",
): Promise<NextResponse> {
  let payload: { oracle_id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const oracleId =
    typeof payload.oracle_id === "string" ? payload.oracle_id.trim() : "";
  if (!oracleId) {
    return NextResponse.json({ error: "Missing oracle_id" }, { status: 400 });
  }

  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Read-modify-write. Race window is negligible — mute state is
  // per-user, single-user; no realistic concurrent-writer scenario.
  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("muted_conversations")
    .eq("id", user.id)
    .maybeSingle<{ muted_conversations: unknown }>();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const current = Array.isArray(profile?.muted_conversations)
    ? (profile.muted_conversations as unknown[]).filter(
        (e): e is MuteEntry =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as MuteEntry).kind === "string" &&
          typeof (e as MuteEntry).id === "string",
      )
    : [];

  const alreadyMuted = current.some(
    (e) => e.kind === "oracle" && e.id === oracleId,
  );
  let next: MuteEntry[] = current;
  if (op === "add") {
    if (alreadyMuted) {
      return NextResponse.json({ ok: true, muted: true });
    }
    next = [...current, { kind: "oracle", id: oracleId }];
  } else {
    if (!alreadyMuted) {
      return NextResponse.json({ ok: true, muted: false });
    }
    next = current.filter(
      (e) => !(e.kind === "oracle" && e.id === oracleId),
    );
  }

  const { error: writeErr } = await supabase
    .from("profiles")
    .update({ muted_conversations: next })
    .eq("id", user.id);
  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, muted: op === "add" });
}
