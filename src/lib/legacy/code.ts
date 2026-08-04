import { randomInt } from "node:crypto";

/**
 * Inherit-code generation. Server-only (node:crypto) — the isomorphic
 * formatting/validation helpers live in code-format.ts.
 *
 * Format: chapter-XXXX-word-word-word
 *   - XXXX: 4 cryptographically-random digits
 *   - three distinct words from the curated list below
 *
 * Space: 10,000 × 60 × 59 × 58 ≈ 2.05 BILLION (~31 bits).
 *
 * WIDENED 2026-08-04 from two words (~35M, ~25 bits). The old size was
 * defended in identity/inherit/actions.ts with the claim that "codes are
 * 128-bit-ish random strings" — wrong by about 100 bits, and it was the
 * stated basis for accepting the enumeration risk. What sits behind one
 * of these is a dead person's recorded answers, so the bar is higher
 * than a discount code's.
 *
 * A third word rather than a longer digit block on purpose: these are
 * read aloud over the phone to grandparents, and words survive that
 * better than digits do.
 *
 * Entropy is only half the fix. 2 billion is still guessable in bulk if
 * probing is free and unlimited, so redemption is rate-limited per user
 * (migration 0131, lib/legacy/redeemLimit.ts). Codes are resolved
 * server-side through the service-role client (no client-visible
 * lookup), and the unique constraint on inherit_codes.code means a
 * collision at mint just retries.
 *
 * Two-word codes minted before this change REMAIN VALID — the shape
 * check in code-format.ts accepts both. Nobody's card stops working.
 */

/**
 * ~60 words chosen to feel like the product: warm, physical, family-shaped.
 * All lowercase, no hyphens, short enough to read over the phone to a
 * grandparent.
 */
export const INHERIT_WORDS = [
  "heart",
  "elm",
  "sparrow",
  "harbor",
  "meadow",
  "lantern",
  "quiet",
  "morning",
  "river",
  "thread",
  "acorn",
  "amber",
  "apron",
  "birch",
  "bloom",
  "brook",
  "butter",
  "candle",
  "cedar",
  "cinnamon",
  "clover",
  "compass",
  "cotton",
  "cradle",
  "creek",
  "crocus",
  "dawn",
  "dove",
  "ember",
  "evening",
  "feather",
  "fern",
  "fig",
  "garden",
  "hazel",
  "hearth",
  "honey",
  "hymn",
  "ivy",
  "juniper",
  "kettle",
  "linen",
  "maple",
  "olive",
  "pearl",
  "plum",
  "sage",
  "star",
  "stone",
  "summer",
  "sunday",
  "supper",
  "thistle",
  "tide",
  "violet",
  "walnut",
  "willow",
  "winter",
  "wool",
  "wren",
] as const;

export function generateInheritCode(): string {
  const digits = String(randomInt(0, 10000)).padStart(4, "0");
  // Three distinct words, drawn without replacement.
  const pool = [...INHERIT_WORDS];
  const words: string[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = randomInt(pool.length);
    words.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return `chapter-${digits}-${words.join("-")}`;
}
