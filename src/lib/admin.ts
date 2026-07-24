/**
 * Back-compat shim — the canonical allowlist now lives in
 * src/lib/admin/allowlist.ts. The edge proxy (src/proxy.ts) imports from
 * here; keep both entry points pointing at the same list.
 */
export { ADMIN_EMAILS, isAdmin } from "@/lib/admin/allowlist";
