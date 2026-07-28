import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin/allowlist";
import { getConciergeId } from "@/lib/identity/concierge";
import { PRICING } from "@/lib/pricing";

// Early-access trial cap removed in the 0096 pricing rework -- new
// signups no longer get a trial at all. Existing trialers keep theirs
// until expiry.

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
 *   - The concierge (Adrian): yes, always -- everyone can chat with
 *     the guide regardless of plan or which identity happens to be
 *     saved as free_identity_id. Belt against grandfathered users
 *     whose free_identity_id points at a personal oracle and against
 *     Pro users who want to ask a product question.
 *   - Free tier: only their free_identity_id.
 * Never throws -- any failure reads as "no" (fail-closed).
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
    const conciergeId = await getConciergeId();
    if (conciergeId && oracleId === conciergeId) return true;
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
        .eq("is_concierge", false)
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

/* ── Tier resolution + per-tier usage caps ─────────────────────────
 *
 * The pack rework caps EVERY tier's messages and images (Pro was
 * unlimited before). The three-tier shape (free / basic / pro) is
 * modeled here even though Basic can't be granted yet:
 *
 *   TODAY: Stripe only knows one Price (Pro). Basic enrollment runs
 *   the mailto flow, so no Basic subscriber exists in the database
 *   and getPlanTier only ever returns "free" or "pro".
 *
 *   LATER (Stripe-wiring follow-up): a subscription_tier column (or
 *   the stored Stripe Price ID) distinguishes Basic from Pro. Teach
 *   getPlanTier to read it and every cap below starts enforcing
 *   Basic automatically — the cap tables already know the numbers.
 *
 * Admin-allowlisted accounts are `unlimited: true` and skip caps
 * entirely (unchanged from the pre-pack behavior).
 */

export type PlanTier = "free" | "basic" | "pro";

export type ResolvedPlan = {
  tier: PlanTier;
  /** Admin allowlist — never capped. */
  unlimited: boolean;
};

/** Monthly message cap per tier. Every tier is capped now. */
const TIER_MESSAGE_CAPS: Record<PlanTier, number> = {
  free: PRICING.freeMessagesPerMonth,
  basic: PRICING.basicMessagesPerMonth,
  pro: PRICING.proMessagesPerMonth,
};

/** Monthly image-attachment cap per tier. */
const TIER_IMAGE_CAPS: Record<PlanTier, number> = {
  free: PRICING.imagesPerMonthFree,
  basic: PRICING.basicImagesPerMonth,
  pro: PRICING.imagesPerMonthPro,
};

/**
 * Resolve the current user's plan tier. Fail-closed: any read failure
 * (or no session) resolves to Free.
 *
 *   - Admin allowlist → pro + unlimited.
 *   - pro_until / trial_ends_at in the future → pro (Stripe checkout,
 *     admin grant, and legacy trials all land here today).
 *   - Otherwise → free.
 *
 * Basic never resolves yet — see the block comment above. When the
 * subscription_tier column lands, branch on it here and nowhere else.
 */
export async function getPlanTier(
  supabase?: SupabaseClient,
): Promise<ResolvedPlan> {
  const client = supabase ?? (await createClient());
  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return { tier: "free", unlimited: false };
    if (isAdmin(user.email)) return { tier: "pro", unlimited: true };

    const { data, error } = await client
      .from("profiles")
      .select("pro_until, trial_ends_at")
      .eq("id", user.id)
      .maybeSingle<{
        pro_until: string | null;
        trial_ends_at: string | null;
      }>();
    if (error || !data) return { tier: "free", unlimited: false };

    const now = Date.now();
    const paid =
      (data.pro_until && new Date(data.pro_until).getTime() > now) ||
      (data.trial_ends_at && new Date(data.trial_ends_at).getTime() > now);
    return { tier: paid ? "pro" : "free", unlimited: false };
  } catch {
    return { tier: "free", unlimited: false };
  }
}

/**
 * Monthly message cap check for the current user's TIER (formerly
 * canSendMessageForFreeCap — renamed when Pro gained a cap too).
 * Counts USER messages sent this calendar month (UTC month bucket)
 * against the tier's cap. Admin allowlist always passes. Fail-CLOSED
 * on any error — if we can't count, we deny (better than accidentally
 * letting a user blow past the cap).
 *
 * Returns:
 *   { ok: true, current: N, limit: L }        — allowed
 *   { ok: false, current: N, limit: L }       — tier cap hit
 */
export async function canSendMessageForTierCap(
  supabase?: SupabaseClient,
  precomputedPlan?: ResolvedPlan,
): Promise<
  | { ok: true; current: number; limit: number }
  | { ok: false; current: number; limit: number }
> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  const plan = precomputedPlan ?? (await getPlanTier(client));
  const limit = TIER_MESSAGE_CAPS[plan.tier];

  if (!user) return { ok: false, current: 0, limit };
  if (plan.unlimited) return { ok: true, current: 0, limit };

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
    return { ok: false, current: 0, limit };
  }

  if (count >= limit) {
    return { ok: false, current: count, limit };
  }
  return { ok: true, current: count, limit };
}

/**
 * Monthly image-attachment cap for the current user's TIER (Free 1,
 * Basic 10, Pro 30). Counted on messages.image_storage_path so a
 * purely text send doesn't touch it. Admin allowlist always passes.
 *
 * Fail-CLOSED on any error -- can't count → deny. Matches the
 * canSendMessageForTierCap shape so gate sites look consistent.
 *
 * Returns:
 *   { ok: true, current: N, limit: L }                   -- allowed
 *   { ok: false, current: N, limit: L }                  -- cap hit
 */
export async function canSendImageForMonthCap(
  supabase?: SupabaseClient,
  precomputedPlan?: ResolvedPlan,
): Promise<
  | { ok: true; current: number; limit: number }
  | { ok: false; current: number; limit: number }
> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  const plan = precomputedPlan ?? (await getPlanTier(client));
  const limit = TIER_IMAGE_CAPS[plan.tier];

  if (!user) return { ok: false, current: 0, limit };
  if (plan.unlimited) return { ok: true, current: 0, limit };
  // Zero-cap tiers short-circuit before the DB read -- no reason to
  // count if the answer is decided. (No tier is zero today, but the
  // guard keeps a future zero-cap tier from paying a count query.)
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

// trialSpotsRemaining removed in the 0096 pricing rework -- handle_new_user
// no longer hands out trials on new signups, so the "N of 1000 seats
// remaining" surface is meaningless. Existing trialers keep theirs until
// expiry via the isPro trial_ends_at check; admin reporting reads
// trial_ends_at directly.
