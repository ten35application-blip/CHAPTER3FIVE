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
 *   2026-07-27f — Terms §4 + §8 rewritten for the second tier rework:
 *                 Pro $12 → $10/mo with 5 self-created identities (4
 *                 formula + 1 photo); the bundled inherited slot is
 *                 removed from Pro and the $5/month extra-inherited
 *                 slot SKU is retired — redeeming an inherit code is
 *                 now a $5 ONE-TIME purchase per code on any tier,
 *                 waived when the code's creator has passed away (the
 *                 memorial waiver); recording a legacy archive +
 *                 minting a code extended to Basic; §4's Pro-plan
 *                 redemption requirement deleted.
 *   2026-07-28a — Terms §4 + §8 rewritten for the flat-fee rework:
 *                 the memorial waiver is REMOVED — redeeming ANY
 *                 inherit code is the $5 one-time inherit-slot
 *                 purchase, flat, on every plan, no exceptions (we do
 *                 not verify whether a creator is living or
 *                 deceased); recording a legacy archive + minting a
 *                 code opened to EVERY plan, Free included, and
 *                 dropped from the Basic/Pro plan feature lists.
 *   2026-07-28b — legal-doc audit before store submission. Terms §4 +
 *                 §8: the $5 one-time other-mode legacy-creation
 *                 charge (otherIdentityCreateCents, charged at Finish;
 *                 self-mode stays free) is now disclosed; the "Restore
 *                 a deleted account — $5" SKU is removed (its checkout
 *                 purpose was purged 2026-07-28 and no purchase path
 *                 exists — account restore during the 30-day grace
 *                 window is via support); Terms §4 + Privacy §7 now
 *                 state the 0111 durability model: a redeemed inherit
 *                 code yields an INDEPENDENT copy that survives the
 *                 creator deleting their account/archive/codes.
 */
export const CURRENT_TERMS_VERSION = "2026-07-28b";

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
