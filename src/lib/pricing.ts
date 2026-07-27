/**
 * Single source of truth for plan pricing.
 *
 * Wilson's pricing (July 2026):
 *   - $5/month base = 5 identities total (4 formula + 1 photo).
 *   - +$5/month per extra identity beyond the base 5. Recurring, same
 *     rate as the base slot — one dollar per identity per month.
 *   - First identity is still free at signup (Free tier).
 *
 * When the price changes next quarter, change it HERE and let every
 * copy site pull from this object. Legal prose in /terms is
 * intentionally static text — update it by hand alongside this file
 * so the effective date moves too.
 */
export const PRICING = {
  monthlyCents: 500, // $5.00
  formulaIdentitiesPerPlan: 4,
  photoIdentitiesPerPlan: 1,
  totalIdentitiesPerPlan: 5,
  extraIdentityCents: 500, // $5/mo per identity beyond the base 5
  /** One inherited identity (from someone else's inherit code) is
   *  included with Pro. Redeeming a second+ code costs the same
   *  $5/month per extra as a self-created extra identity. */
  includedInheritedIdentitiesPerPlan: 1,
  extraInheritedIdentityCents: 500,
  /** One-time paywall to restore an identity from the recently-deleted
   *  bin. Free archive vs paid restore is the intentional wedge —
   *  changing your mind after a delete has a cost, changing your mind
   *  after an archive doesn't. Stored on each oracle at creation time
   *  so a user pays what they saw. */
  restoreIdentityCents: 500,
  /** Monthly message cap for the Free tier. Pro is unlimited. Counted
   *  per calendar month against the user's outgoing messages
   *  (role='user') across all their conversations. Wilson's rule:
   *  free is a taste, Pro removes the ceiling. */
  freeMessagesPerMonth: 100,
  /** Monthly Anthropic-spend cap for the Free tier, in whole cents.
   *  Wilson pays for Claude tokens directly; this hard-stops runaway
   *  spend on Free users (misbehaving accounts, testing loops, edge
   *  cases). Pro/admin/trial are never gated. Cap is on ESTIMATED cost
   *  (recorded per call via recordAnthropicSpend); over-run by one
   *  in-flight call is acceptable. */
  freeMonthlySpendCents: 1000,
  currency: "USD",
} as const;

/** "$5" — formatted whole-dollar price for copy sites. */
export const MONTHLY_PRICE_LABEL = `$${PRICING.monthlyCents / 100}`;

/** "$5" — same shape, kept as its own label so future divergence
 *  (e.g. $3 extras) doesn't ripple through half the codebase. */
export const EXTRA_IDENTITY_PRICE_LABEL = `$${PRICING.extraIdentityCents / 100}`;

/** "$5" — extra inherited identity beyond the one included. */
export const EXTRA_INHERITED_PRICE_LABEL = `$${PRICING.extraInheritedIdentityCents / 100}`;

/** "$5" — one-time paywall on restoring a deleted identity. */
export const RESTORE_IDENTITY_PRICE_LABEL = `$${PRICING.restoreIdentityCents / 100}`;

/** "100" — monthly message cap for the Free tier. */
export const FREE_MESSAGES_PER_MONTH = PRICING.freeMessagesPerMonth;

/** "$10.00" — user-facing label for the Free monthly spend cap. */
export const FREE_MONTHLY_SPEND_LABEL = `$${(PRICING.freeMonthlySpendCents / 100).toFixed(2)}`;
