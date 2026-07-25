import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin/allowlist";

/** Early-access cap: only the first N users receive the signup trial. */
const TRIAL_SEAT_CAP = 1000;

/**
 * The single source of truth for "is this user Pro?".
 *
 * Rules:
 *   - Allowlisted admin emails are ALWAYS Pro (no persistence required).
 *   - profiles.pro_until in the future = Pro (Stripe / admin grant).
 *   - profiles.trial_ends_at in the future = Pro (the 30-day signup
 *     trial — full access, no card).
 *   - Otherwise = Free tier: exactly one chattable identity
 *     (profiles.free_identity_id; see canChatWithOracle).
 *
 * The Stripe webhook writes pro_until on successful checkout / renewal.
 * The admin grant tool at /admin/users/[id] writes it directly.
 * handle_new_user (0072) writes trial_ends_at at signup.
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
    .select("pro_until, trial_ends_at")
    .eq("id", user.id)
    .maybeSingle<{ pro_until: string | null; trial_ends_at: string | null }>();

  if (error || !data) return false;
  const now = Date.now();
  if (data.pro_until && new Date(data.pro_until).getTime() > now) return true;
  if (data.trial_ends_at && new Date(data.trial_ends_at).getTime() > now) {
    return true;
  }
  return false;
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

/**
 * The ONE identity a Free-tier user keeps chatting with after the
 * trial. NULL when nothing has claimed the slot yet (assigned by the
 * identity-creation actions via claimFreeIdentitySlot). Never throws.
 */
export async function getFreeIdentityId(
  supabase?: SupabaseClient,
): Promise<string | null> {
  try {
    const client = supabase ?? (await createClient());
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return null;

    const { data, error } = await client
      .from("profiles")
      .select("free_identity_id")
      .eq("id", user.id)
      .maybeSingle<{ free_identity_id: string | null }>();

    if (error) return null;
    return data?.free_identity_id ?? null;
  } catch {
    return null;
  }
}

/**
 * May the current user chat with this identity?
 *   - Pro (paid, admin, or in-trial): yes, always.
 *   - Free tier: only their free_identity_id.
 * Never throws — any failure reads as "no" (fail-closed).
 */
export async function canChatWithOracle(
  oracleId: string,
  supabase?: SupabaseClient,
): Promise<boolean> {
  try {
    const client = supabase ?? (await createClient());
    if (await isPro(client)) return true;
    const freeId = await getFreeIdentityId(client);
    return freeId !== null && freeId === oracleId;
  } catch {
    return false;
  }
}

/**
 * Claim the Free-tier slot for a just-created identity, if nothing
 * holds it yet. Called by the identity-creation server actions right
 * after a successful oracles insert — so "the first identity they
 * created" becomes the post-trial free one by default.
 *
 * Service-role client on purpose: free_identity_id is guarded by
 * protect_billing_columns (0072), so user-role writes are rejected.
 * The `.is(null)` filter makes the claim first-wins. Best-effort;
 * never throws (a missed claim self-heals on the next creation).
 */
export async function claimFreeIdentitySlot(
  userId: string,
  oracleId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ free_identity_id: oracleId })
      .eq("id", userId)
      .is("free_identity_id", null);
    if (error) {
      console.error("[subscription] free-identity claim failed:", error);
    }
  } catch (err) {
    console.error("[subscription] free-identity claim failed:", err);
  }
}

/**
 * How many of the 1000 early-access trial seats are still open.
 * Service-role count (RLS hides other rows from user clients).
 * Display-only — the authoritative gate lives in handle_new_user.
 * Never throws; errors read as 0 remaining.
 */
export async function trialSpotsRemaining(): Promise<number> {
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan_source", "trial");
    if (error || count === null) return 0;
    return Math.max(0, TRIAL_SEAT_CAP - count);
  } catch {
    return 0;
  }
}
