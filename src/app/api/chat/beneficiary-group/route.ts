import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateBeneficiaryReply,
  type BeneficiaryRoomTurn,
  type BeneficiaryRoomContext,
} from "@/lib/beneficiaryGroup";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 4000;
const RECENT_HISTORY_LIMIT = 30;

/**
 * Beneficiary group orchestration. User message → persona reply (with
 * possible multi-message burst). The persona is the deceased archive
 * (memorial mode forced). Reply is broadcast via realtime to all
 * room members.
 */
export async function POST(request: NextRequest) {
  let body: { room_id?: string; message?: string };
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

  const roomId = String(body.room_id ?? "").trim();
  const message = String(body.message ?? "").trim();
  if (!roomId || !message) {
    return NextResponse.json({ error: "Missing room_id or message" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `Message too long (max ${MAX_MESSAGE_CHARS} chars)` },
      { status: 413 },
    );
  }

  const admin = createAdminClient();

  // Membership check (also picks up the room).
  const { data: room } = await admin
    .from("beneficiary_rooms")
    .select("id, oracle_id, name, language")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const { data: membership } = await admin
    .from("beneficiary_room_members")
    .select("user_id, left_at")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || membership.left_at) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  // Pull oracle + verify owner is still deceased (sanity check — if
  // the owner came back to life somehow, this room shouldn't be
  // active).
  const { data: oracle } = await admin
    .from("oracles")
    .select(
      "id, name, bio, texting_style, preferred_language, orientation, relationship_openness, identity_quirks, ambient_cast, location_anchor, user_id",
    )
    .eq("id", room.oracle_id)
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
      { error: "Owner is not deceased; this room shouldn't be active." },
      { status: 403 },
    );
  }

  // Active members + their display names.
  const { data: memberRows } = await admin
    .from("beneficiary_room_members")
    .select("user_id, joined_at")
    .eq("room_id", roomId)
    .is("left_at", null);

  const memberIds = (memberRows ?? []).map((m) => m.user_id);
  const { data: memberProfiles } = memberIds.length
    ? await admin
        .from("profiles")
        .select("id, oracle_name")
        .in("id", memberIds)
    : { data: [] };
  const profileMap = new Map(
    (memberProfiles ?? []).map((p) => [p.id, p.oracle_name]),
  );
  // Auth emails as fallback for display (admin scope).
  const memberDisplay = await Promise.all(
    memberIds.map(async (id) => {
      const fallback = profileMap.get(id) ?? null;
      if (fallback) return { userId: id, displayName: fallback };
      const { data } = await admin.auth.admin.getUserById(id);
      const email = data?.user?.email ?? null;
      return { userId: id, displayName: email ?? "someone" };
    }),
  );

  // Persist user message.
  await admin.from("beneficiary_room_messages").insert({
    room_id: roomId,
    sender_user_id: user.id,
    role: "user",
    content: message,
  });
  await admin
    .from("beneficiary_rooms")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", roomId);

  // Recent history for prompt context.
  const { data: historyRows } = await admin
    .from("beneficiary_room_messages")
    .select("role, content, sender_user_id, sender_oracle_id, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(RECENT_HISTORY_LIMIT);

  const turns: BeneficiaryRoomTurn[] = (historyRows ?? [])
    .reverse()
    .map((r) => {
      if (r.role === "user") {
        const display =
          memberDisplay.find((m) => m.userId === r.sender_user_id)
            ?.displayName ?? "someone";
        return {
          role: "user" as const,
          senderName: display,
          content: r.content,
        };
      }
      return {
        role: "assistant" as const,
        senderName: oracle.name ?? "they",
        content: r.content,
      };
    });

  const ctx: BeneficiaryRoomContext = {
    oracleId: oracle.id,
    oracleName: oracle.name ?? "your person",
    bio: oracle.bio,
    textingStyle: oracle.texting_style,
    language: (oracle.preferred_language ?? room.language ?? "en") as
      | "en"
      | "es",
    orientation: oracle.orientation,
    openness: oracle.relationship_openness,
    quirks: oracle.identity_quirks,
    cast: oracle.ambient_cast,
    location: oracle.location_anchor,
    members: memberDisplay,
  };

  const replies = await generateBeneficiaryReply({ ctx, recentTurns: turns });
  if (!replies || replies.length === 0) {
    return NextResponse.json({ ok: true, replies: [] });
  }

  // Persist each burst with a small delay between for "real typing" feel.
  for (let i = 0; i < replies.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1200));
    await admin.from("beneficiary_room_messages").insert({
      room_id: roomId,
      sender_oracle_id: oracle.id,
      role: "assistant",
      content: replies[i],
    });
  }

  return NextResponse.json({ ok: true });
}
