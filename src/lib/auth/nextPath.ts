/**
 * Post-auth hand-off. A public link (today: /inherit?code=…) wants the
 * person to land somewhere specific AFTER they sign in or sign up.
 * That destination rides in `?next=` on /auth/signin and, because the
 * sign-up → confirmation-email → sign-in → onboarding chain drops query
 * strings at every hop, ALSO in a short-lived cookie that sign-in and
 * onboarding both consume.
 *
 * Deliberately strict: only the inherit page is a valid target. An open
 * `next` is an open redirect.
 */
export const NEXT_COOKIE = "c35_next";
export const NEXT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days — "no rush"

/** Lowercase, hyphen-separated inherit code or null. */
export function cleanInheritCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60);
  return /^chapter-[a-z0-9-]{3,}$/.test(v) ? v : null;
}

/** The only shapes we will redirect to. Anything else → null. */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 200) return null;
  let v = raw;
  try {
    v = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (!v.startsWith("/") || v.startsWith("//") || /[\r\n\\]/.test(v)) return null;
  const m = /^\/identity\/inherit(?:\?code=([a-z0-9-]{1,60}))?$/i.exec(v);
  if (!m) return null;
  const code = cleanInheritCode(m[1]);
  return code ? `/identity/inherit?code=${code}` : "/identity/inherit";
}
