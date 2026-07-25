import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";

/**
 * The single source of truth for "is this user Pro?".
 *
 * Rules:
 *   - Allowlisted admin emails are ALWAYS Pro (no persistence required).
 *   - Otherwise: profiles.pro_until in the future = Pro.
 *   - NULL or past = free.
 *
 * The Stripe webhook writes pro_until on successful checkout / renewal.
 * The admin grant tool at /admin/users/[id] writes it directly.
 *
 * Never throws — a failed profile read counts as free (fail-closed for
 * paid features).
 */
export async function isPro(
  supabase?: SupabaseClient,
): Promise<boolean> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return false;

  if (isAdmin(user.email)) return true;

  const { data, error } = await client
    .from("profiles")
    .select("pro_until")
    .eq("id", user.id)
    .maybeSingle<{ pro_until: string | null }>();

  if (error || !data?.pro_until) return false;
  return new Date(data.pro_until).getTime() > Date.now();
}

/**
 * Server-side guard for Pro-only routes. Call from a server component
 * or server action; if it returns { ok: false }, redirect the caller
 * to the returned path.
 *
 *   const gate = await requirePro();
 *   if (!gate.ok) redirect(gate.redirectTo);
 */
export async function requirePro(
  currentPath: string,
): Promise<{ ok: true } | { ok: false; redirectTo: string }> {
  const pro = await isPro();
  if (pro) return { ok: true };
  const next = encodeURIComponent(currentPath);
  return { ok: false, redirectTo: `/upgrade?next=${next}` };
}
