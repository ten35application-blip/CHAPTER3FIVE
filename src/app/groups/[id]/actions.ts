"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateKickReactionLine,
  type GroupMember,
  type GroupTurn,
} from "@/lib/groupChat";

const RECENT_HISTORY_LIMIT = 16;

/**
 * Owner kicks a persona from the group. The kicked persona reacts in
 * their own voice (one short line) before being marked as left, so
 * the room shows their reaction and a strikethrough chip after.
 */
export async function kickGroupMember(formData: FormData) {
  const roomId = String(formData.get("room_id") ?? "").trim();
  const oracleId = String(formData.get("oracle_id") ?? "").trim();
  if (!roomId || !oracleId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: room } = await supabase
    .from("group_rooms")
    .select("id, name, language, owner_user_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || room.owner_user_id !== user.id) return;

  const admin = createAdminClient();

  // Pull the target persona along with everything we need to generate
  // their reaction line.
  const { data: oracle } = await admin
    .from("oracles")
    .select(
      "id, name, avatar_url, bio, texting_style, preferred_language, orientation, relationship_openness, identity_quirks, ambient_cast, location_anchor, sports_fandom",
    )
    .eq("id", oracleId)
    .maybeSingle();
  if (!oracle) return;

  // Confirm they're an active member of the room.
  const { data: memberRow } = await admin
    .from("group_room_members")
    .select("oracle_id, left_at")
    .eq("room_id", roomId)
    .eq("oracle_id", oracleId)
    .maybeSingle();
  if (!memberRow || memberRow.left_at) return;

  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("oracle_name")
    .eq("id", user.id)
    .maybeSingle();
  const hostName = ownerProfile?.oracle_name ?? "you";

  const member: GroupMember = {
    oracleId: oracle.id,
    name: oracle.name ?? "someone",
    avatarUrl: oracle.avatar_url,
    bio: oracle.bio,
    textingStyle: oracle.texting_style,
    language: (oracle.preferred_language ?? room.language ?? "en") as
      | "en"
      | "es",
    orientation: oracle.orientation,
    openness: oracle.relationship_openness,
    quirks: oracle.identity_quirks,
    cast: oracle.ambient_cast as GroupMember["cast"],
    location: oracle.location_anchor as GroupMember["location"],
    sports: oracle.sports_fandom as GroupMember["sports"],
  };

  // Recent history — gives the kick reaction context to land on.
  const { data: historyRows } = await admin
    .from("group_messages")
    .select("role, content, sender_oracle_id, created_at")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(RECENT_HISTORY_LIMIT);

  const { data: allMembers } = await admin
    .from("group_room_members")
    .select("oracle_id, oracles(name)")
    .eq("room_id", roomId);
  type NameRow = {
    oracle_id: string;
    oracles: { name: string | null } | { name: string | null }[] | null;
  };
  const nameByOracle = new Map<string, string>();
  for (const r of (allMembers ?? []) as unknown as NameRow[]) {
    const o = Array.isArray(r.oracles) ? r.oracles[0] : r.oracles;
    nameByOracle.set(r.oracle_id, o?.name ?? "someone");
  }
  const recent: GroupTurn[] = (historyRows ?? [])
    .reverse()
    .map((r) => ({
      role: r.role as "user" | "assistant",
      senderName:
        r.role === "user"
          ? hostName
          : nameByOracle.get(r.sender_oracle_id ?? "") ?? "someone",
      content: r.content,
    }));

  let reactionLine = "";
  try {
    reactionLine = await generateKickReactionLine({
      member,
      recentTurns: recent,
      hostName,
    });
  } catch (err) {
    console.error("kick reaction line failed:", err);
    reactionLine =
      member.language === "es" ? "okay, adiós." : "okay, bye.";
  }

  if (reactionLine) {
    await admin.from("group_messages").insert({
      room_id: roomId,
      sender_oracle_id: oracleId,
      role: "assistant",
      content: reactionLine,
    });
    await admin
      .from("group_rooms")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", roomId);
  }

  await admin
    .from("group_room_members")
    .update({
      left_at: new Date().toISOString(),
      left_reason: "kicked by owner",
    })
    .eq("room_id", roomId)
    .eq("oracle_id", oracleId);

  revalidatePath(`/groups/${roomId}`);
}

/**
 * Owner adds another of their identities to the group. If the persona
 * was previously kicked / walked, un-soft-delete them (clear left_at).
 * Otherwise insert a fresh membership.
 */
export async function addGroupMember(formData: FormData) {
  const roomId = String(formData.get("room_id") ?? "").trim();
  const oracleId = String(formData.get("oracle_id") ?? "").trim();
  if (!roomId || !oracleId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: room } = await supabase
    .from("group_rooms")
    .select("id, owner_user_id")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || room.owner_user_id !== user.id) return;

  // Verify the user actually owns this oracle (groups only contain
  // user-owned identities — never inherited / shared).
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id")
    .eq("id", oracleId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oracle) return;

  const admin = createAdminClient();

  // Cap at 4 active members.
  const { data: activeRows } = await admin
    .from("group_room_members")
    .select("oracle_id")
    .eq("room_id", roomId)
    .is("left_at", null);
  if ((activeRows ?? []).length >= 4) return;

  const { data: existing } = await admin
    .from("group_room_members")
    .select("oracle_id, left_at")
    .eq("room_id", roomId)
    .eq("oracle_id", oracleId)
    .maybeSingle();

  if (existing) {
    if (!existing.left_at) return;
    await admin
      .from("group_room_members")
      .update({ left_at: null, left_reason: null, joined_at: new Date().toISOString() })
      .eq("room_id", roomId)
      .eq("oracle_id", oracleId);
  } else {
    await admin
      .from("group_room_members")
      .insert({ room_id: roomId, oracle_id: oracleId });
  }

  revalidatePath(`/groups/${roomId}`);
}
