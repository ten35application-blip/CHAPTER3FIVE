import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin/allowlist";
import { PRICING } from "@/lib/pricing";

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
 * Cron / service-context variant of isPro that takes a user_id
 * directly (no auth.getUser). Uses the admin client. Returns false
 * on any failure so a broken query never accidentally elevates a
 * Free user to Pro.
 */
export async function isProByUserId(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("email, pro_until, trial_ends_at")
      .eq("id", userId)
      .maybeSingle<{
        email: string | null;
        pro_until: string | null;
        trial_ends_at: string | null;
      }>();
    if (error || !data) return false;
    if (isAdmin(data.email)) return true;
    const now = Date.now();
    if (data.pro_until && new Date(data.pro_until).getTime() > now) return true;
    if (data.trial_ends_at && new Date(data.trial_ends_at).getTime() > now) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
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
  precomputedIsPro?: boolean,
): Promise<boolean> {
  try {
    const client = supabase ?? (await createClient());
    const pro =
      precomputedIsPro !== undefined
        ? precomputedIsPro
        : await isPro(client);
    if (pro) return true;
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
 * Guard for identity creation ("can this user create another
 * oracle right now?"). Applies to formula + photo flows; legacy
 * has its own Pro gate at requirePro.
 *
 * Rules:
 *   - Free tier: allowed only if they don't have their free
 *     identity yet (profiles.free_identity_id is null).
 *   - Pro / trial / admin: allowed up to
 *     PRICING.totalIdentitiesPerPlan + extra_oracle_credits.
 *     extra_oracle_credits is bumped by successful Stripe
 *     'oracle' purchases (webhook writes via service role).
 *
 * Never throws. Fail-CLOSED on any error so a broken profile
 * read doesn't accidentally let a user farm identities.
 */
export async function canCreateOracle(
  userId: string,
): Promise<
  | { ok: true }
  | {
      ok: false;
      reason: "upgrade_required" | "quota_reached" | "unknown";
      currentCount?: number;
      quota?: number;
    }
> {
  try {
    const admin = createAdminClient();
    const [{ data: profile }, { count }] = await Promise.all([
      admin
        .from("profiles")
        .select(
          "email, pro_until, trial_ends_at, plan_source, free_identity_id, extra_oracle_credits",
        )
        .eq("id", userId)
        .maybeSingle<{
          email: string | null;
          pro_until: string | null;
          trial_ends_at: string | null;
          plan_source: string | null;
          free_identity_id: string | null;
          extra_oracle_credits: number | null;
        }>(),
      admin
        .from("oracles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("deleted_at", null),
    ]);

    if (!profile) return { ok: false, reason: "unknown" };

    const now = Date.now();
    const isProUser =
      isAdmin(profile.email) ||
      (profile.pro_until && new Date(profile.pro_until).getTime() > now) ||
      (profile.trial_ends_at &&
        new Date(profile.trial_ends_at).getTime() > now);

    const currentCount = count ?? 0;

    if (!isProUser) {
      // Free tier — one identity, ever. Once free_identity_id is
      // set (via claimFreeIdentitySlot), they need Pro to make more.
      if (profile.free_identity_id) {
        return { ok: false, reason: "upgrade_required", currentCount, quota: 1 };
      }
      return { ok: true };
    }

    const quota =
      PRICING.totalIdentitiesPerPlan + (profile.extra_oracle_credits ?? 0);
    if (currentCount >= quota) {
      return {
        ok: false,
        reason: "quota_reached",
        currentCount,
        quota,
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("[subscription] canCreateOracle failed:", err);
    return { ok: false, reason: "unknown" };
  }
}

/**
 * Free-tier monthly message cap check. Counts USER messages sent
 * this calendar month (in the caller's timezone-agnostic UTC month
 * bucket) against PRICING.freeMessagesPerMonth. Pro/admin/trial users
 * always pass. Fail-CLOSED on any error — if we can't count, we deny
 * (better than accidentally letting a free user blow past the cap).
 *
 * Returns:
 *   { ok: true, current: N }                             — allowed
 *   { ok: false, current: N, limit }                     — free cap hit
 */
export async function canSendMessageForFreeCap(
  supabase?: SupabaseClient,
  precomputedIsPro?: boolean,
): Promise<
  | { ok: true; current: number }
  | { ok: false; current: number; limit: number }
> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, current: 0, limit: PRICING.freeMessagesPerMonth };

  const pro =
    precomputedIsPro !== undefined
      ? precomputedIsPro
      : await isPro(client);
  if (pro) return { ok: true, current: 0 };

  const monthStart = new Date();
  monthStart.setUTCHours(0, 0, 0, 0);
  monthStart.setUTCDate(1);

  const { count, error } = await client
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", monthStart.toISOString());

  if (error || count === null) {
    return {
      ok: false,
      current: 0,
      limit: PRICING.freeMessagesPerMonth,
    };
  }

  if (count >= PRICING.freeMessagesPerMonth) {
    return {
      ok: false,
      current: count,
      limit: PRICING.freeMessagesPerMonth,
    };
  }
  return { ok: true, current: count };
}

/**
 * Monthly image-attachment cap. Free tier (0/mo) is a hard block;
 * Pro gets PRICING.imagesPerMonthPro per calendar month across all
 * conversations. Counted on messages.image_storage_path so a purely
 * text send doesn't touch it.
 *
 * Fail-CLOSED on any error -- can't count → deny. Matches the
 * canSendMessageForFreeCap shape so gate sites look consistent.
 *
 * Returns:
 *   { ok: true, current: N, limit: L }                   -- allowed
 *   { ok: false, current: N, limit: L }                  -- cap hit
 */
export async function canSendImageForMonthCap(
  supabase?: SupabaseClient,
  precomputedIsPro?: boolean,
): Promise<
  | { ok: true; current: number; limit: number }
  | { ok: false; current: number; limit: number }
> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  const pro =
    precomputedIsPro !== undefined
      ? precomputedIsPro
      : await isPro(client);
  const limit = pro
    ? PRICING.imagesPerMonthPro
    : PRICING.imagesPerMonthFree;

  if (!user) return { ok: false, current: 0, limit };
  // Zero-cap tiers short-circuit before the DB read -- no reason to
  // count if the answer is decided.
  if (limit === 0) return { ok: false, current: 0, limit };

  const monthStart = new Date();
  monthStart.setUTCHours(0, 0, 0, 0);
  monthStart.setUTCDate(1);

  const { count, error } = await client
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .not("image_storage_path", "is", null)
    .gte("created_at", monthStart.toISOString());

  if (error || count === null) {
    return { ok: false, current: 0, limit };
  }

  if (count >= limit) {
    return { ok: false, current: count, limit };
  }
  return { ok: true, current: count, limit };
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
