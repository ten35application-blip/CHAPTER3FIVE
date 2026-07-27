/**
 * The version of the legal bundle (Terms of Service + End-User License
 * Agreement + Privacy Policy + Community Guidelines) users must accept
 * before using the app.
 *
 * This is the effective date shown on /terms, /eula, /privacy, and
 * /guidelines (via src/components/legal.tsx). When we materially change
 * any of those documents, bump this constant to the new effective date —
 * every user whose stored `terms_version_accepted` no longer matches
 * will be routed back through /onboarding to re-accept, and a new row
 * lands in public.terms_acceptances (see 0086).
 *
 * Version history:
 *   2026-07-25 — initial bundle (Terms + Privacy + Guidelines).
 *   2026-07-27 — added /eula (Apple Minimum Terms).
 *   2026-07-27b — privacy policy: added OpenAI as a subprocessor
 *                 (Moderation + Embeddings + Whisper) with corrected
 *                 zero-retention scope; effective-date banner now
 *                 driven from this constant so consent + display match.
 */
export const CURRENT_TERMS_VERSION = "2026-07-27b";

/**
 * True only if the profile has accepted exactly the current version.
 * Null (never accepted) and stale versions both fail, which is what
 * re-prompting on material changes requires.
 */
export function hasAcceptedCurrentTerms(profile: {
  terms_version_accepted: string | null;
}): boolean {
  return profile.terms_version_accepted === CURRENT_TERMS_VERSION;
}
