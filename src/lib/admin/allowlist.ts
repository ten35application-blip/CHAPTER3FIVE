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
