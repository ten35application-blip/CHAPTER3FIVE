import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { requireTermsAccepted } from "@/lib/legal/gate";
import {
  LEGACY_CATEGORY_LABELS,
  LEGACY_QUESTION_COUNT,
  LEGACY_QUESTIONS,
} from "@/lib/legacy/questions";
import {
  sanitizeLegacyAnswers,
  sanitizeLegacySubject,
} from "@/lib/legacy/sanitize";
import type { LegacySubject } from "@/lib/legacy/synthesize";

/**
 * The legacy flow's draft endpoint for the mobile app.
 *
 * GET  → { questions, categoryLabels, questionCount, draft } — the
 *        question bank plus the caller's autosaved draft (or null).
 *        The bank is SERVER-ONLY content (see questions.ts); serving
 *        it exclusively through this auth-gated endpoint preserves
 *        the exact posture the web has, where the bank only reaches
 *        the client via the auth-gated server page's props. It is
 *        never bundled into the app binary.
 *
 * PUT  → autosave. Body { subject, answers, currentStep }; same
 *        sanitize + upsert as the saveLegacyDraft server action
 *        (shared code in @/lib/legacy/sanitize).
 */
export async function GET(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  // NO plan gate — the legacy flow is open to every tier (July 2026
  // flat-fee rework), matching the web page.
  //
  // Per-mode drafts (0138): ?mode=self|other returns THAT walk's
  // draft. No mode param = a pre-0138 client that still believes in
  // one draft per account — hand it the most recently touched one so
  // it resumes whatever the user last worked on. `drafts` summarizes
  // every walk in progress for the picker's "Finish the walk" labels.
  const url = new URL(request.url);
  const modeParam = url.searchParams.get("mode");
  const mode: "self" | "other" | null =
    modeParam === "self" || modeParam === "other" ? modeParam : null;

  let query = supabase
    .from("legacy_drafts")
    .select("subject, answers, current_step, mode")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (mode) query = query.eq("mode", mode);
  const { data: rows } = await query;

  const draft = rows?.[0] ?? null;
  const drafts = (mode ? (rows ?? []) : (rows ?? [])).map((r) => ({
    mode: r.mode as string,
    has_content:
      Object.values((r.answers as Record<string, string>) ?? {}).some((a) =>
        a?.trim(),
      ) || !!(r.subject as { name?: string } | null)?.name,
    subject_ready:
      !!(r.subject as { name?: string } | null)?.name &&
      !!(r.subject as { photoUrl?: string } | null)?.photoUrl,
  }));

  return NextResponse.json({
    questions: LEGACY_QUESTIONS,
    categoryLabels: LEGACY_CATEGORY_LABELS,
    questionCount: LEGACY_QUESTION_COUNT,
    draft,
    drafts,
  });
}

export async function PUT(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  let payload: {
    subject?: LegacySubject;
    answers?: Record<string, string>;
    currentStep?: number;
  };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const step = Number.isInteger(payload.currentStep)
    ? Math.max(0, Math.min(LEGACY_QUESTION_COUNT, payload.currentStep as number))
    : 0;

  // The sanitized subject's mode names the row (0138: one draft per
  // mode). sanitizeLegacySubject guarantees "self" | "other", so
  // pre-0138 clients that never send an explicit mode still land on
  // a valid row instead of a constraint error.
  const subject = sanitizeLegacySubject(
    (payload.subject ?? {}) as LegacySubject,
    user.id,
  );
  const { error } = await supabase.from("legacy_drafts").upsert(
    {
      user_id: user.id,
      mode: subject.mode === "self" ? "self" : "other",
      subject,
      answers: sanitizeLegacyAnswers(payload.answers ?? {}),
      current_step: step,
    },
    { onConflict: "user_id,mode" },
  );
  if (error) {
    console.error("[api/legacy/draft] upsert failed", error);
    return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
