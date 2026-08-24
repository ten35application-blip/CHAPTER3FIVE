import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * Forget what the user erased.
 *
 * "Delete forever" used to hard-delete the trashed messages and stop,
 * leaving behind every persona_memories row mined FROM those messages
 * — so a companion could casually reference the thing the user had
 * just paid the two-step confirmation to destroy. For an app whose
 * subject is grief, "I erased that and it came back in conversation"
 * is about the worst possible failure.
 *
 * Two passes. The caller collects the trashed ids BEFORE deleting the
 * message rows (afterwards there is nothing left to ask) and calls
 * this once the delete has succeeded — a failed delete must not cost
 * the memories:
 *
 * 1. Precise: delete memories whose source_message_ids overlap the
 *    purged ids. A memory sourced from both a purged and a kept
 *    message still dies — erasure wins over completeness.
 * 2. Scorched earth, only when nothing survives: if the purge leaves
 *    ZERO live messages between this user and this companion, every
 *    remaining memory for the pair goes too, including rows with no
 *    recorded provenance (old miner versions, reflections, session
 *    residue). No conversation, no memory of one.
 *
 * Never throws — the purge itself must succeed even if this cleanup
 * fails; a leftover memory is strictly less bad than a failed delete.
 * Returns counts so callers can log what happened.
 */
export async function purgeMinedMemories(opts: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  oracleId: string;
  purgedMessageIds: string[];
}): Promise<{ preciseDeleted: number; pairWiped: boolean }> {
  const { admin, userId, oracleId, purgedMessageIds } = opts;
  let preciseDeleted = 0;
  let pairWiped = false;

  try {
    if (purgedMessageIds.length > 0) {
      const { data } = await admin
        .from("persona_memories")
        .delete()
        .eq("user_id", userId)
        .eq("oracle_id", oracleId)
        .overlaps("source_message_ids", purgedMessageIds)
        .select("id");
      preciseDeleted = data?.length ?? 0;
    }

    const { count: liveLeft } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("oracle_id", oracleId)
      .is("deleted_at", null);

    if ((liveLeft ?? 0) === 0) {
      await admin
        .from("persona_memories")
        .delete()
        .eq("user_id", userId)
        .eq("oracle_id", oracleId);
      pairWiped = true;
    }
  } catch (err) {
    console.error("[memory/purge] cleanup failed (purge continues):", err);
  }

  return { preciseDeleted, pairWiped };
}
