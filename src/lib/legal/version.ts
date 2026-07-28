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
 *   2026-07-27c — added Replicate + Expo subprocessors; EULA §5
 *                 rewritten to cover mobile applications (Apple + Play)
 *                 instead of iOS specifically; privacy: DOB now
 *                 collected at signup for age verification.
 *   2026-07-27d — Terms §8 rewritten for the new pricing model:
 *                 $5 → $10/mo Pro; Free tier now chats with the shared
 *                 Adrian concierge (100 msg/mo, 0 image sends); Pro
 *                 slot layout re-stated as 3 formula + 1 photo + 1
 *                 inherited (5 total, includedInheritedIdentitiesPerPlan
 *                 dropped from 3 to 1); Pro image cap disclosed at
 *                 20/month; add-on prices re-stated; explicit "no free
 *                 trial" clause added.
 *   2026-07-27e — Terms §8 rewritten for the locked tier structure:
 *                 $25 Plus tier retired; new $5/mo Basic tier (3
 *                 personal identities, 100 msg/mo, 10 img/mo); Pro
 *                 $10 → $12/mo and now message-capped at 300/mo (was
 *                 unlimited) with 30 img/mo (was 20); Free re-scoped
 *                 to 20 msg/mo + 1 img/mo (was 100 + 0); one-time
 *                 add-on packs disclosed (Small $5, Medium $10, Large
 *                 $20 — each adds messages OR images); "no free
 *                 trial" clause retained.
 */
export const CURRENT_TERMS_VERSION = "2026-07-27e";

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
