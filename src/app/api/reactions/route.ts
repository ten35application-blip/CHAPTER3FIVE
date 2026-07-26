import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Toggle a user's tapback reaction on a message.
 *
 *   POST /api/reactions
 *     body: { message_id, kind }
 *     - kind === current stored reaction → delete (untap)
 *     - kind !== current stored reaction → replace (change)
 *     - no current reaction               → insert (add)
 *
 * RLS (0077) enforces reporter/message ownership; a malicious client
 * can't react on someone else's thread. The upsert path uses INSERT
 * with ON CONFLICT — the (message_id, user_id) partial unique index
 * gates it to one reaction per user per message.
 *
 * Returns: { ok: true, reaction: 'heart' | ... | null }
 * (null when the row was deleted by a same-kind toggle.)
 */
const KINDS = new Set([
  "heart",
  "exclamation",
  "thumbs_up",
  "thumbs_down",
  "question",
  "ha_ha",
]);

export async function POST(request: NextRequest) {
  let payload: { message_id?: string; kind?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messageId = String(payload.message_id ?? "").trim();
  const kind = String(payload.kind ?? "").trim();

  if (!messageId) {
    return NextResponse.json({ error: "Missing message_id" }, { status: 400 });
  }
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Read the existing reaction (if any) so we know whether this tap is
  // a delete (same kind) or a replace (different kind). One round-trip
  // avoided by the partial unique index would be nice but Postgres
  // doesn't let us CONFLICT on partial-index columns cleanly in
  // supabase-js; a small select+branch is clearer.
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id, kind")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string; kind: string }>();

  // Helper: read the CURRENT stored reaction for this (message, user)
  // pair and shape it as an error response. Any time an operation
  // fails we send this so the client can re-sync its optimistic state
  // to reality — critical for the change-of-kind path (DELETE then
  // INSERT) where an interrupted second step could leave the DB with
  // no reaction while the client rolls back to the OLD one.
  async function currentReaction(): Promise<string | null> {
    const { data } = await supabase
      .from("message_reactions")
      .select("kind")
      .eq("message_id", messageId)
      .eq("user_id", user!.id)
      .maybeSingle<{ kind: string }>();
    return data?.kind ?? null;
  }

  if (existing && existing.kind === kind) {
    // Same tap twice = untap.
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", existing.id);
    if (error) {
      if (error.code === "42501") {
        return NextResponse.json({ error: "not_your_message" }, { status: 403 });
      }
      return NextResponse.json(
        { error: error.message, reaction: await currentReaction() },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, reaction: null });
  }

  if (existing) {
    // Different kind = replace: delete old + insert new.
    const { error: delErr } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", existing.id);
    if (delErr) {
      return NextResponse.json(
        { error: delErr.message, reaction: await currentReaction() },
        { status: 500 },
      );
    }
  }

  const { error: insErr } = await supabase.from("message_reactions").insert({
    message_id: messageId,
    user_id: user.id,
    kind,
  });
  if (insErr) {
    if (insErr.code === "42501") {
      return NextResponse.json({ error: "not_your_message" }, { status: 403 });
    }
    // Includes the 23505 unique-violation path — the DB is authoritative;
    // return whatever's actually stored so the client stops guessing.
    return NextResponse.json(
      { error: insErr.message, reaction: await currentReaction() },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, reaction: kind });
}
