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
 * The single source of truth for "does this user have an active PAID
 * plan?". Despite the name, this is NOT Pro-tier-specific: a Basic
 * subscription sets pro_until too, so isPro === "Basic OR Pro OR
 * trial OR admin". Use getPlanTier when the Basic/Pro split matters
 * (caps, quotas); use isPro/requirePro to gate paid-only features.
 * (Recording a legacy archive + minting an inherit code is NOT one of
 * them since the July 2026 flat-fee rework — every tier, Free
 * included, can mint; redemption is a flat $5 per code.)
 *
 * Rules:
 *   - Allowlisted admin emails are ALWAYS Pro (no persistence required).
 *   - profiles.pro_until in the future = paid (Stripe Basic or Pro,
 *     or an admin grant).
 *   - profiles.trial_ends_at in the future = paid (the 30-day signup
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
 * Server-side guard for paid-only routes (Basic OR Pro OR trial OR
 * admin — see the isPro naming note above). Call from a server
 * component or server action; if it returns { ok: false }, redirect
 * the caller to the returned path.
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
 *   - Pro / Basic / admin / trial: yes, always.
 *   - The concierge (Adrian): yes, always -- everyone can chat with
 *     the guide regardless of plan or which identity happens to be
 *     saved as free_identity_id. Belt against grandfathered users
 *     whose free_identity_id points at a personal oracle and against
 *     Pro users who want to ask a product question.
 *   - Free tier + assigned free_identity_id: yes (their designated one).
 *   - Free tier + inherited identity (they have an oracle_shares row):
 *     yes. Post-0107 inherited redemption is per-code-priced and
 *     tier-agnostic (flat $5 one-time per code), so a Free user CAN
 *     redeem a code -- and needs to be able to chat with it too.
 *     This branch closes the gap Fable flagged: without it, someone
 *     could pay to redeem a code and be locked out of the
 *     conversation, which is the opposite of what the app is for.
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
    if (freeId !== null && freeId === oracleId) return true;

    // Inherited-oracle branch: any oracle_shares row keyed to the
    // caller for this oracle_id means they legitimately redeemed a
    // code. Uses the same client that resolved the user above (via
    // getFreeIdentityId's auth.getUser); RLS on oracle_shares scopes
    // to the caller's own rows already, so a plain SELECT is the
    // authorization. No admin client needed.
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return false;
    const { data: share } = await client
      .from("oracle_shares")
      .select("oracle_id")
      .eq("oracle_id", oracleId)
      .eq("user_id", user.id)
      .maybeSingle();
    return share !== null;
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
 *   - Basic (Stripe subscription_tier='basic'): up to
 *     PRICING.basicTotalIdentitiesPerPlan + extra_oracle_credits.
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
          "email, pro_until, trial_ends_at, plan_source, free_identity_id, extra_oracle_credits, stripe_customer_id, subscription_tier",
        )
        .eq("id", userId)
        .maybeSingle<{
          email: string | null;
          pro_until: string | null;
          trial_ends_at: string | null;
          plan_source: string | null;
          free_identity_id: string | null;
          extra_oracle_credits: number | null;
          stripe_customer_id: string | null;
          subscription_tier: string | null;
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

    // Basic subscribers get the smaller self-created ceiling (2
    // formula + 1 photo = 3); Pro / trial / admin get 5. A Basic
    // user is one whose ACTIVE paid window came through Stripe with
    // the webhook-written subscription_tier = 'basic' — admin grants
    // and legacy trials have no Stripe customer and stay on the Pro
    // ceiling. Add-on credits stack on top of whichever base applies.
    const isBasicUser =
      !isAdmin(profile.email) &&
      profile.stripe_customer_id !== null &&
      profile.subscription_tier === "basic" &&
      profile.pro_until &&
      new Date(profile.pro_until).getTime() > now;
    const baseQuota = isBasicUser
      ? PRICING.basicTotalIdentitiesPerPlan
      : PRICING.totalIdentitiesPerPlan;
    const quota = baseQuota + (profile.extra_oracle_credits ?? 0);
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
 * unlimited before). Since 0106, the three-tier shape is fully live:
 * profiles.subscription_tier (written only by the Stripe webhook,
 * matched by Price ID) splits Basic from Pro, and the pack credit
 * balances (profiles.message_credits / image_credits) let a capped
 * user keep sending on purchased top-ups.
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
 * (or no session) resolves to Free. Priority order:
 *
 *   1. Admin allowlist → pro + unlimited.
 *   2. Active paid window (pro_until in the future):
 *      - with a Stripe customer → tier from the webhook-written
 *        subscription_tier column ("basic" or "pro"; a null column
 *        falls back to "pro" so a paying user is never locked out
 *        by a missed webhook write).
 *      - without one (admin grant / comped) → "pro" as before.
 *   3. Trial (trial_ends_at in the future) → "pro" (legacy trialers
 *      keep Pro-level access until expiry).
 *   4. Otherwise → "free".
 *
 * The profile read runs on the SERVICE-ROLE client: subscription_tier
 * is billing state (protect_billing_columns denies user writes) and
 * reading it here through the admin client keeps the tier decision
 * independent of whatever column grants the user role happens to
 * carry. Auth still resolves through the caller's client.
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

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("pro_until, trial_ends_at, stripe_customer_id, subscription_tier")
      .eq("id", user.id)
      .maybeSingle<{
        pro_until: string | null;
        trial_ends_at: string | null;
        stripe_customer_id: string | null;
        subscription_tier: string | null;
      }>();
    if (error || !data) return { tier: "free", unlimited: false };

    const now = Date.now();
    if (data.pro_until && new Date(data.pro_until).getTime() > now) {
      if (data.stripe_customer_id) {
        return {
          tier: data.subscription_tier === "basic" ? "basic" : "pro",
          unlimited: false,
        };
      }
      // Paid window without a Stripe customer = admin grant / comped.
      return { tier: "pro", unlimited: false };
    }
    if (data.trial_ends_at && new Date(data.trial_ends_at).getTime() > now) {
      return { tier: "pro", unlimited: false };
    }
    return { tier: "free", unlimited: false };
  } catch {
    return { tier: "free", unlimited: false };
  }
}

