import type { SupabaseClient } from "@supabase/supabase-js";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/version";

/**
 * Shared acceptance-write helpers for the two onboarding surfaces:
 *   - Web  → /src/app/onboarding/actions.ts (server action)
 *   - Mobile → /src/app/api/user/accept-terms/route.ts (Bearer POST)
 *
 * Only the NEW per-document ledger write is centralized here — the
 * profile-column write and the terms_acceptances append each surface
 * already does are deliberately left in place (mobile uses the
 * accept_terms_and_default_oracle RPC to also set the concierge as the
 * default active_oracle; web uses a direct profiles upsert because it
 * doesn't need that side-effect). Centralizing just the per-doc write
 * gives us server-side IP capture on both surfaces without disturbing
 * the two carefully-audited profile paths (Fable H-2 / M-1).
 *
 * The per-doc ledger has been on mobile since the /agreements screen
 * shipped, but the writes came from the client — the row lands in the
 * table but IP/UA are only knowable server-side, and RLS on
 * public.agreements would in principle let a hand-crafted client
 * upsert rows for whichever documents it wanted. Moving the write here
 * makes the per-doc record match the trust posture of
 * terms_acceptances (server-side, IP-stamped, whitelist-validated).
 */

/**
 * Whitelist of accepted document keys. Must be a subset of the
 * documents allowed by the public.agreements check constraint
 * (0049_expand_agreement_documents.sql: terms, privacy, cookies,
 * ai_processing, age_18plus, not_therapy, memory_mode + implicit
 * older ones). Adding a new key requires a matching migration bump
 * of the check constraint; validate here so a stale client can't
 * poison the ledger with unrecognized values.
 */
export const ALLOWED_DOCS = [
  "terms",
  "privacy",
  "cookies",
  "ai_processing",
  "eula",
  "guidelines",
  "age_18plus",
  "not_therapy",
] as const;

export type AllowedDoc = (typeof ALLOWED_DOCS)[number];

const ALLOWED_DOC_SET: ReadonlySet<string> = new Set(ALLOWED_DOCS);

/**
 * Normalize a caller-supplied docs list into a deduped array of
 * whitelist-valid keys. Silent-drops anything unrecognized so a stale
 * client (older version with a doc key we've since retired) doesn't
 * poison the ledger or 400 the whole acceptance. The caller decides
 * whether the resulting length is "enough" — this function makes no
 * completeness assertion.
 */
export function coerceDocs(input: unknown): AllowedDoc[] {
  if (!Array.isArray(input)) return [];
  const out: AllowedDoc[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") continue;
    if (!ALLOWED_DOC_SET.has(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item as AllowedDoc);
  }
  return out;
}

/**
 * Extract client IP + user agent from a request header source.
 * Accepts either a native Headers instance (API route) or the
 * headers() ReadonlyHeaders bag (server action) — both expose the
 * same `get(name)` shape.
 *
 * Vercel sets x-forwarded-for as "client-ip, proxy1, proxy2" — the
 * first entry is the client. Falls back to x-real-ip for hosts that
 * only set that header. Returns null on the fields it can't
 * determine; the ledger accepts nulls (both columns are nullable).
 */
export function extractClientNet(source: {
  get: (name: string) => string | null;
}): { ip: string | null; userAgent: string | null } {
  const forwarded = source.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0].trim()
    : (source.get("x-real-ip") ?? null);
  const userAgent = source.get("user-agent");
  return { ip, userAgent };
}

/**
 * Upsert one row per document into public.agreements at
 * CURRENT_TERMS_VERSION. Idempotent via the (user_id, document,
 * version) uniqueness — safe to re-run for the same submission
 * (double-click, retry, reload). Best-effort: logs and swallows
 * errors so a failure here can never block the user's onboarding
 * flow. The single-row profile write is the load-bearing gate; the
 * ledger is the record.
 */
export async function writePerDocAgreements(
  admin: SupabaseClient,
  userId: string,
  docs: readonly AllowedDoc[],
): Promise<void> {
  if (docs.length === 0) return;
  try {
    const rows = docs.map((doc) => ({
      user_id: userId,
      document: doc,
      version: CURRENT_TERMS_VERSION,
    }));
    const { error } = await admin
      .from("agreements")
      .upsert(rows, { onConflict: "user_id,document,version" });
    if (error) {
      console.error("[acceptance] agreements upsert failed:", error);
    }
  } catch (err) {
    console.error("[acceptance] agreements upsert threw:", err);
  }
}
