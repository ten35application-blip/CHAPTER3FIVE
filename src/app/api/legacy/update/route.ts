import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { updateOwnArchive } from "@/lib/legacy/updateArchive";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LEGACY_QUESTIONS,
  LEGACY_CATEGORY_LABELS,
} from "@/lib/legacy/questions";

export const runtime = "nodejs";

/**
 * POST /api/legacy/update — revise your OWN self-archive and push the
 * change to everyone holding a copy.
 *
 * Body: { oracle_id, photo_url?, answers? }
 *   photo_url — already uploaded via POST /api/legacy/photo. Verified
 *               to actually exist in storage before it is stored.
 *   answers   — { question_id: text }. Blank text is refused: an
 *               answer can be corrected, never emptied.
 *
 * Every ownership and scope rule lives in updateOwnArchive() so the
 * web action and this endpoint cannot drift apart. Shared with the
 * browser via the same helper rather than duplicated — the last time
 * a rule was hand-copied between the two surfaces it sat wrong for
 * four months.
 */
export async function POST(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    oracle_id?: unknown;
    photo_url?: unknown;
    answers?: unknown;
  };

  const oracleId =
    typeof body.oracle_id === "string" && body.oracle_id.trim().length > 0
      ? body.oracle_id.trim()
      : null;
  if (!oracleId) {
    return NextResponse.json({ error: "Missing archive." }, { status: 400 });
  }

  const answers: Record<string, string> = {};
  if (body.answers && typeof body.answers === "object") {
    for (const [k, v] of Object.entries(body.answers as Record<string, unknown>)) {
      if (typeof v === "string") answers[k] = v;
    }
  }

  const result = await updateOwnArchive(user.id, oracleId, {
    photoUrl: typeof body.photo_url === "string" ? body.photo_url : undefined,
    answers,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    photo_changed: result.photoChanged,
    added: result.added,
    corrected: result.corrected,
    copies_updated: result.copies,
  });
}

/**
 * GET /api/legacy/update?oracle_id=… — everything the update screen
 * needs: the question bank, and what this person actually wrote.
 *
 * The draft is deleted at completion, so the answers can only come
 * from the archive row itself. Same ownership rules as the POST: your
 * own row, a real archive, self-mode, not a redeemed copy.
 */
export async function GET(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const oracleId = new URL(request.url).searchParams.get("oracle_id");
  if (!oracleId) {
    return NextResponse.json({ error: "Missing archive." }, { status: 400 });
  }

  const { data: row } = await createAdminClient()
    .from("oracles")
    .select("id, name, avatar_url, legacy_answers, user_id, is_legacy, inherited_at, deleted_at")
    .eq("id", oracleId)
    .maybeSingle();

  if (!row || row.user_id !== user.id || row.deleted_at) {
    return NextResponse.json({ error: "We couldn't find that archive." }, { status: 404 });
  }
  if (!row.is_legacy || row.inherited_at) {
    return NextResponse.json(
      { error: "Only an archive you created can be updated." },
      { status: 403 },
    );
  }

  const stored = (row.legacy_answers ?? {}) as {
    subject?: { mode?: unknown; photoUrl?: string | null };
    answers?: Record<string, string>;
  };
  if (stored.subject?.mode !== "self") {
    return NextResponse.json(
      {
        error:
          "This one is about someone else, so it stays as they were remembered.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({
    oracle_id: row.id,
    name: row.name,
    photo_url: row.avatar_url ?? null,
    questions: LEGACY_QUESTIONS,
    categoryLabels: LEGACY_CATEGORY_LABELS,
    answers: stored.answers ?? {},
  });
}
