/**
 * Route Supabase-hosted images through Next's optimizer (2026-08-26 —
 * the Supabase fair-use email: cached egress blew the free plan's cap
 * because every avatar render pulled the 1024px original). The
 * optimizer resizes and caches on Vercel; Supabase serves each source
 * roughly once ever. Non-storage URLs pass through untouched. Widths
 * must be on Next's size ladder (…128, 256, 384, 640…).
 */
export function cdnImage(
  url: string | null | undefined,
  width: 128 | 256 | 384 | 640 = 256,
): string | undefined {
  if (!url) return undefined;
  if (!url.includes("/storage/v1/object/public/")) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=70`;
}
