import { NextResponse } from "next/server";
import { after } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndSaveFace } from "@/lib/faces/generate";
import type { Traits } from "@/lib/identity/formula";

export const runtime = "nodejs";
// Batches run inside `after()`, which shares this route's duration
// budget. 9 seeded identities / 3 per batch × ~40s worst case ≈ 2min;
// leave headroom for a bigger backlog.
export const maxDuration = 300;

/**
 * POST /api/faces/backfill — admin-only. Sweeps every formula identity
 * that has no avatar and was never attempted (or failed), and generates
 * faces for them.
 *
 * Batches of 3 in parallel — polite to Replicate's rate limits while
 * still clearing a small backlog quickly. Rows stuck in 'pending'
 * (e.g. a serverless instance died mid-generation) are NOT picked up
 * here; retry those explicitly via POST /api/faces/generate { force }.
 *
 * Responds 202 with { queued } immediately; generation continues after
 * the response. Outcomes land in oracles.face_generation_status.
 */
export async function POST() {
  await requireAdmin();

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("oracles")
    .select("id, traits")
    .is("avatar_url", null)
    .or("face_generation_status.is.null,face_generation_status.eq.failed")
    .not("traits", "is", null)
    // Skip trashed identities — restoring one that never got a face can
    // go through POST /api/faces/generate, or the next sweep.
    .is("deleted_at", null)
    // NEVER a from-photo identity. The doc above says "every formula
    // identity", but nothing enforced it. A from-photo row whose avatar
    // upload soft-failed (from-photo/actions.ts deliberately redirects
    // and leaves the row faceless, status never set) matched this sweep
    // exactly — and got a Flux-generated stranger's face for an
    // identity the user built from a real person's photograph. The
    // photo IS the avatar on that path; a generated substitute is
    // never the right answer.
    //
    // Inherited copies are excluded for the same reason: they carry the
    // original's avatar by design (redeem file-copies it), so a
    // faceless one is a copy bug to fix at the source, not a face to
    // invent — the family would be handed a stranger wearing their
    // person's name.
    //
    // Written as an explicit allowlist, not .neq(): creation_source is
    // NULLABLE (default 'random', 0 nulls today), and `col <> 'photo'`
    // is NULL for a NULL row, which PostgREST drops — a hand-inserted
    // row would be silently skipped forever. Naming what IS eligible
    // can't rot that way.
    .in("creation_source", ["random", "legacy"]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const candidates = (rows ?? []).filter((r) => r.traits) as {
    id: string;
    traits: Traits;
  }[];

  const BATCH_SIZE = 3;
  after(async () => {
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      const batch = candidates.slice(i, i + BATCH_SIZE);
      // generateAndSaveFace never throws — a failed row records its own
      // status and the sweep moves on to the next batch.
      const results = await Promise.all(
        batch.map((row) => generateAndSaveFace(row.id, row.traits)),
      );
      const failed = results.filter((r) => !r.ok).length;
      console.log(
        `[faces backfill] batch ${i / BATCH_SIZE + 1}: ${results.length - failed} ok, ${failed} failed`,
      );
    }
  });

  return NextResponse.json({ queued: candidates.length }, { status: 202 });
}
