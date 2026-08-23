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
    // Email lives on auth.users, NOT public.profiles — selecting
    // "email" from profiles throws and gets swallowed by the catch
    // below, silently downgrading admins to non-Pro. Two round-trips
    // (auth.admin.getUserById + profiles.select) is the price of
    // fixing that.
    const [{ data: authRes }, { data, error }] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin
        .from("profiles")
        .select("pro_until, trial_ends_at")
        .eq("id", userId)
        .maybeSingle<{
          pro_until: string | null;
          trial_ends_at: string | null;
        }>(),
    ]);
    if (error || !data) return false;
    if (isAdmin(authRes?.user?.email ?? null)) return true;
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
 *   - Free tier + inherited identity (an owned oracle row carrying
 *     inherited_at, 0111): yes. Inherited redemption is per-code-priced
 *     and tier-agnostic (flat $5 one-time per code), so a Free user CAN
 *     redeem a code -- and needs to be able to chat with the copy too.
 *     Without this branch, someone could pay to redeem a code and be
 *     locked out of the conversation, which is the opposite of what
 *     the app is for.
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

    // RLS scopes to auth.uid(); the explicit .eq('user_id') is the
    // belt. The free_identity_id branch that used to live here is
    // GONE (Wilson 2026-08-19): free talks to Adrian, full stop —
    // with the single ruled exception below.
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return false;

    // The earned companion (0143) — five people who verified, accepted
    // terms, and actually talked. Free may chat with it, inside the
    // same 20-message allowance; it was earned, not bought, and
    // walling it off would make the reward a lie.
    const { data: earned } = await client
      .from("oracles")
      .select("id")
      .eq("id", oracleId)
      .eq("user_id", user.id)
      .eq("is_referral_reward", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (earned) return true;

    // Inherited copies (0111) are owned rows stamped with inherited_at
    // at redemption. Redemption was paid ($5 flat per code), so the
    // copy stays chattable on every tier -- including Free accounts
    // whose free_identity_id points elsewhere. Keyed on inherited_at,
    // not the code FK: the marker survives the creator deleting their
    // account (which cascades inherit_codes away).
    const { data: inherited } = await client
      .from("oracles")
      .select("id")
      .eq("id", oracleId)
      .eq("user_id", user.id)
      .not("inherited_at", "is", null)
      .is("deleted_at", null)
      .maybeSingle();
    return inherited !== null;
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
    // Email lives on auth.users, NOT public.profiles — selecting
    // "email" from profiles throws PGRST-level and the whole gate
    // fell through to `unknown`, surfacing as "Couldn't check your
    // plan" on every create attempt (2026-08-03 audit). Fetch from
    // auth.users in parallel with the profile + oracles count reads
    // so admin bypass still works and the row-level checks below
    // never depend on a column that doesn't exist.
    const [{ data: authRes }, { data: profile }, { count }] =
      await Promise.all([
        admin.auth.admin.getUserById(userId),
        admin
          .from("profiles")
          .select(
            "pro_until, trial_ends_at, plan_source, free_identity_id, extra_oracle_credits, stripe_customer_id, subscription_tier",
          )
          .eq("id", userId)
          .maybeSingle<{
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
          // Inherited copies (0111) were paid for separately at
          // redemption and must never eat the user's self-creation
          // quota.
          .is("inherited_at", null)
          // LIFETIME COUNT (Wilson 2026-08-15: "you get what you
          // get"): a creation consumes its slot permanently — the
          // deleted_at filter is deliberately ABSENT, so deleting a
          // companion does NOT free the slot. This closes the
          // create→delete→create farming loop (each creation costs
          // real synthesis + portrait compute) with zero counters:
          // the only ways to create more are a higher plan or a
          // purchased extra slot.
          // Me (self-archive, 0125) is a separate free slot on all
          // tiers per Wilson's Phase-2 lock. Excluded from the
          // companion tally.
          .eq("is_self_archive", false)
          // Audit-fix 2026-08-04: legacy identities (both self-mode
          // Me AND other-mode "for someone you love") are paid /
          // gated separately from plan quota. Me was already
          // excluded above via is_self_archive; excluding is_legacy
          // catches other-mode too — those cost $5 at legacy
          // complete-route regardless of tier, and were previously
          // silently eating a plan slot on top of the $5. This also
          // aligns the server with the picker's client-side count
          // (create/page.tsx + create.tsx), which already excludes
          // is_legacy — killing a "picker says 1 remaining, server
          // 409s" surprise for users with a legacy-other + randoms.
          .eq("is_legacy", false)
          // Earned companions (0143) stand outside plan quota the same
          // way Me and the legacy archives do — earning one must never
          // consume a slot the user paid for.
          .eq("is_referral_reward", false),
      ]);

    if (!profile) return { ok: false, reason: "unknown" };

    const userEmail = authRes?.user?.email ?? null;
    const now = Date.now();
    const isProUser =
      isAdmin(userEmail) ||
      (profile.pro_until && new Date(profile.pro_until).getTime() > now) ||
      (profile.trial_ends_at &&
        new Date(profile.trial_ends_at).getTime() > now);

    const currentCount = count ?? 0;

    if (!isProUser) {
      // Free tier creates NOTHING from the formula or a photo —
      // synthesis costs real money on an account that may never pay
      // (Wilson 2026-08-19: free is Adrian + the archive walks, THAT'S
      // IT; the walks have their own gates and don't pass through
      // here). The old rule granted one free identity ever; that
      // giveaway is closed.
      return { ok: false, reason: "upgrade_required", currentCount, quota: 0 };
    }

    // Basic subscribers get the smaller self-created ceiling (2
    // formula + 1 photo = 3); Pro / trial / admin get 5. Add-on
    // credits stack on top of whichever base applies.
    //
    // The stripe_customer_id condition was removed 2026-08-04 for the
    // same reason as getPlanTier above: an IAP subscriber never has
    // one, so a $5 Apple Basic purchase was silently granted the Pro
    // ceiling of 5 identities. subscription_tier is written by all
    // three payment paths and is authoritative on its own; null still
    // means comped/trial and still gets the Pro ceiling.
    const isBasicUser =
      !isAdmin(userEmail) &&
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
      // subscription_tier is authoritative WHENEVER it is set, no
      // matter which channel wrote it.
      //
      // This used to be gated on `data.stripe_customer_id` as a proxy
      // for "a real payment path set this", falling through to "pro"
      // otherwise on the theory that a paid window with no Stripe
      // customer must be an admin grant. In-app purchases broke that
      // assumption: the RevenueCat webhook writes pro_until and
      // subscription_tier but never stripe_customer_id (only
      // handleSubscriptionCheckout sets that), so an IAP subscriber's
      // stripe_customer_id is always null. Result: someone who bought
      // BASIC through Apple for $5 had subscription_tier='basic'
      // written and then ignored, and every gate resolved them as PRO —
      // 300 messages instead of 100, 30 images instead of 10, and the
      // 5-identity ceiling instead of 3. Half price, full product.
      //
      // Reading the column directly is also simply more honest: it is
      // written by exactly three paths (Stripe webhook, RevenueCat
      // webhook, admin grant-pro) and all three set it deliberately.
      // Null still means "comped / legacy trial" and still resolves pro.
      if (data.subscription_tier === "basic") {
        return { tier: "basic", unlimited: false };
      }
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
 * CLAIM one inherit-slot credit — the check and the spend in a single
 * statement (`update ... where inherited_slot_credits > 0 returning`,
 * consume_profile_credit). Returns true ONLY for the caller that
 * actually got the credit; every other concurrent caller gets false
 * and must not proceed.
 *
 * What this replaced: read the balance at the gate, decrement after
 * the copy landed — 191 lines, a Stripe branch, a storage copy and an
 * insert apart. Two redemptions fired at the same second both read 1,
 * both wrote an archive, and the loser's decrement floored at 0
 * (increment_profile_counter uses greatest(0, ...)). Two $5 archives
 * for one $5 credit, from two tabs.
 *
 * Claim as LATE as possible — immediately before the write it pays
 * for — and refund on every failure after it
 * (refundInheritedSlotCredit). Fail-CLOSED: an RPC error returns
 * false, so a broken database can never mint a free redemption. That
 * also means false can mean "database trouble", not just "no credit",
 * so callers must answer it warmly and let the person try again.
 */
export async function reserveInheritedSlotCredit(
  userId: string,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_profile_credit", {
      target_user_id: userId,
      counter_name: "inherited_slot_credits",
    });
    if (error) {
      console.error("[subscription] inherit-slot credit claim failed:", error);
      return false;
    }
    return data === true;
  } catch (err) {
    console.error("[subscription] inherit-slot credit claim failed:", err);
    return false;
  }
}

