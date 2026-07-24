/**
 * The version of the legal bundle (Terms of Service + Privacy Policy +
 * Community Guidelines) users must accept before using the app.
 *
 * This is the effective date shown on /terms, /privacy, and
 * /guidelines. When we materially change any of those documents, bump
 * this constant to the new effective date — every user whose stored
 * `terms_version_accepted` no longer matches will be routed back
 * through /onboarding to re-accept.
 */
export const CURRENT_TERMS_VERSION = "2026-07-24";

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
