/**
 * Shared language union for chat, notifications, extractors, and every
 * server-side pipeline that varies output by user language. Centralized
 * so adding a new locale (zh planned) doesn't mean touching ~14 files
 * that each hardcoded `"en" | "es"`.
 *
 * Callers should type language parameters as `SupportedLanguage` and
 * treat any inbound raw string as `SupportedLanguage | string` — the
 * `normalizeLanguage()` helper coerces unknown values back to the
 * default "en" instead of letting bad data leak into a prompt.
 */
export type SupportedLanguage = "en" | "es";

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  "en",
  "es",
] as const;

export function isSupportedLanguage(v: unknown): v is SupportedLanguage {
  return v === "en" || v === "es";
}

export function normalizeLanguage(v: unknown): SupportedLanguage {
  return isSupportedLanguage(v) ? v : "en";
}
