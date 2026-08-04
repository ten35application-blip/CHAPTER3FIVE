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

/**
 * Minimum answers before an archive can be minted.
 *
 * SPLIT BY MODE (2026-08-04), because the two modes fail differently.
 *
 * SELF: you are writing about yourself, in first person. Twenty short
 * answers still produce something real — the prose is yours, the
 * phrasing is yours, the rhythm is yours. Thin, but not invented. And
 * you are alive: you can come back and add more any time.
 *
 * OTHER: someone is writing about a person who is gone. Twenty thin
 * answers become a fluent multi-paragraph portrait with a hometown, a
 * trade and a philosophy — handed to a grandchild who will never know
 * which parts were real, by a writer who cannot come back and correct
 * it, about a person who cannot object. The floor has to be higher
 * where the confabulation is permanent.
 *
 * Deliberately not enormous. The people filling this in are often doing
 * it in a hospice week, and a wall is its own kind of harm.
 */
export const LEGACY_MIN_ANSWERS = 20;
export const LEGACY_MIN_ANSWERS_OTHER = 30;

/** The floor that applies to a given archive mode. */
export function minAnswersForMode(mode: "self" | "other"): number {
  return mode === "self" ? LEGACY_MIN_ANSWERS : LEGACY_MIN_ANSWERS_OTHER;
}
export const LEGACY_MAX_ANSWER_CHARS = 4000;
export const LEGACY_MAX_SUBJECT_FIELD_CHARS = 200;

const KNOWN_QUESTION_IDS = new Set(LEGACY_QUESTIONS.map((q) => q.id));

export function sanitizeLegacySubject(
  subject: LegacySubject,
  /**
   * The caller's user id. When provided, photoUrl must live inside THAT
   * user's folder, not merely inside the avatars bucket.
   *
   * Added 2026-08-04. The prefix check below proves the URL came from
   * our storage; it did not prove it came from YOUR storage. The path
   * shape is `avatars/legacy/{uid}/{ts}.jpg`, so a crafted client could
   * pass another user's uploaded legacy photo — a real person's face,
   * belonging to someone else's dead relative — and have it become
   * their own identity's avatar. Optional so existing callers that
   * genuinely have no user context still get the bucket check.
   */
  ownerUserId?: string,
): LegacySubject {
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
  const requiredPrefix = ownerUserId
    ? `${supabaseUrl}/storage/v1/object/public/avatars/legacy/${ownerUserId}/`
    : `${supabaseUrl}/storage/v1/object/public/avatars/legacy/`;
  const photoUrl =
    supabaseUrl && raw.startsWith(requiredPrefix) ? raw : undefined;
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