/**
 * Pack-credit balance read (message_credits / image_credits). Admin
 * client because the columns are billing state. Returns 0 on ANY
 * failure — fail-closed: a broken read can't mint free sends.
 */
async function getPackCreditBalance(
  userId: string,
  column: "message_credits" | "image_credits",
): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select(column)
      .eq("id", userId)
      .maybeSingle<Record<string, number | null>>();
    if (error || !data) return 0;
    const value = data[column];
    return typeof value === "number" && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Consume ONE pack credit after a SUCCESSFUL send. Called by the
 * chat routes post-persist (never at cap-check time — a failed
 * generation must not eat a paid credit). Best-effort and never
 * throws: a decrement error must never block the reply that already
 * shipped. Race note: two concurrent sends can both pass the
 * balance>0 check and both decrement; increment_profile_counter
 * floors at 0 (greatest(0, ...)), so the worst case is one extra
 * un-paid-for message — accepted rounding, not worth a lock.
 */
export async function consumePackCredit(
  userId: string,
  kind: "message" | "image",
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("increment_profile_counter", {
      target_user_id: userId,
      counter_name: kind === "message" ? "message_credits" : "image_credits",
      delta: -1,
    });
    if (error) {
      console.error("[subscription] pack credit decrement failed:", error);
    }
  } catch (err) {
    console.error("[subscription] pack credit decrement failed:", err);
  }
}

/**
 * Purchased inherit-slot credit balance (profiles.inherited_slot_credits,
 * 0107). One credit = one paid inherit-code redemption ($5 one-time via
 * Stripe purpose 'inherited_slot_purchase'). Every NEW redemption
 * consumes one — flat fee, no waivers — see
 * /identity/inherit/actions.ts. Admin client because the column is
 * billing state; returns 0 on ANY failure (fail-closed — a broken
 * read can't mint a free redemption).
 */
export async function getInheritedSlotCredits(
  userId: string,
): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("inherited_slot_credits")
      .eq("id", userId)
      .maybeSingle<{ inherited_slot_credits: number | null }>();
    if (error || !data) return 0;
    const value = data.inherited_slot_credits;
    return typeof value === "number" && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Consume ONE inherit-slot credit after a SUCCESSFUL redemption —
 * called post-persist (after the oracle_shares row actually landed),
 * never at gate-check time, so a failed redemption can't eat a paid
 * credit. Same best-effort/never-throws contract and race model as
 * consumePackCredit: increment_profile_counter floors at 0, so the
 * worst concurrent-redeem case is one un-paid-for redemption.
 */
