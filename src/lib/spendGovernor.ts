/**
 * Per-user Anthropic spend governor.
 *
 * Wilson's rule: nothing today caps how much Claude spend a single
 * Free user can trigger. This helper closes that surface.
 *   - recordAnthropicSpend(...) appends a row to chat_spend_events
 *     with estimated cents for a completed Anthropic call.
 *   - sumMonthlySpendCents(userId) reads the current calendar-month
 *     total for one user (RLS-aware; can be called with either the
 *     user client or admin).
 *   - overFreeCap(...) returns true when a Free-tier user is over
 *     PRICING.freeMonthlySpendCents. Pro/admin/trial pass through.
 *
 * Estimation is deliberately generous (rounded UP to whole cents so
 * we never undercount). The exact number matters less than the
 * ceiling — over-run by one in-flight call is acceptable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { PRICING } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

/** Anthropic list-price snapshot as of 2026-07. Cents per MILLION
 *  tokens. Cache-read tokens are ~10% of input rate; cache-creation
 *  charges the same as input (writing the cache is a one-time cost).
 *  When the API bumps pricing, update HERE only. */
const MODEL_PRICING: Record<
  string,
  { input: number; output: number; cacheRead: number; cacheCreation: number }
> = {
  "claude-sonnet-4-6": {
    input: 300,
    output: 1500,
    cacheRead: 30,
    cacheCreation: 375, // 1.25× input for 1h cache
  },
  "claude-haiku-4-5": {
    input: 80,
    output: 400,
    cacheRead: 8,
    cacheCreation: 100,
  },
};

/** Fallback pricing when the model id doesn't match — use Sonnet
 *  rates as a safe over-estimate rather than 0. */
const DEFAULT_PRICING = MODEL_PRICING["claude-sonnet-4-6"];

export type SpendUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

export type SpendRoute =
  | "chat_stream"
  | "outreach"
  | "residue"
  | "reflect"
  | "voice_backfill"
  | "block_detector"
  | "welcome"
  | "help"
  | "crisis_helper";

/** Compute estimated cost in whole cents (rounded up). Never returns
 *  0 for a call with any tokens — a 1-cent floor keeps the ledger
 *  from silently dropping tiny calls. */
export function estimateCents(model: string, usage: SpendUsage): number {
  const p = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const perMillion =
    (usage.input_tokens ?? 0) * p.input +
    (usage.output_tokens ?? 0) * p.output +
    (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
    (usage.cache_creation_input_tokens ?? 0) * p.cacheCreation;
  const cents = perMillion / 1_000_000;
  if (cents <= 0) return 0;
  return Math.max(1, Math.ceil(cents));
}

/**
 * Record one Anthropic call's estimated spend against a user.
 * Fire-and-forget from after(); never throws so a bad row can't
 * break the caller. Skips if userId is falsy (background / crisis
 * helper calls sometimes have no owner user).
 */
export async function recordAnthropicSpend(args: {
  userId: string | null | undefined;
  model: string;
  usage: SpendUsage;
  route: SpendRoute;
}): Promise<void> {
  if (!args.userId) return;
  try {
    const admin = createAdminClient();
    const cents = estimateCents(args.model, args.usage);
    await admin.from("chat_spend_events").insert({
      user_id: args.userId,
      cents,
      input_tokens: args.usage.input_tokens ?? null,
      output_tokens: args.usage.output_tokens ?? null,
      cache_read_tokens: args.usage.cache_read_input_tokens ?? null,
      cache_creation_tokens: args.usage.cache_creation_input_tokens ?? null,
      model: args.model,
      route: args.route,
    });
  } catch (err) {
    console.warn("[spend] record failed:", err);
  }
}

/** Sum this user's spend for the current calendar month (UTC). Used
 *  to gate additional chat calls. Never throws; on error returns 0
 *  so we fail-OPEN — a broken governor mustn't block a real user. */
export async function sumMonthlySpendCents(
  userId: string,
  supabase?: SupabaseClient,
): Promise<number> {
  try {
    const client = supabase ?? createAdminClient();
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(1);
    const { data, error } = await client
      .from("chat_spend_events")
      .select("cents")
      .eq("user_id", userId)
      .gte("created_at", start.toISOString());
    if (error || !data) return 0;
    let sum = 0;
    for (const row of data) {
      const c = typeof row.cents === "number" ? row.cents : 0;
      sum += c;
    }
    return sum;
  } catch {
    return 0;
  }
}

/**
 * True when a user has hit or exceeded the monthly spend cap.
 *
 * Applies to:
 *   - Free-tier users (isPro=false).
 *   - Trial-only Pro users (in-future trial_ends_at with no paid
 *     subscription and no admin grant). Fable audit surfaced that
 *     every new signup gets a 30-day full-Pro trial (0072), so
 *     without this a scripted signup can burn $10+/account of
 *     Anthropic spend before the cap kicks in. Trial users get
 *     the SAME monthly ceiling as free users — they still get to
 *     experience Pro features, they just can't run us into the
 *     ground.
 *
 * Bypassed for real paying subscribers (pro_until in future) and
 * for admin-comped accounts (plan_source='admin_grant').
 *
 * `trialOnly` lets the caller signal that isPro is true purely
 * because of a trial. Chat stream computes this once so we don't
 * re-hit the DB here.
 */
export async function overFreeCap(
  userId: string,
  precomputedIsPro: boolean,
  trialOnly: boolean = false,
): Promise<{ over: boolean; current: number; limit: number }> {
  const limit = PRICING.freeMonthlySpendCents;
  // Real Pro (paid or admin) is exempt. Trial-only users are NOT.
  if (precomputedIsPro && !trialOnly) {
    return { over: false, current: 0, limit };
  }
  const current = await sumMonthlySpendCents(userId);
  return { over: current >= limit, current, limit };
}

/**
 * Look up whether a user's isPro=true is trial-only (in-future
 * trial_ends_at but no paid subscription and no admin grant).
 * Used by callers that already know isPro is true but need the
 * distinction to decide whether the spend cap applies.
 *
 * Never throws — returns false on any read error (fail-open on
 * the query, not on the cap; the cap itself is fail-closed).
 */
export async function isTrialOnly(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("pro_until, trial_ends_at, plan_source")
      .eq("id", userId)
      .maybeSingle<{
        pro_until: string | null;
        trial_ends_at: string | null;
        plan_source: string | null;
      }>();
    if (error || !data) return false;
    if (data.plan_source === "admin_grant") return false;
    if (data.pro_until && new Date(data.pro_until).getTime() > Date.now()) {
      return false;
    }
    if (
      data.trial_ends_at &&
      new Date(data.trial_ends_at).getTime() > Date.now()
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