/**
 * Hand a claimed inherit-slot credit BACK when the redemption it was
 * claimed for did not land. Money fails in the customer's favour:
 * they paid $5 for an archive they can hold, so a failed insert must
 * leave the credit spendable on the retry.
 *
 * A refund that ITSELF fails is a person who is $5 down with nothing
 * to show for it, so it goes to grant_failures where it can be seen
 * and fixed by hand — never a console line and a shrug.
 *
 * Never throws, for the same reason recordGrantFailure never throws:
 * this runs on a path that is already failing, and it must not turn
 * "the copy didn't land" into an unhandled error on top of it. Note
 * for callers that exit via redirect(): redirect THROWS by design, so
 * this has to run BEFORE it, not after.
 */
/**
 * DEPRECATED, still wired. The post-persist decrement the two redeem
 * paths call today.
 *
 * The atomic pair above (reserveInheritedSlotCredit +
 * refundInheritedSlotCredit) is the correct fix for the
 * check-then-consume race and is ready to use — but switching to it
 * moves WHEN the credit is taken, from "after the copy saved" to
 * "reserved before, refunded if anything fails". That means refunding
 * on every failure path in between, and getting it wrong means someone
 * pays $5 and does not get their archive.
 *
 * Left in place deliberately rather than half-migrated on a live app.
 * The race needs the SAME user redeeming TWO codes simultaneously, which
 * is rare; a broken redeem path is not.
 *
 * TO FINISH: in both redeem paths — (gated)/identity/inherit/actions.ts
 * and api/identity/inherit/route.ts — replace the getInheritedSlotCredits
 * check with reserveInheritedSlotCredit, delete the post-persist call to
 * this function, and refundInheritedSlotCredit on every redirect/return
 * between the reserve and the successful insert.
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
      console.error("[subscription] inherit-slot credit decrement failed:", error);
    }
  } catch (err) {
    console.error("[subscription] inherit-slot credit decrement failed:", err);
  }
}

export async function refundInheritedSlotCredit(
  userId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("increment_profile_counter", {
      target_user_id: userId,
      counter_name: "inherited_slot_credits",
      delta: 1,
    });
    if (error) {
      const { recordGrantFailure } = await import("@/lib/billing/grantFailure");
      await recordGrantFailure({
        kind: "inherited_slot",
        userId,
        delta: 1,
        purpose: "refund_unused_inherit_claim",
        error,
      });
    }
  } catch (err) {
    try {
      const { recordGrantFailure } = await import("@/lib/billing/grantFailure");
      await recordGrantFailure({
        kind: "inherited_slot",
        userId,
        delta: 1,
        purpose: "refund_unused_inherit_claim",
        error: err,
      });
    } catch (recordErr) {
      console.error(
        "[subscription] inherit-slot credit refund could not be recorded:",
        recordErr,
      );
    }
  }
}

/**
 * Does the user hold a purchased other-mode legacy-mint credit
 * (profiles.other_identity_credits, 0113)? One credit = one paid
 * other-mode legacy completion ($5 one-time via Stripe purpose
 * 'other_identity_create'); self-mode completions never consult this.
 * Admin client because the column is billing state; returns false on
 * ANY failure (fail-closed — a broken read can't mint a free
 * other-mode identity).
 */
