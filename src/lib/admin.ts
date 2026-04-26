/**
 * Admin gate. Only these emails can access /admin and admin-only server
 * actions. Hard-coded by design — admin status is sensitive enough that a
 * DB column is more attack surface than benefit at this size.
 */
export const ADMIN_EMAILS = [
  "danisel.feliz95@gmail.com",
  "wfeliz2290@gmail.com",
  "p.infante.jr@gmail.com",
];

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
