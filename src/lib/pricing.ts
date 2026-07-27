/**
 * Single source of truth for plan pricing.
 *
 * Wilson's pricing (July 2026 rework):
 *   - $10/month Pro. Doubled from $5 to move the tier out of the
 *     "too-cheap-to-be-sustainable" zone as launch approaches. Free
 *     tier now chats with the shared "Adrian" concierge (oracles.
 *     is_concierge = true; renamed from "Chapter" in 0097), so cost
 *     per free user drops to fractions of a cent instead of a per-user
 *     synthesis + per-user cache.
 *   - Pro slots: 3 formula-rolled + 1 photo-derived + 1 inherited = 5
 *     total. Inherited is a distinct slot rather than a countable
 *     resource (the old "up to 3 inherited on top of 5 self-created"
 *     model is retired -- protects margin as prices double).
 *   - Images: 0/month on Free, 20/month on Pro. Monthly (not daily) so
 *     Sunday clustering doesn't hit an artificial wall. 20/mo × ~$0.015
 *     Anthropic vision = ~$0.30/mo worst-case per Pro user.
 *   - No 30-day trial. Freemium via the concierge is the discovery
 *     path; existing trialers keep theirs until it expires (isPro still
 *     honors trial_ends_at) but handle_new_user (0096) no longer
 *     hands new ones out.
 *
 * When the price changes next quarter, change it HERE and let every
 * copy site pull from this object. Legal prose in /terms is
 * intentionally static text -- update it by hand alongside this file
 * so the effective date moves too.
 */
export const PRICING = {
  monthlyCents: 1000, // $10.00 (was $5 pre-July-2026 rework)
  formulaIdentitiesPerPlan: 3,
  photoIdentitiesPerPlan: 1,
  /** Ceiling on user-created oracles (formula + photo). Inherited
   *  identities have a separate ceiling. */
  totalIdentitiesPerPlan: 4,
  extraIdentityCents: 500, // $5/mo per identity beyond the base 4
  /** One inherited identity is included with Pro. Legacy identities
   *  from someone else's inherit code use this slot. Extras beyond
   *  the included one are the same $5/month per slot as an extra
   *  self-created identity. Down from 3 in the July-2026 rework --
   *  scarcity plus margin protection at the doubled price point. */
  includedInheritedIdentitiesPerPlan: 1,
  extraInheritedIdentityCents: 500,
  /** One-time paywall to restore an identity from the recently-deleted
   *  bin. Free archive vs paid restore is the intentional wedge --
   *  changing your mind after a delete has a cost, changing your mind
   *  after an archive doesn't. Stored on each oracle at creation time
   *  so a user pays what they saw. */
  restoreIdentityCents: 500,
  /** Monthly message cap for the Free tier. Pro is unlimited. Counted
   *  per calendar month against the user's outgoing messages
   *  (role='user') across all their conversations. */
  freeMessagesPerMonth: 100,
  /** Monthly image-attachment cap. Vision analysis adds ~$0.015 per
   *  image on top of ~$0.005 text-only turn cost -- monthly caps
   *  bound that cleanly. Free is zero (moderation + cost); Pro gets
   *  a real conversational allowance. */
  imagesPerMonthFree: 0,
  imagesPerMonthPro: 20,
  /** Monthly Anthropic-spend cap for the Free tier, in whole cents.
   *  Wilson pays for Claude tokens directly; this hard-stops runaway
   *  spend on Free users (misbehaving accounts, testing loops, edge
   *  cases). Pro/admin are never gated. Cap is on ESTIMATED cost
   *  (recorded per call via recordAnthropicSpend); over-run by one
   *  in-flight call is acceptable. */
  freeMonthlySpendCents: 1000,
  currency: "USD",
} as const;

/** "$10" -- formatted whole-dollar price for copy sites. */
export const MONTHLY_PRICE_LABEL = `$${PRICING.monthlyCents / 100}`;

/** "$5" -- extra self-created identity beyond the base 4. */
export const EXTRA_IDENTITY_PRICE_LABEL = `$${PRICING.extraIdentityCents / 100}`;

/** "$5" -- extra inherited identity beyond the one included. */
export const EXTRA_INHERITED_PRICE_LABEL = `$${PRICING.extraInheritedIdentityCents / 100}`;

/** "$5" -- one-time paywall on restoring a deleted identity. */
export const RESTORE_IDENTITY_PRICE_LABEL = `$${PRICING.restoreIdentityCents / 100}`;

/** "100" -- monthly message cap for the Free tier. */
export const FREE_MESSAGES_PER_MONTH = PRICING.freeMessagesPerMonth;

/** "20" -- monthly image cap for the Pro tier. */
export const PRO_IMAGES_PER_MONTH = PRICING.imagesPerMonthPro;

/** "$10.00" -- user-facing label for the Free monthly spend cap. */
export const FREE_MONTHLY_SPEND_LABEL = `$${(PRICING.freeMonthlySpendCents / 100).toFixed(2)}`;