export async function consumeInheritedSlotCredit(
  userId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("increment_profile_counter", {
      target_user_id: userId,
      counter_name: "inherited_slot_credits",
      delta: -1,
    });
    if (error) {
      console.error(
        "[subscription] inherit-slot credit decrement failed:",
        error,
      );
    }
  } catch (err) {
    console.error(
      "[subscription] inherit-slot credit decrement failed:",
      err,
    );
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
 * When the tier cap is exhausted, the user's pack-credit balance
 * (profiles.message_credits, topped up by add-on pack purchases via
 * the Stripe webhook) is consulted: balance > 0 → the send is allowed
 * with `usingCredit: true`, and the ROUTE decrements the credit AFTER
 * the message actually persists (consumePackCredit). The check never
 * decrements — a failed generation must not eat a paid credit.
 *
 * Returns:
 *   { ok: true, current: N, limit: L, usingCredit: false } — under cap
 *   { ok: true, current: N, limit: L, usingCredit: true }  — over cap,
 *       riding a pack credit; caller MUST consumePackCredit on success
 *   { ok: false, current: N, limit: L }  — cap hit, no credits (402)
 */
export async function canSendMessageForTierCap(
  supabase?: SupabaseClient,
  precomputedPlan?: ResolvedPlan,
): Promise<
  | { ok: true; current: number; limit: number; usingCredit: boolean }
  | { ok: false; current: number; limit: number }
> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  const plan = precomputedPlan ?? (await getPlanTier(client));
  const limit = TIER_MESSAGE_CAPS[plan.tier];

  if (!user) return { ok: false, current: 0, limit };
  if (plan.unlimited) {
    return { ok: true, current: 0, limit, usingCredit: false };
  }

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
    // Tier cap exhausted — pack credits keep the conversation going.
    const credits = await getPackCreditBalance(user.id, "message_credits");
    if (credits > 0) {
      return { ok: true, current: count, limit, usingCredit: true };
    }
    return { ok: false, current: count, limit };
  }
  return { ok: true, current: count, limit, usingCredit: false };
}

/**
 * Monthly image-attachment cap for the current user's TIER (Free 1,
 * Basic 10, Pro 30). Counted on messages.image_storage_path so a
 * purely text send doesn't touch it. Admin allowlist always passes.
 *
 * Fail-CLOSED on any error -- can't count → deny. Matches the
 * canSendMessageForTierCap shape so gate sites look consistent,
 * including the pack-credit overflow: cap exhausted + image_credits
 * balance > 0 → allowed with `usingCredit: true`, and the route
 * decrements via consumePackCredit AFTER the send persists.
 *
 * Returns:
 *   { ok: true, current: N, limit: L, usingCredit: boolean } -- allowed
 *   { ok: false, current: N, limit: L }                      -- cap hit
 */
export async function canSendImageForMonthCap(
  supabase?: SupabaseClient,
  precomputedPlan?: ResolvedPlan,
): Promise<
  | { ok: true; current: number; limit: number; usingCredit: boolean }
  | { ok: false; current: number; limit: number }
> {
  const client = supabase ?? (await createClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  const plan = precomputedPlan ?? (await getPlanTier(client));
  const limit = TIER_IMAGE_CAPS[plan.tier];

  if (!user) return { ok: false, current: 0, limit };
  if (plan.unlimited) {
    return { ok: true, current: 0, limit, usingCredit: false };
  }

  const monthStart = new Date();
  monthStart.setUTCHours(0, 0, 0, 0);
  monthStart.setUTCDate(1);

  // Note: the zero-cap short-circuit from the pre-pack version is
  // gone on purpose — a zero-cap tier with purchased image credits
  // must still fall through to the balance check below.
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
    const credits = await getPackCreditBalance(user.id, "image_credits");
    if (credits > 0) {
      return { ok: true, current: count, limit, usingCredit: true };
    }
    return { ok: false, current: count, limit };
  }
  return { ok: true, current: count, limit, usingCredit: false };
}

// trialSpotsRemaining removed in the 0096 pricing rework -- handle_new_user
// no longer hands out trials on new signups, so the "N of 1000 seats
// remaining" surface is meaningless. Existing trialers keep theirs until
// expiry via the isPro trial_ends_at check; admin reporting reads
// trial_ends_at directly.
