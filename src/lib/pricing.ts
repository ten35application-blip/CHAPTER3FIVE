/**
 * Single source of truth for plan pricing.
 *
 * Wilson's tier structure (SECOND July 2026 rework — locked after
 * seeing the full Stripe wiring; supersedes the $12-Pro layout):
 *
 *   FREE  — $0/mo.   No personal identities — just Adrian, the shared
 *           concierge (oracles.is_concierge = true). 20 messages and
 *           1 image attachment per calendar month.
 *   BASIC — $5/mo.   3 personal identities (2 formula + 1 photo) on
 *           top of Adrian. 100 messages and 10 images per month. CAN
 *           record a legacy archive and mint an inherit code (was
 *           Pro-only before this rework).
 *   PRO   — $10/mo.  5 self-created identities (4 formula + 1 photo)
 *           on top of Adrian. 300 messages and 30 images per month.
 *           (Was $12 with 3 formula + 1 photo + 1 bundled inherited
 *           slot; the price dropped and the identity count grew to
 *           compensate for the unbundled inherited slot.)
 *
 * THE INHERITED SLOT IS UNBUNDLED (this rework's headline). No tier
 * includes a free inherited slot anymore, and no tier is required to
 * redeem: every inherit-code redemption is a $5 ONE-TIME purchase
 * (inheritedSlotPurchaseCents; Stripe purpose
 * 'inherited_slot_purchase' → profiles.inherited_slot_credits),
 * replacing the old $5/MONTH recurring extra-inherited-slot model
 * (extraInheritedIdentityCents, deleted). The MEMORIAL WAIVER is on
 * by default: when the code's minter has passed away
 * (profiles.deceased_at set — a post-mortem beneficiary claim),
 * redemption is free and no credit is consumed. Living-minter codes
 * (alive-preparing, friend-gift, playful) pay the $5.
 *
 * Adrian is universal — every tier, including Free, chats with the
 * concierge. Personal identity slots are on TOP of Adrian.
 *
 * EVERY tier is message-capped. Overage is handled by one-time
 * add-on packs instead of an unlimited tier:
 *
 *   Small  — $5   → +100 messages OR +12 images
 *   Medium — $10  → +250 messages OR +30 images
 *   Large  — $20  → +600 messages OR +75 images
 *
 * A pack is one-time (not recurring) and the buyer picks ONE type per
 * pack: messages or images, never both.
 *
 * When a price changes, change it HERE and let every copy site pull
 * from this object. Legal prose in /terms is intentionally static
 * text — update it by hand alongside this file so the effective date
 * moves too.
 */
export const PRICING = {
  /* ── Pro ($10/mo) ─────────────────────────────────────────────── */
  monthlyCents: 1000, // $10.00 (was $12 with the bundled inherited slot)
  formulaIdentitiesPerPlan: 4,
  photoIdentitiesPerPlan: 1,
  /** Ceiling on user-created oracles (formula + photo). Inherited
   *  identities are not counted here — they're per-code purchases. */
  totalIdentitiesPerPlan: 5,
  extraIdentityCents: 500, // $5/mo per identity beyond the base 5
  /** NO inherited slot is bundled with any plan since the July 2026
   *  second rework — every inherit-code redemption is the one-time
   *  inheritedSlotPurchaseCents purchase (memorial waiver aside).
   *  Kept as an explicit 0 so slot math keeps compiling against one
   *  constant instead of scattering hardcoded zeros. */
  includedInheritedIdentitiesPerPlan: 0,
  /** $5 ONE-TIME per inherit-code redemption (replaces the retired
   *  $5/month extraInheritedIdentityCents recurring slot). Waived
   *  when the code's minter is deceased — the memorial waiver. */
  inheritedSlotPurchaseCents: 500,
  /** Monthly message cap for Pro. NEW in the pack rework — Pro was
   *  unlimited before. Counted per calendar month against the user's
   *  outgoing messages (role='user') across all conversations. */
  proMessagesPerMonth: 300,
  imagesPerMonthPro: 30, // was 20 pre-pack-rework

  /* ── Basic ($5/mo) ────────────────────────────────────────────── */
  basicMonthlyCents: 500, // $5.00
  /** Basic slot split: 2 formula + 1 photo = 3 personal identities.
   *  Wilson locked "3 identities" without a split; 2+1 keeps the
   *  photo path reachable on the starter tier while Pro stays the
   *  bigger-formula-cast option. */
  basicFormulaIdentitiesPerPlan: 2,
  basicPhotoIdentitiesPerPlan: 1,
  /** Ceiling on user-created oracles (formula + photo) on Basic. */
  basicTotalIdentitiesPerPlan: 3,
  /** Same as Pro since the inherited-slot unbundle: zero included;
   *  redemption is the per-code one-time purchase on every tier. */
  basicIncludedInheritedIdentitiesPerPlan: 0,
  basicMessagesPerMonth: 100,
  basicImagesPerMonth: 10,

  /* ── Free ($0/mo) ─────────────────────────────────────────────── */
  /** Monthly message cap for the Free tier (was 100 pre-pack-rework;
   *  20 sizes Free as "meet Adrian," not "live here"). */
  freeMessagesPerMonth: 20,
  /** Free gets ONE image send a month (was 0) — enough to see the
   *  feature work, not enough to lean on it. */
  imagesPerMonthFree: 1,

  /* ── Other one-time SKUs ──────────────────────────────────────── */
  /** One-time paywall to restore an identity from the recently-deleted
   *  bin. Free archive vs paid restore is the intentional wedge —
   *  changing your mind after a delete has a cost, changing your mind
   *  after an archive doesn't. Stored on each oracle at creation time
   *  so a user pays what they saw. */
  restoreIdentityCents: 500,

  /* ── Add-on packs (one-time; messages OR images per pack) ─────── */
  packSmallCents: 500, // $5.00
  packSmallMessages: 100,
  packSmallImages: 12,
  packMediumCents: 1000, // $10.00
  packMediumMessages: 250,
  packMediumImages: 30,
  packLargeCents: 2000, // $20.00
  packLargeMessages: 600,
  packLargeImages: 75,

  /* ── Spend governor ───────────────────────────────────────────── */
  /** Monthly Anthropic-spend cap for the Free tier, in whole cents.
   *  Wilson pays for Claude tokens directly; this hard-stops runaway
   *  spend on Free users (misbehaving accounts, testing loops, edge
   *  cases). Paid/admin are never gated here — the per-tier message
   *  and image caps bound their spend instead. Cap is on ESTIMATED
   *  cost (recorded per call via recordAnthropicSpend); over-run by
   *  one in-flight call is acceptable. */
  freeMonthlySpendCents: 1000,
  currency: "USD",
} as const;

