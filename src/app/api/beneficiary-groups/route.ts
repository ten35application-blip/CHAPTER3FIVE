import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_NAME = 80;

/**
 * GET — list rooms the caller is a member of, grouped by archive.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = createAdminClient();
  const { data: memberRows } = await admin
    .from("beneficiary_room_members")
    .select("room_id")
    .eq("user_id", user.id)
    .is("left_at", null);

  const roomIds = (memberRows ?? []).map((r) => r.room_id);
  if (roomIds.length === 0) {
    return NextResponse.json({ rooms: [] });
  }

  const { data: rooms } = await admin
    .from("beneficiary_rooms")
    .select("id, oracle_id, name, language, created_at, last_message_at")
    .in("id", roomIds)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const oracleIds = Array.from(
    new Set((rooms ?? []).map((r) => r.oracle_id)),
  );
  const { data: oracles } = oracleIds.length
    ? await admin
        .from("oracles")
        .select("id, name, avatar_url")
        .in("id", oracleIds)
    : { data: [] };
  const oracleMap = new Map((oracles ?? []).map((o) => [o.id, o]));

  return NextResponse.json({
    rooms: (rooms ?? []).map((r) => ({
      ...r,
      oracleName: oracleMap.get(r.oracle_id)?.name ?? null,
      oracleAvatar: oracleMap.get(r.oracle_id)?.avatar_url ?? null,
    })),
  });
}

/**
 * POST — create a beneficiary room for an archive the caller has a
 * grant on. Adds the caller + (optionally) other beneficiaries
 * specified by user_id who ALSO have grants on the same archive.
 */
export async function POST(request: NextRequest) {
  let body: { oracle_id?: string; name?: string; member_user_ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const oracleId = String(body.oracle_id ?? "").trim();
  const name = String(body.name ?? "").trim().slice(0, MAX_NAME);
  if (!oracleId || !name) {
    return NextResponse.json({ error: "Missing oracle_id or name" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The caller must have an archive_grant on this oracle.
  const { data: callerGrant } = await admin
    .from("archive_grants")
    .select("oracle_id")
    .eq("oracle_id", oracleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!callerGrant) {
    return NextResponse.json(
      { error: "You don't have access to this archive." },
      { status: 403 },
    );
  }

  // Owner deceased check — beneficiary rooms only exist for archives
  // whose owner has passed. Living archives stay 1:1.
  const { data: oracle } = await admin
    .from("oracles")
    .select("id, name, user_id, preferred_language")
    .eq("id", oracleId)
    .maybeSingle();
  if (!oracle) {
    return NextResponse.json({ error: "Archive not found" }, { status: 404 });
  }
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("deceased_at")
    .eq("id", oracle.user_id)
    .maybeSingle();
  if (!ownerProfile?.deceased_at) {
    return NextResponse.json(
      {
        error:
          "Beneficiary rooms are only for archives whose owner has passed. While they're alive, conversations stay 1:1.",
      },
      { status: 403 },
    );
  }

  // Validate any additional members — must also be grant-holders.
  const otherIds = (Array.isArray(body.member_user_ids)
    ? body.member_user_ids
    : []
  )
    .filter((id): id is string => typeof id === "string" && id !== user.id);

  if (otherIds.length > 0) {
    const { data: otherGrants } = await admin
      .from("archive_grants")
      .select("user_id")
      .eq("oracle_id", oracleId)
      .in("user_id", otherIds);
    const validOtherIds = new Set(
      (otherGrants ?? []).map((g) => g.user_id),
    );
    if (validOtherIds.size !== otherIds.length) {
      return NextResponse.json(
        { error: "All members must already have access to this archive." },
        { status: 403 },
      );
    }
  }

  const language = (oracle.preferred_language ?? "en") as "en" | "es";

  const { data: room, error: roomErr } = await admin
    .from("beneficiary_rooms")
    .insert({
      oracle_id: oracleId,
      created_by_user_id: user.id,
      name,
      language,
    })
    .select("id")
    .single();
  if (roomErr || !room) {
    return NextResponse.json(
      { error: roomErr?.message ?? "Failed to create room" },
      { status: 500 },
    );
  }

  const memberRows = [
    { room_id: room.id, user_id: user.id },
    ...otherIds.map((id) => ({ room_id: room.id, user_id: id })),
  ];
  const { error: membersErr } = await admin
    .from("beneficiary_room_members")
    .insert(memberRows);
  if (membersErr) {
    return NextResponse.json({ error: membersErr.message }, { status: 500 });
  }

  return NextResponse.json({ id: room.id });
}