export async function hasOtherIdentityCreateCredit(
  userId: string,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("other_identity_credits")
      .eq("id", userId)
      .maybeSingle<{ other_identity_credits: number | null }>();
    if (error || !data) return false;
    const value = data.other_identity_credits;
    return typeof value === "number" && value > 0;
  } catch {
    return false;
  }
}

/**
 * Consume ONE other-mode legacy-mint credit after a SUCCESSFUL
 * completion — called post-synthesis + post-insert (the credit was
 * paid for a completed identity; a failed synthesis or insert must
 * never eat it, the user just retries with the credit intact). Same
 * best-effort/never-throws contract and race model as
 * consumeInheritedSlotCredit: increment_profile_counter floors at 0,
 * so the worst concurrent-finish case is one un-paid-for mint — and
 * the fingerprint unique index already collapses double-submits of
 * the same answers into one oracle anyway.
 */
export async function consumeOtherIdentityCreateCredit(
  userId: string,
): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.rpc("increment_profile_counter", {
      target_user_id: userId,
      counter_name: "other_identity_credits",
      delta: -1,
    });
    if (error) {
      console.error(
        "[subscription] other-identity-create credit decrement failed:",
        error,
      );
    }
  } catch (err) {
    console.error(
      "[subscription] other-identity-create credit decrement failed:",
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
/**
 * Oracle ids whose messages must NOT count against the monthly caps.
 *
 * Two surfaces write role='user' rows that are not "a message to a
 * companion":
 *   - the Me archive echo (/api/chat/echo) — journaling into your own
 *     self-archive, whose own header says "No cap counting"
 *   - the help identity (mode='help') — asking support a question,
 *     deliberately exempted from the send gate itself
 * Both were nonetheless counted by the cap queries, which filter only
 * on user_id + role, so journaling or asking for help silently burned
 * the 20/100/300 messages the user is paying for.
 *
 * Returns [] on any error: failing open here costs at most a few
 * miscounted messages, while failing closed would block sends.
 */
async function capExemptOracleIds(
  client: SupabaseClient,
  userId: string,
): Promise<string[]> {
  try {
    const { data } = await client
      .from("oracles")
      .select("id")
      .eq("user_id", userId)
      .or("is_self_archive.eq.true,mode.eq.help");
    return (data ?? []).map((r) => r.id as string);
  } catch {
    return [];
  }
}

/** PostgREST `not in` list literal — `(a,b,c)`. */
function notInList(ids: readonly string[]): string {
  return `(${ids.join(",")})`;
}

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

  // USAGE COMES FROM THE LEDGER, NOT FROM COUNTING MESSAGES.
  //
  // This used to be a live count(*) over the messages table, which made
  // the message ROWS the meter — and "Delete conversation → Delete
  // forever" hard-DELETEs those rows, so anyone could hand their own
  // allowance back to zero as often as they liked. Wilson 2026-08-22:
  // "each plan has usage and if they delete a message usage does not
  // delete." monthly_usage is append-only (no INSERT/UPDATE/DELETE
  // policy, SELECT-only grant, writes only via a SECURITY DEFINER
  // function), so deleting a conversation cannot touch it.
  //
  // The period is per-account, not the 1st of the calendar month — it
  // restarts on the day they started Pro or Basic. current_usage()
  // resolves that server-side so this file, the meter on the upgrade
  // screen and the phone can never disagree about where the period
  // begins.
  const { data: ledger, error: ledgerError } = await client
    .rpc("current_usage", { target_user_id: user.id })
    .maybeSingle<{ period_start: string; messages: number; images: number }>();

  let count: number | null = ledger?.messages ?? null;

  if (ledgerError || count === null) {
    // FALL BACK to the old row count rather than failing open or shut.
    // Failing open would hand out unlimited usage on a transient error;
    // failing shut would lock a paying customer out of a conversation
    // because of one bad query. The old behaviour is the safe floor: it
    // is what shipped for months and it can only ever under-count by the
    // rows someone deliberately destroyed.
    const periodStart = new Date();
    periodStart.setUTCHours(0, 0, 0, 0);
    periodStart.setUTCDate(1);

    // Journaling into the Me archive and asking the help identity a
    // question are not messages to a companion — they must not spend
    // the tier's allowance.
    const exempt = await capExemptOracleIds(client, user.id);
    let messageCountQuery = client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", periodStart.toISOString());
    if (exempt.length > 0) {
      messageCountQuery = messageCountQuery.not(
        "oracle_id",
        "in",
        notInList(exempt),
      );
    }
    const { count: fallbackCount, error } = await messageCountQuery;
    if (error || fallbackCount === null) {
      return { ok: false, current: 0, limit };
    }
    count = fallbackCount;
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

  // From the ledger, same as the message cap — photos had the identical
  // defect: the count came from rows the user could permanently delete.
  const { data: imgLedger, error: imgLedgerError } = await client
    .rpc("current_usage", { target_user_id: user.id })
    .maybeSingle<{ period_start: string; messages: number; images: number }>();

  let count: number | null = imgLedger?.images ?? null;
  let error: unknown = null;

  if (imgLedgerError || count === null) {
    // Same safe floor as the message cap: fall back to the old row
    // count rather than failing open (free photos) or shut (a paying
    // customer refused a photo over a transient error).
    const periodStart = new Date();
    periodStart.setUTCHours(0, 0, 0, 0);
    periodStart.setUTCDate(1);

    // Note: the zero-cap short-circuit from the pre-pack version is
    // gone on purpose — a zero-cap tier with purchased image credits
    // must still fall through to the balance check below.
    // Same exemption as the message cap — a photo attached to a
    // Me-archive entry isn't a photo sent to a companion.
    const exemptForImages = await capExemptOracleIds(client, user.id);
    let imageCountQuery = client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("role", "user")
      .not("image_storage_path", "is", null)
      .gte("created_at", periodStart.toISOString());
    if (exemptForImages.length > 0) {
      imageCountQuery = imageCountQuery.not(
        "oracle_id",
        "in",
        notInList(exemptForImages),
      );
    }
    const fallback = await imageCountQuery;
    count = fallback.count;
    error = fallback.error;
  }

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

/**
 * Display-side monthly counts — the SAME queries the two cap gates run
 * (same month window, same Me-archive/help exemptions), extracted so
 * the usage meters can show real numbers for accounts the gates skip.
 *
 * The cap functions short-circuit `plan.unlimited` with current: 0 —
 * correct for enforcement (no reason to pay for two counts on every
 * admin send), wrong for display: the admin demoing the app saw no
 * meters at all and read the feature as missing (Wilson, 2026-08-06).
 * Never used for enforcement; returns zeros on error because a broken
 * meter should read empty, not block anything.
 */
export async function monthlyUsageCounts(
  client: SupabaseClient,
  userId: string,
): Promise<{ messages: number; images: number }> {
  try {
    const monthStart = new Date();
    monthStart.setUTCHours(0, 0, 0, 0);
    monthStart.setUTCDate(1);
    const exempt = await capExemptOracleIds(client, userId);
    let msgQ = client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .gte("created_at", monthStart.toISOString());
    let imgQ = client
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user")
      .not("image_storage_path", "is", null)
      .gte("created_at", monthStart.toISOString());
    if (exempt.length > 0) {
      msgQ = msgQ.not("oracle_id", "in", notInList(exempt));
      imgQ = imgQ.not("oracle_id", "in", notInList(exempt));
    }
    const [{ count: messages }, { count: images }] = await Promise.all([
      msgQ,
      imgQ,
    ]);
    return { messages: messages ?? 0, images: images ?? 0 };
  } catch {
    return { messages: 0, images: 0 };
  }
}

// trialSpotsRemaining removed in the 0096 pricing rework -- handle_new_user
// no longer hands out trials on new signups, so the "N of 1000 seats
// remaining" surface is meaningless. Existing trialers keep theirs until
// expiry via the isPro trial_ends_at check; admin reporting reads
// trial_ends_at directly.