/** "$10" — formatted whole-dollar Pro price for copy sites. */
export const MONTHLY_PRICE_LABEL = `$${PRICING.monthlyCents / 100}`;

/** Basic tier name. The single string to change if Wilson renames the
 *  tier; every surface must render the name through this constant,
 *  never a literal. */
export const BASIC_TIER_LABEL = "chapter3five Basic";

/** "$5" — formatted whole-dollar Basic price for copy sites. */
export const BASIC_MONTHLY_PRICE_LABEL = `$${PRICING.basicMonthlyCents / 100}`;

/** "$5" — extra self-created identity beyond the plan's ceiling. */
export const EXTRA_IDENTITY_PRICE_LABEL = `$${PRICING.extraIdentityCents / 100}`;

/** "$5" — one-time inherit-slot purchase, paid per code redeemed
 *  (waived when the code's minter has passed away). Replaces the
 *  retired EXTRA_INHERITED_PRICE_LABEL ($5/month recurring slot). */
export const INHERITED_SLOT_PRICE_LABEL = `$${PRICING.inheritedSlotPurchaseCents / 100}`;

/** @deprecated Transitional alias for INHERITED_SLOT_PRICE_LABEL —
 *  the recurring extra-inherited-slot SKU is retired. Deleted once
 *  the copy surfaces move off it (same rework, later commit). */
export const EXTRA_INHERITED_PRICE_LABEL = INHERITED_SLOT_PRICE_LABEL;

/** "$5" — one-time paywall on restoring a deleted identity. */
export const RESTORE_IDENTITY_PRICE_LABEL = `$${PRICING.restoreIdentityCents / 100}`;

/** 20 — monthly message cap for the Free tier. */
export const FREE_MESSAGES_PER_MONTH = PRICING.freeMessagesPerMonth;

/** 1 — monthly image cap for the Free tier. */
export const FREE_IMAGES_PER_MONTH = PRICING.imagesPerMonthFree;

/** 100 — monthly message cap for the Basic tier. */
export const BASIC_MESSAGES_PER_MONTH = PRICING.basicMessagesPerMonth;

/** 10 — monthly image cap for the Basic tier. */
export const BASIC_IMAGES_PER_MONTH = PRICING.basicImagesPerMonth;

/** 300 — monthly message cap for the Pro tier. */
export const PRO_MESSAGES_PER_MONTH = PRICING.proMessagesPerMonth;

/** 30 — monthly image cap for the Pro tier. */
export const PRO_IMAGES_PER_MONTH = PRICING.imagesPerMonthPro;

/** "$10.00" — user-facing label for the Free monthly spend cap. */
export const FREE_MONTHLY_SPEND_LABEL = `$${(PRICING.freeMonthlySpendCents / 100).toFixed(2)}`;

/**
 * The three add-on packs in display order, ready for UI iteration.
 * One-time purchases; each pack is messages OR images, buyer's pick.
 * Not Stripe-wired yet — surfaces render mailto reserve buttons until
 * the Price objects exist.
 */
export const ADDON_PACKS = [
  {
    id: "small",
    name: "Small",
    priceLabel: `$${PRICING.packSmallCents / 100}`,
    messages: PRICING.packSmallMessages,
    images: PRICING.packSmallImages,
  },
  {
    id: "medium",
    name: "Medium",
    priceLabel: `$${PRICING.packMediumCents / 100}`,
    messages: PRICING.packMediumMessages,
    images: PRICING.packMediumImages,
  },
  {
    id: "large",
    name: "Large",
    priceLabel: `$${PRICING.packLargeCents / 100}`,
    messages: PRICING.packLargeMessages,
    images: PRICING.packLargeImages,
  },
] as const;

/** "$5" — the cheapest pack, for "packs from $5" copy. */
export const PACK_FROM_PRICE_LABEL = ADDON_PACKS[0].priceLabel;
