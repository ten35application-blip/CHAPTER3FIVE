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
  const { data: draft } = await supabase
    .from("legacy_drafts")
    .select("subject, answers, current_step")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    questions: LEGACY_QUESTIONS,
    categoryLabels: LEGACY_CATEGORY_LABELS,
    questionCount: LEGACY_QUESTION_COUNT,
    draft: draft ?? null,
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

  const { error } = await supabase.from("legacy_drafts").upsert(
    {
      user_id: user.id,
      subject: sanitizeLegacySubject((payload.subject ?? {}) as LegacySubject),
      answers: sanitizeLegacyAnswers(payload.answers ?? {}),
      current_step: step,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[api/legacy/draft] upsert failed", error);
    return NextResponse.json({ error: "Couldn't save" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
