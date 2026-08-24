import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndSaveFace } from "@/lib/faces/generate";
import type { Traits } from "@/lib/identity/formula";

/**
 * Finish what a dead request started, instead of charging for it twice.
 *
 * Formula creation inserts the row `provisioning: true`, spends ~30s
 * generating the face, then flips provisioning off. Die anywhere in
 * that window (instance recycled, deploy mid-request, crash) and the
 * row is stranded: hidden from the dashboard by the provisioning
 * filter, but counted by canCreateOracle's lifetime quota — so the
 * user's "Try again" rolled a SECOND companion against a slot the
 * first one was still silently holding.
 *
 * Both creation entry points call this before rolling anything. If an
 * orphan exists, they finish it — face if missing, provisioning off —
 * and reveal it as the result. The user gets the companion they
 * already paid a slot for; no new slot is touched.
 *
 * The 10-minute age floor is load-bearing twice over:
 *  - a row younger than that may belong to a request STILL RUNNING in
 *    another tab or on another instance — adopting it would have two
 *    workers finishing one row;
 *  - the subscribe-time batch (autoPopulate) also uses provisioning
 *    rows, held hidden so the whole batch reveals together; its heal
 *    pass finishes them on the next dashboard visit. Only a row that
 *    has sat for 10+ minutes is genuinely nobody's.
 *
 * Never throws. Null means "nothing to adopt — roll fresh".
 */
export async function adoptOrphanedCreation(
  userId: string,
): Promise<{ id: string } | null> {
  try {
    const admin = createAdminClient();
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: orphan } = await admin
      .from("oracles")
      .select("id, traits, avatar_url, created_at")
      .eq("user_id", userId)
      .eq("provisioning", true)
      .eq("creation_source", "random")
      .is("deleted_at", null)
      .lt("created_at", tenMinutesAgo)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{
        id: string;
        traits: Traits | null;
        avatar_url: string | null;
      }>();
    if (!orphan) return null;

    if (!orphan.avatar_url && orphan.traits) {
      // Same posture as the normal path: one attempt, and a letter
      // avatar beats holding the companion hostage over a portrait.
      const face = await generateAndSaveFace(orphan.id, orphan.traits);
      if (!face.ok) {
        console.error(
          `[adoptOrphan] face gen failed for ${orphan.id}:`,
          face.error,
        );
      }
    }

    await admin
      .from("oracles")
      .update({ provisioning: false })
      .eq("id", orphan.id);

    console.log(
      `[adoptOrphan] finished stranded creation ${orphan.id} for user ${userId}`,
    );
    return { id: orphan.id };
  } catch (err) {
    console.error("[adoptOrphan] failed (rolling fresh instead):", err);
    return null;
  }
}
