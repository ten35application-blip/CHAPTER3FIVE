import { redirect } from "next/navigation";

/**
 * Redirect with a user-safe error message in the query string.
 *
 * Why: raw Supabase/Postgres errors can include internal column names,
 * constraint names, RLS policy hints — none of which a user should see
 * and some of which leak schema details. Use this anywhere we'd otherwise
 * URL-encode `error.message` directly.
 *
 * The raw error is still logged server-side so we can debug from Vercel
 * logs / Supabase admin without exposing it to the URL.
 *
 * Calls `redirect()` so it never returns (typed as `never`).
 */
export function redirectWithError(
  path: string,
  userMessage: string,
  raw?: unknown,
): never {
  if (raw) {
    console.error(`[action error] ${path}: ${userMessage}`, raw);
  }
  redirect(`${path}?error=${encodeURIComponent(userMessage)}`);
}
