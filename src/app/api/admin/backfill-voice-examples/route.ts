import { NextResponse, type NextRequest } from "next/server";
import { backfillVoiceExamples } from "@/lib/identity/backfillVoiceExamples";
import { isAdmin } from "@/lib/admin/allowlist";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
// Backfill can take a while when hundreds of oracles are pending. Give
// the route plenty of headroom; caller can also chunk via ?limit=.
export const maxDuration = 300;

/**
 * Admin one-shot backfill for the voice_examples column.
 *
 * Lazy backfill on chat load covers active users, but Wilson may want
 * to prime the column across all identities in one pass. This endpoint
 * iterates oracles where voice_examples IS NULL and calls
 * backfillVoiceExamples() serially so we don't slam Haiku.
 *
 *   POST /api/admin/backfill-voice-examples?limit=100
 *
 * Returns a summary { processed, wrote, skipped, failed }.
 *
 * Admin-only via the same allowlist as /admin/*. Runs with the caller's
 * auth cookies just to gate; the helper itself uses the admin client to
 * bypass the oracles column-guard trigger.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "not_admin" }, { status: 403 });
  }

  const url = new URL(request.url);
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "50", 10);
  // Clamp max to 100 so we don't brush the 300s runtime cap on a slow
  // Haiku day (typical call ~1-3s serial × 200 = risky). Caller
  // repeats the POST to continue past 100.
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), 100)
    : 50;

  const admin = createAdminClient();
  const { data: rows, error: readErr } = await admin
    .from("oracles")
    .select("id")
    .is("voice_examples", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  let processed = 0;
  let wrote = 0;
  let skipped = 0;
  let failed = 0;
  const errors: { id: string; error: string }[] = [];

  for (const row of rows ?? []) {
    processed++;
    const result = await backfillVoiceExamples(row.id);
    if (!result.ok) {
      failed++;
      errors.push({ id: row.id, error: result.error });
      continue;
    }
    if ("wrote" in result) {
      wrote++;
    } else {
      skipped++;
    }
  }

  return NextResponse.json({
    processed,
    wrote,
    skipped,
    failed,
    // Truncate error detail on the wire; full log lives in Vercel.
    errors: errors.slice(0, 10),
    remaining_hint:
      processed === limit
        ? "hit limit; POST again to continue"
        : "no more oracles pending backfill",
  });
}
