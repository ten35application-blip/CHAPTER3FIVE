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

/**
 * Render-side twin of redirectWithError: a ?error= query param is
 * attacker-writable (anyone can send a link with any text), and seven
 * pages render it as first-party system copy. The real actions only
 * ever redirect short plain sentences, so: cap the length, refuse
 * anything that parses as a link or markup, and fall back to a generic
 * line when what is left looks doctored. Every page that renders
 * searchParams.error must pass it through here first.
 */
export function sanitizeErrorParam(
  raw: string | undefined,
): string | undefined {
  if (!raw) return undefined;
  const text = raw.trim();
  if (text.length === 0 || text.length > 160) {
    return "That didn't work. Try again.";
  }
  if (/[<>]|https?:|www\.|[a-z0-9-]+\.(com|net|org|app|io|co)\b/i.test(text)) {
    return "That didn't work. Try again.";
  }
  return text;
}
