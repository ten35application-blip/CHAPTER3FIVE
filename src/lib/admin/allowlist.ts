/**
 * Admin allowlist. Hard-coded by design — admin status is sensitive enough
 * that a DB column is more attack surface than benefit at this size.
 *
 * Single source of truth: src/lib/admin.ts re-exports from here so the
 * edge proxy gate and the /admin layout gate can never drift apart.
 */
export const ADMIN_EMAILS = [
  "wfeliz2290@gmail.com",
  "Danisel.Feliz95@gmail.com",
  "p.infante.jr@gmail.com",
] as const;

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return ADMIN_EMAILS.some((a) => a.toLowerCase() === normalized);
}

/**
 * Admins bypass the identity-count paywall — they create for free,
 * unlimited. Wire this into the identity-create flow when the Stripe
 * gate lands (right now everything is free for everyone, so this is
 * a no-op ready to become load-bearing later).
 *
 * Also useful for the seed-test-data admin tool: when we spin up test
 * identities we don't burn admin plan slots against the 5-identity
 * Pro quota (see src/lib/pricing.ts) that isn't even wired yet.
 */
export function hasUnlimitedIdentities(
  email: string | null | undefined,
): boolean {
  return isAdmin(email);
}
