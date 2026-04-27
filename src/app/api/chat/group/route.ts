import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  judgeUrge,
  generateGroupReply,
  loadArchiveForOracle,
  URGE_THRESHOLD,
  type GroupMember,
  type GroupTurn,
} from "@/lib/groupChat";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGE_CHARS = 4000;
const RECENT_HISTORY_LIMIT = 30;

/**
 * Group chat orchestration.
 *
 * Flow:
 *  1. Verify caller owns the room
 *  2. Persist user message
 *  3. For every active member persona: judge urge to respond (parallel)
 *  4. Pick the top 1–2 above threshold
 *  5. Generate full replies for those (parallel)
 *  6. Post replies sequentially (small artificial delay between)
 *  7. Second pass: for any persona that didn't reply, judge urge to
 *     react to what just got said. Cap one cross-reply.
 *
 * Returns immediately with the user message persisted; the reply
 * stream lands via realtime on group_messages.
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

  // Ownership check via RLS — the read fails if the user doesn't own.
  const { data: room } = await supabase
    .from("group_rooms")
    .select("id, name, language, owner_user_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const admin = createAdminClient();

  // Pull active members (not left).
  const { data: memberRows } = await admin
    .from("group_room_members")
    .select(
      `oracle_id, oracles(id, name, avatar_url, bio, texting_style, preferred_language, orientation, relationship_openness, identity_quirks, ambient_cast, location_anchor)`,
    )
    .eq("room_id", roomId)
    .is("left_at", null);

  type OracleRow = {
    id: string;
    name: string | null;
    avatar_url: string | null;
    bio: string | null;
    texting_style: string | null;
    preferred_language: string | null;
    orientation: string | null;
    relationship_openness: string | null;
    identity_quirks: string[] | null;
    ambient_cast: GroupMember["cast"];
    location_anchor: GroupMember["location"];
  };
  type RawMemberRow = {
    oracle_id: string;
    oracles: OracleRow | OracleRow[] | null;
  };

  const members: GroupMember[] = ((memberRows ?? []) as unknown as RawMemberRow[])
    .map((m) => {
      const o = Array.isArray(m.oracles) ? m.oracles[0] : m.oracles;
      if (!o) return null;
      return {
        oracleId: o.id,
        name: o.name ?? "someone",
        avatarUrl: o.avatar_url,
        bio: o.bio,
        textingStyle: o.texting_style,
        language: (o.preferred_language ?? room.language ?? "en") as
          | "en"
          | "es",
        orientation: o.orientation,
        openness: o.relationship_openness,
        quirks: o.identity_quirks,
        cast: o.ambient_cast,
        location: o.location_anchor,
      };
    })
    .filter((m): m is GroupMember => m !== null);

  if (members.length === 0) {
    return NextResponse.json(
      { error: "No active identities in this room." },
      { status: 400 },
    );
  }

  // Host display name — default to "you" so the group prompt reads
  // naturally for every persona.
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("oracle_name")
    .eq("id", user.id)
    .maybeSingle();
  const hostName = ownerProfile?.oracle_name ?? "you";

  // Recent group history (most-recent N), oldest-first.
  const { data: historyRows } = await admin
    .from("group_messages")
    .select("role, content, sender_oracle_id, sender_user_id, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(RECENT_HISTORY_LIMIT);
  const history: GroupTurn[] = (historyRows ?? [])
    .reverse()
    .map((r) => ({
      role: r.role as "user" | "assistant",
      senderName:
        r.role === "user"
          ? hostName
          : members.find((m) => m.oracleId === r.sender_oracle_id)?.name ??
            "someone",
      content: r.content,
    }));

  // Persist the user message.
  const userTurn: GroupTurn = {
    role: "user",
    senderName: hostName,
    content: message,
  };
  await admin.from("group_messages").insert({
    room_id: roomId,
    sender_user_id: user.id,
    role: "user",
    content: message,
  });
  await admin
    .from("group_rooms")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", roomId);

  const turnsForUrge = [...history, userTurn];

  // Round 1: every member judges their urge in parallel.
  const urges = await Promise.all(
    members.map(async (m) => ({
      member: m,
      urge: await judgeUrge({
        member: m,
        recentTurns: turnsForUrge,
        triggerSenderName: hostName,
        hostName,
        otherMembers: members,
      }),
    })),
  );

  // Top 1-2 above threshold. If multiple tie at the top, pick the two
  // highest. If nobody hits threshold, nobody replies — that's a real
  // group chat moment too.
  const eligible = urges
    .filter((u) => u.urge >= URGE_THRESHOLD)
    .sort((a, b) => b.urge - a.urge)
    .slice(0, 2);

  if (eligible.length === 0) {
    return NextResponse.json({ replies: [] });
  }

  // Generate replies in parallel. Each persona's archive is loaded
  // separately — they need their own answers, not the room's.
  const replies = await Promise.all(
    eligible.map(async ({ member }) => {
      const archive = await loadArchiveForOracle({
        oracleId: member.oracleId,
        language: member.language,
      });
      const reply = await generateGroupReply({
        member,
        recentTurns: turnsForUrge,
        hostName,
        otherMembers: members,
        archive,
      });
      return { member, reply };
    }),
  );

  // Persist replies sequentially with a small artificial delay between
  // them so the realtime stream feels like real people typing, not a
  // simultaneous burst.
  const persistedReplies: GroupTurn[] = [];
  for (let i = 0; i < replies.length; i++) {
    const { member, reply } = replies[i];
    if (!reply) continue;
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));
    await admin.from("group_messages").insert({
      room_id: roomId,
      sender_oracle_id: member.oracleId,
      role: "assistant",
      content: reply,
    });
    persistedReplies.push({
      role: "assistant",
      senderName: member.name,
      content: reply,
    });
  }

  // Round 2: cross-reply pass. Any member who didn't reply in round 1
  // gets to judge their urge to react to what was just said. Cap at
  // one cross-reply to prevent infinite ping-pong.
  if (persistedReplies.length > 0) {
    const eligibleForCross = members.filter(
      (m) => !eligible.some((e) => e.member.oracleId === m.oracleId),
    );
    if (eligibleForCross.length > 0) {
      const turnsAfterReplies = [...turnsForUrge, ...persistedReplies];
      const lastReply = persistedReplies[persistedReplies.length - 1];

      const crossUrges = await Promise.all(
        eligibleForCross.map(async (m) => ({
          member: m,
          urge: await judgeUrge({
            member: m,
            recentTurns: turnsAfterReplies,
            triggerSenderName: lastReply.senderName,
            hostName,
            otherMembers: members,
          }),
        })),
      );

      // Higher threshold for cross-reply — it needs real urgency to
      // chain. 7+ instead of 6.
      const crossPick = crossUrges
        .filter((u) => u.urge >= URGE_THRESHOLD + 1)
        .sort((a, b) => b.urge - a.urge)[0];

      if (crossPick) {
        const archive = await loadArchiveForOracle({
          oracleId: crossPick.member.oracleId,
          language: crossPick.member.language,
        });
        const reply = await generateGroupReply({
          member: crossPick.member,
          recentTurns: turnsAfterReplies,
          hostName,
          otherMembers: members,
          archive,
        });
        if (reply) {
          await new Promise((r) => setTimeout(r, 1500));
          await admin.from("group_messages").insert({
            room_id: roomId,
            sender_oracle_id: crossPick.member.oracleId,
            role: "assistant",
            content: reply,
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
