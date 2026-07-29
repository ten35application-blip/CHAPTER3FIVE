import { LEGACY_QUESTIONS } from "./questions";
import type { LegacySubject } from "./synthesize";

/**
 * Shared sanitizers for the legacy flow's draft + completion inputs.
 *
 * Extracted verbatim from identity/legacy/new/actions.ts (2026-07-29)
 * so the mobile-facing API routes (/api/legacy/*) and the web server
 * actions run the EXACT same validation — a security-relevant
 * sanitizer must never fork between the two entry points. "use
 * server" files may only export async functions, so these live here.
 */

/** Enough answers to weave a real person from — half the bank. */
export const LEGACY_MIN_ANSWERS = 20;
export const LEGACY_MAX_ANSWER_CHARS = 4000;
export const LEGACY_MAX_SUBJECT_FIELD_CHARS = 200;

const KNOWN_QUESTION_IDS = new Set(LEGACY_QUESTIONS.map((q) => q.id));

export function sanitizeLegacySubject(subject: LegacySubject): LegacySubject {
  const clean = (v: unknown) =>
    typeof v === "string"
      ? v.trim().slice(0, LEGACY_MAX_SUBJECT_FIELD_CHARS)
      : "";
  // photoUrl must be a URL we actually minted from Supabase Storage —
  // trust nothing that came off the client. If it doesn't match the
  // shape supabase-storage/…/avatars/legacy/… we drop it so a malicious
  // client can't inject an arbitrary URL into the oracle's avatar_url.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const raw = typeof subject?.photoUrl === "string" ? subject.photoUrl : "";
  const photoUrl =
    supabaseUrl &&
    raw.startsWith(`${supabaseUrl}/storage/v1/object/public/avatars/legacy/`)
      ? raw
      : undefined;
  // Mode: enum-narrow to the two allowed strings; anything else
  // (including undefined from pre-mode drafts) falls back to "other"
  // so old drafts keep working after this rollout.
  const modeRaw = subject?.mode;
  const mode: "self" | "other" =
    modeRaw === "self" || modeRaw === "other" ? modeRaw : "other";
  return {
    name: clean(subject?.name),
    // In self mode we drop the relationship field from the UI and
    // never trust whatever might have been sitting in a stale draft.
    relationship: mode === "self" ? "" : clean(subject?.relationship),
    era: clean(subject?.era),
    heritage: clean(subject?.heritage),
    mode,
    ...(photoUrl ? { photoUrl } : {}),
  };
}

export function sanitizeLegacyAnswers(
  answers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(answers ?? {})) {
    if (!KNOWN_QUESTION_IDS.has(id)) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, LEGACY_MAX_ANSWER_CHARS);
    if (trimmed.length > 0) out[id] = trimmed;
  }
  return out;
}
