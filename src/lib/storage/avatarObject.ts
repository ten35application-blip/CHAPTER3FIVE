import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The photo has to survive the whole way — walk → archive → code →
 * every copy someone redeems. It didn't, once, and the failure was
 * invisible: an `avatar_url` was written to an oracle row pointing at
 * a storage object that had never been created. The bucket answered
 * 404, the app rendered the empty response, and a real person's
 * archive showed a black square where their face belonged
 * (2026-08-22, the first archive a real user finished).
 *
 * The write path checks its own upload error, so this is the belt for
 * everything it can't see: an older client that composed the URL
 * itself, an upload that reported success and got swept, a purge that
 * removed an object still referenced by a row. A URL is a promise
 * about a file; these helpers make us keep it.
 */

/** Storage key inside the `avatars` bucket, or null if not one of ours. */
export function avatarsObjectPath(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const prefix = `${supabaseUrl}/storage/v1/object/public/avatars/`;
  if (!supabaseUrl || !avatarUrl.startsWith(prefix)) return null;
  const rest = avatarUrl.slice(prefix.length);
  const path = rest.split("?")[0];
  return path.length > 0 ? path : null;
}

/**
 * Does the object this URL promises actually exist?
 *
 * Fails CLOSED on a storage error — an unverifiable photo is treated
 * as missing, because storing a URL we couldn't confirm is exactly
 * the bug this exists to prevent. A URL that isn't ours at all (an
 * external face-generation host, say) returns true: we make no claim
 * about storage we don't own, and must not blank it.
 */
export async function avatarObjectExists(
  avatarUrl: string | null,
): Promise<boolean> {
  if (!avatarUrl) return false;
  const path = avatarsObjectPath(avatarUrl);
  if (!path) return true; // not in our bucket — not ours to judge

  const slash = path.lastIndexOf("/");
  const dir = slash === -1 ? "" : path.slice(0, slash);
  const file = slash === -1 ? path : path.slice(slash + 1);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage
      .from("avatars")
      .list(dir, { search: file, limit: 100 });
    if (error) {
      console.error(
        `[avatarObject] could not verify ${path}: ${error.message}`,
      );
      return false;
    }
    return (data ?? []).some((o) => o.name === file);
  } catch (err) {
    console.error(`[avatarObject] could not verify ${path}:`, err);
    return false;
  }
}

/**
 * The URL to actually persist: the original when its file is really
 * there, otherwise null. Never store a dead link — a null avatar
 * renders as the initial-letter fallback, which reads as "no photo
 * yet" instead of as a black hole where a face should be, and leaves
 * the row honest for anything downstream that copies it.
 */
export async function verifiedAvatarUrl(
  avatarUrl: string | null,
  context: string,
): Promise<string | null> {
  if (!avatarUrl) return null;
  if (await avatarObjectExists(avatarUrl)) return avatarUrl;
  console.error(
    `[avatarObject] ${context}: avatar_url points at a missing object, storing null instead — ${avatarUrl}`,
  );
  return null;
}

/**
 * Remove the stored photo behind a deleted identity — but ONLY if no
 * other row still points at it.
 *
 * `avatars` is a PUBLIC bucket. Until 2026-08-22 "Delete forever" removed
 * the oracle row and left the image sitting at its URL, fetchable by
 * anyone with the link, forever — after the person had explicitly asked
 * for it to be gone. For a photo of a real person, uploaded under an
 * attestation that they consented, that is the wrong default.
 *
 * The shared-reference check is load-bearing and is NOT paranoia. A
 * redeemed inherit code produces a copy carrying the SAME avatar_url as
 * the archive it came from, so deleting the object on the strength of one
 * row would blank the photo in every other family member's copy — the
 * exact "her archive has no face" failure this file was written for.
 * Verified against production: three copies of one archive currently
 * share a single avatar_url.
 *
 * Best-effort by design. A storage error must never block or reverse the
 * row deletion the user asked for — losing the photo is recoverable, but
 * telling someone their delete failed when the row is already gone is not.
 * Returns what happened, for logging.
 */
export async function deleteAvatarObjectIfUnreferenced(
  avatarUrl: string | null,
  deletedOracleId: string,
): Promise<"deleted" | "still-referenced" | "not-ours" | "failed"> {
  const path = avatarsObjectPath(avatarUrl);
  if (!path) return "not-ours";
  try {
    const admin = createAdminClient();
    // Any OTHER oracle — including soft-deleted ones, which can still be
    // restored from the trash, and inherited copies owned by other people.
    const { data: others, error: refErr } = await admin
      .from("oracles")
      .select("id")
      .eq("avatar_url", avatarUrl)
      .neq("id", deletedOracleId)
      .limit(1);
    // Fail CLOSED: if we cannot prove the photo is unreferenced, keep it.
    // An orphaned file is a tidiness problem; a blanked face in someone's
    // inherited archive is the thing we refuse to risk.
    if (refErr) return "failed";
    if (others && others.length > 0) return "still-referenced";

    const { error } = await admin.storage.from("avatars").remove([path]);
    return error ? "failed" : "deleted";
  } catch {
    return "failed";
  }
}
