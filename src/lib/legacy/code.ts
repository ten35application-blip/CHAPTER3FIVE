import { randomInt } from "node:crypto";

/**
 * Inherit-code generation. Server-only (node:crypto) — the isomorphic
 * formatting/validation helpers live in code-format.ts.
 *
 * Format: chapter-XXXX-word-word
 *   - XXXX: 4 cryptographically-random digits
 *   - two distinct words from the curated list below
 *
 * Space: 10,000 × 60 × 59 ≈ 35M combinations. Codes are resolved server-side
 * through the service-role client (no client-visible lookup), and the unique
 * constraint on inherit_codes.code means a collision at mint time just
 * retries with a fresh roll.
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
  const first = randomInt(INHERIT_WORDS.length);
  let second = randomInt(INHERIT_WORDS.length - 1);
  if (second >= first) second += 1; // guarantee two distinct words
  return `chapter-${digits}-${INHERIT_WORDS[first]}-${INHERIT_WORDS[second]}`;
}
