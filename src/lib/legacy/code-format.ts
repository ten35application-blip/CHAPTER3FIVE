/**
 * Isomorphic inherit-code formatting helpers.
 *
 * Kept separate from code.ts (which imports node:crypto) so the client-side
 * inherit form can import these without dragging Node built-ins into the
 * browser bundle.
 *
 * Canonical shape: chapter-XXXX-word-word
 *   - XXXX is 4 digits
 *   - the two words come from the curated wordlist in code.ts
 */

const CODE_SHAPE = /^chapter-\d{4}-[a-z]+-[a-z]+$/;

/**
 * Live formatter for the inherit input. Lowercases, turns spaces into
 * hyphens, strips anything that isn't [a-z0-9-], and auto-inserts the
 * hyphens after "chapter" and after the 4 digits as the user types.
 */
export function formatInheritCodeInput(raw: string): string {
  let v = raw
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-");
  v = v.replace(/^chapter(?=\d)/, "chapter-");
  v = v.replace(/^(chapter-\d{4})(?=[a-z])/, "$1-");
  return v;
}

/**
 * Server-side normalization before lookup. Forgiving: accepts stray
 * whitespace, uppercase, and a missing "chapter-" prefix when the rest of
 * the code is intact ("4291-heart-elm").
 */
export function normalizeInheritCode(raw: string): string {
  let v = formatInheritCodeInput(raw).replace(/^-+|-+$/g, "");
  if (/^\d{4}-/.test(v)) v = `chapter-${v}`;
  return v;
}

/** Structural check only — says nothing about whether the code exists. */
export function isInheritCodeShaped(code: string): boolean {
  return CODE_SHAPE.test(code);
}
