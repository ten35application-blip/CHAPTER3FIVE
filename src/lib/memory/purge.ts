import type { createAdminClient } from "@/lib/supabase/admin";
import { SHARED_IDENTITY_KEYS } from "@/lib/memory/retrieve";

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
 * message rows (collectTrashedMessageIds below — paginated, because
 * the default row cap silently truncates at 1000 and a truncated list
 * means memories that should die don't) and calls this once the
 * delete has succeeded — a failed delete must not cost the memories:
 *
 * 1. Precise: delete memories whose source_message_ids overlap the
 *    purged ids, in chunks (a few hundred uuids in one filter
 *    querystring exceeds gateway URL limits and 414s — silently,
 *    since PostgREST clients return errors rather than throw).
 * 2. Scorched earth, only when nothing survives: if the purge leaves
 *    ZERO live messages between this user and this companion, every
 *    remaining pair memory goes too — including unprovenanced rows
 *    from older miners. No conversation, no memory of one. The wipe
 *    only runs on a VERIFIED zero: a failed count reads as "unknown",
 *    not "empty", because wrongly keeping a memory is recoverable and
 *    wrongly wiping a live companion's memory is not.
 *
 * Both passes leave the SHARED identity tier (goes_by, pronouns,
 * gender) untouched. Those rows are the user's own identity, read
 * user-wide by every companion since the two-tier split — production
 * holds exactly one goes_by row per user, living on whichever
 * companion learned it first. Deleting it here would make every OTHER
 * companion forget the user's name and pronouns because they purged
 * one unrelated conversation. Erasing a relationship erases what was
 * said in it, not who the user is. (The private tier — orientation,
 * relationship, partner — DOES die with its pair: it belongs to that
 * relationship by design.)
 *
 * postgrest-js reports failures as { error }, it does not throw — so
 * every call's error is checked explicitly, and the outcome flags are
 * only set on verified success. Never throws; the purge itself must
 * succeed even if this cleanup fails.
 */

const OVERLAP_CHUNK = 100;
// "key is null OR key not in shared" — the plain not.in filter would
// silently EXCLUDE null-key rows from deletion (SQL: NULL NOT IN (...)
// is NULL, not true). Every current row has a key, but the schema
// allows kind/content rows without one and the reflect cron is a
// plausible future writer of them.
const notSharedOrNullKey = `key.is.null,key.not.in.(${SHARED_IDENTITY_KEYS.join(",")})`;

/** Every trashed message id for the pair, paginated past the client's
 *  default row cap. Call BEFORE deleting the rows. */
export async function collectTrashedMessageIds(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  oracleId: string,
): Promise<string[]> {
  const ids: string[] = [];
  const PAGE = 1000;
  try {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await admin
        .from("messages")
        .select("id")
        .eq("user_id", userId)
        .eq("oracle_id", oracleId)
        .not("deleted_at", "is", null)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("[memory/purge] trashed-id page failed:", error);
        break;
      }
      for (const row of data ?? []) ids.push(row.id as string);
      if (!data || data.length < PAGE) break;
    }
  } catch (err) {
    console.error("[memory/purge] trashed-id collection threw:", err);
  }
  return ids;
}

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
    for (let i = 0; i < purgedMessageIds.length; i += OVERLAP_CHUNK) {
      const chunk = purgedMessageIds.slice(i, i + OVERLAP_CHUNK);
      const { data, error } = await admin
        .from("persona_memories")
        .delete()
        .eq("user_id", userId)
        .eq("oracle_id", oracleId)
        .or(notSharedOrNullKey)
        .overlaps("source_message_ids", chunk)
        .select("id");
      if (error) {
        console.error(
          `[memory/purge] precise chunk ${i / OVERLAP_CHUNK} failed:`,
          error,
        );
        continue;
      }
      preciseDeleted += data?.length ?? 0;
    }

    const { count: liveLeft, error: countError } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("oracle_id", oracleId)
      .is("deleted_at", null);

    // A failed count is UNKNOWN, never zero. The old `(liveLeft ?? 0)`
    // turned a transient read error into a verdict of "conversation is
    // empty" and wiped a live companion's entire memory.
    if (!countError && liveLeft === 0) {
      const { error: wipeError } = await admin
        .from("persona_memories")
        .delete()
        .eq("user_id", userId)
        .eq("oracle_id", oracleId)
        .or(notSharedOrNullKey);
      if (wipeError) {
        console.error("[memory/purge] pair wipe failed:", wipeError);
      } else {
        pairWiped = true;
      }
    } else if (countError) {
      console.error(
        "[memory/purge] live count failed — skipping pair wipe:",
        countError,
      );
    }
  } catch (err) {
    console.error("[memory/purge] cleanup failed (purge continues):", err);
  }

  return { preciseDeleted, pairWiped };
}
