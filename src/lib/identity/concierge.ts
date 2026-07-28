/**
 * Concierge helpers. The concierge is one hand-crafted oracle row
 * (oracles.is_concierge = true) that every free-tier user chats with.
 * A single persona_prompt is shared across the entire free tier, which
 * keeps Anthropic's prompt cache warm across thousands of users and
 * drops per-user cost to fractions of a cent.
 *
 * Two runtime concerns this file owns:
 *
 *   1. Look up the concierge id without a query per call. It's a
 *      fixed system object -- cache the id at module scope on first
 *      lookup and reuse it for the life of the process. First cold
 *      request per Vercel serverless invocation pays one SELECT; the
 *      rest of that invocation is free.
 *
 *   2. Build the pricing block that gets injected AFTER the persona_prompt
 *      cache breakpoint at chat time. The persona_prompt itself never
 *      mentions dollar amounts on purpose -- so pricing changes never
 *      invalidate the cached prefix. This block is the fresh copy
 *      the concierge reads to answer "what does Pro cost."
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  ADDON_PACKS,
  BASIC_IMAGES_PER_MONTH,
  BASIC_MESSAGES_PER_MONTH,
  BASIC_MONTHLY_PRICE_LABEL,
  BASIC_TIER_LABEL,
  EXTRA_IDENTITY_PRICE_LABEL,
  FREE_IMAGES_PER_MONTH,
  FREE_MESSAGES_PER_MONTH,
  INHERITED_SLOT_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PRICING,
  PRO_IMAGES_PER_MONTH,
  PRO_MESSAGES_PER_MONTH,
} from "@/lib/pricing";

/** Cached concierge id -- populated on first successful lookup, then
 *  reused. Never invalidated within a process; a redeploy of the
 *  edge/server function restarts the cache from cold. */
let cachedConciergeId: string | null = null;

/**
 * Return the concierge oracle id. Uses the service-role client because
 * the concierge is owned by the admin account -- and the public-read
 * RLS policy is scoped to authenticated sessions, which this helper
 * may be called outside of.
 *
 * Returns null when the concierge is somehow missing (deleted, seed
 * skipped in a fresh env) so callers can degrade gracefully.
 */
export async function getConciergeId(): Promise<string | null> {
  if (cachedConciergeId) return cachedConciergeId;
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("oracles")
      .select("id")
      .eq("is_concierge", true)
      .maybeSingle<{ id: string }>();
    cachedConciergeId = data?.id ?? null;
    return cachedConciergeId;
  } catch {
    return null;
  }
}

/**
 * Pricing block for post-cache-breakpoint injection into the concierge's
 * system prompt. The concierge's persona_prompt tells it to refer to
 * this block instead of quoting dollar amounts from memory, so a
 * pricing change lands in the same request without a redeploy.
 *
 * Renders straight from `src/lib/pricing.ts` so this stays truthful.
 * Kept small on purpose -- the concierge should answer "what does Pro
 * cost" from this alone.
 */
export function buildConciergePricingBlock(): string {
  return [
    "== CURRENT PRICING (refer to this whenever pricing comes up — do NOT quote numbers from memory) ==",
    "",
    "Every plan includes you (Adrian). Every plan has a monthly message and photo cap — there is no unlimited tier.",
    "",
    "FREE TIER — $0/month.",
    `Chat with you (Adrian) only — no formula or photo identities. ${FREE_MESSAGES_PER_MONTH} messages and ${FREE_IMAGES_PER_MONTH} photo send a month. When someone is ready to build their own identities, they upgrade.`,
    "- CAN record their own legacy archive (answer the forty questions themselves and mint an inherit code to hand to family) — recording + minting is on EVERY plan, Free included",
    "",
    `${BASIC_TIER_LABEL.toUpperCase()} — ${BASIC_MONTHLY_PRICE_LABEL}/month.`,
    `- ${PRICING.basicTotalIdentitiesPerPlan} personal identities (${PRICING.basicFormulaIdentitiesPerPlan} rolled from the formula + ${PRICING.basicPhotoIdentitiesPerPlan} built from a photo they upload)`,
    `- ${BASIC_MESSAGES_PER_MONTH} messages a month`,
    `- ${BASIC_IMAGES_PER_MONTH} photos a month they can send to any of their companions`,
    "- Cancel any time. No refunds mid-month.",
    "",
    `PRO — ${MONTHLY_PRICE_LABEL}/month.`,
    `- ${PRICING.totalIdentitiesPerPlan} personal identities (${PRICING.formulaIdentitiesPerPlan} rolled from the formula + ${PRICING.photoIdentitiesPerPlan} built from a photo they upload)`,
    `- ${PRO_MESSAGES_PER_MONTH} messages a month`,
    `- ${PRO_IMAGES_PER_MONTH} photos a month they can send to any of their companions`,
    "- Cancel any time. No refunds mid-month.",
    "",
    "INHERIT CODES (redeeming an identity someone shared). No plan includes or requires this — it is per code, on ANY tier:",
    `- Redeeming ANY inherit code is a ${INHERITED_SLOT_PRICE_LABEL} ONE-TIME purchase — once per code, never a monthly fee. Flat: the same fee on every plan, for every code, no exceptions. Never tell anyone a redemption can be free.`,
    "",
    "ADD-ON PACKS (one-time purchases on top of a plan; each pack adds EITHER messages OR images — one type per pack, their pick):",
    ...ADDON_PACKS.map(
      (pack) =>
        `- ${pack.name} — ${pack.priceLabel} one-time → +${pack.messages} messages OR +${pack.images} images`,
    ),
    "",
    "EXTRAS BEYOND THE PLAN",
    `- ${EXTRA_IDENTITY_PRICE_LABEL}/month per extra self-created identity beyond the plan's included slots`,
    "",
    "NO TRIAL. Free is real -- someone can use you (Adrian) forever without paying, and can even record their legacy archive and mint a code. Basic is the first paid step (their own identities); Pro is the bigger cast with more room every month.",
  ].join("\n");
}
