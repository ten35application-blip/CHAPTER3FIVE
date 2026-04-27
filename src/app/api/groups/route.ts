import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_NAME = 80;
const MAX_MEMBERS = 4;
const MIN_MEMBERS = 2;

/**
 * GET — list the user's group rooms (newest first), each with member
 * names + last activity for the picker.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: rooms } = await supabase
    .from("group_rooms")
    .select("id, name, language, created_at, last_message_at")
    .eq("owner_user_id", user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const ids = (rooms ?? []).map((r) => r.id);
  const { data: memberRows } = ids.length
    ? await supabase
        .from("group_room_members")
        .select("room_id, oracle_id, left_at, oracles(name, avatar_url)")
        .in("room_id", ids)
    : { data: [] };

  type OracleStub = { name: string | null; avatar_url: string | null };
  type MemberRow = {
    room_id: string;
    oracle_id: string;
    left_at: string | null;
    oracles: OracleStub | OracleStub[] | null;
  };
  const byRoom = new Map<
    string,
    { name: string | null; avatarUrl: string | null; left: boolean }[]
  >();
  for (const m of (memberRows ?? []) as unknown as MemberRow[]) {
    const o = Array.isArray(m.oracles) ? m.oracles[0] : m.oracles;
    const list = byRoom.get(m.room_id) ?? [];
    list.push({
      name: o?.name ?? null,
      avatarUrl: o?.avatar_url ?? null,
      left: !!m.left_at,
    });
    byRoom.set(m.room_id, list);
  }

  return NextResponse.json({
    rooms: (rooms ?? []).map((r) => ({
      ...r,
      members: byRoom.get(r.id) ?? [],
    })),
  });
}

/**
 * POST — create a new group room with 2–4 of the user's OWN oracles.
 * Inherited / shared archives can't go in groups.
 */
export async function POST(request: NextRequest) {
  let body: { name?: string; language?: string; oracle_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const name = String(body.name ?? "").trim().slice(0, MAX_NAME);
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  const language = body.language === "es" ? "es" : "en";
  const oracleIds = Array.isArray(body.oracle_ids) ? body.oracle_ids : [];
  if (oracleIds.length < MIN_MEMBERS || oracleIds.length > MAX_MEMBERS) {
    return NextResponse.json(
      { error: `Pick ${MIN_MEMBERS}–${MAX_MEMBERS} identities` },
      { status: 400 },
    );
  }

  // Verify the user OWNS every oracle they're trying to put in. This
  // is the gate that keeps inherited / shared archives out of groups.
  const { data: ownedRows } = await supabase
    .from("oracles")
    .select("id, name, avatar_url")
    .in("id", oracleIds)
    .eq("user_id", user.id)
    .is("deleted_at", null);

  const owned = ownedRows ?? [];
  if (owned.length !== oracleIds.length) {
    return NextResponse.json(
      { error: "Group chats can only include identities you created." },
      { status: 403 },
    );
  }

  const { data: room, error: roomErr } = await supabase
    .from("group_rooms")
    .insert({ owner_user_id: user.id, name, language })
    .select("id")
    .single();
  if (roomErr || !room) {
    return NextResponse.json(
      { error: roomErr?.message ?? "Failed to create room" },
      { status: 500 },
    );
  }

  const memberRows = owned.map((o) => ({
    room_id: room.id,
    oracle_id: o.id,
  }));
  const { error: membersErr } = await supabase
    .from("group_room_members")
    .insert(memberRows);
  if (membersErr) {
    return NextResponse.json(
      { error: membersErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: room.id });
}
