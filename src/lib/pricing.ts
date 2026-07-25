/**
 * Single source of truth for plan pricing.
 *
 * Wilson's pricing (July 2026): $5/month buys 5 identities total —
 * 4 formula-generated, plus 1 special slot generated from a photo
 * the user uploads. First identity is still free at signup.
 *
 * No overage tier yet: a sixth identity requires a separate paid
 * slot, spec deferred. When the price changes next quarter, change
 * it HERE and let copy that renders numbers pull from this object.
 * (Legal prose in /terms is intentionally static text — update it
 * by hand alongside this file so the effective date moves too.)
 */
export const PRICING = {
  monthlyCents: 500, // $5.00
  formulaIdentitiesPerPlan: 4,
  photoIdentitiesPerPlan: 1,
  totalIdentitiesPerPlan: 5,
  currency: "USD",
} as const;

/** "$5" — formatted whole-dollar price for copy sites. */
export const MONTHLY_PRICE_LABEL = `$${PRICING.monthlyCents / 100}`;
