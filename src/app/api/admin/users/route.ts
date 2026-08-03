import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { isAdmin } from "@/lib/admin/allowlist";
import { listAllUsers, safeSelect } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users — JSON twin of the /admin/users page for the
 * mobile admin surface. Same data pipeline as the web page: emails
 * come from the GoTrue admin API (auth schema isn't reachable through
 * PostgREST); identity counts, terms state, plan, 30-day spend and
 * last-activity are stitched on from service-role table reads.
 *
 * Query params (all optional, mirroring the web page's filter chips):
 *   search  — case-insensitive email substring (web `q`)
 *   plan    — pro|trial|comped|cancel|lapsed|free
 *   since   — today|week|month (signed-up cohort window)
 *   sort    — recent|spend|activity (default recent)
 *   limit   — default 50, hard cap 200
 *   offset  — default 0
 */
type PlanTone = "pro" | "trial" | "comped" | "cancel" | "lapsed" | "free";
type SinceKey = "today" | "week" | "month";
type SortKey = "recent" | "spend" | "activity";

export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const supabase = gate.admin;

  const url = new URL(request.url);
  const q = url.searchParams.get("search") ?? url.searchParams.get("q") ?? "";
  const planRaw = url.searchParams.get("plan") ?? "";
  const sinceRaw = url.searchParams.get("since") ?? "";
  const sortRaw = url.searchParams.get("sort") ?? "";
  const activeFilter = (
    ["pro", "trial", "comped", "cancel", "lapsed", "free"] as const
  ).includes(planRaw as PlanTone)
    ? (planRaw as PlanTone)
    : null;
  const sinceFilter = (["today", "week", "month"] as const).includes(
    sinceRaw as SinceKey,
  )
    ? (sinceRaw as SinceKey)
    : null;
  const sortKey: SortKey = (["recent", "spend", "activity"] as const).includes(
    sortRaw as SortKey,
  )
    ? (sortRaw as SortKey)
    : "recent";
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
  );
  const offset = Math.max(
    0,
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
  );

  // 30-day COGS lookback for the per-user spend column. Reads once
  // and buckets by user_id — cheaper than N per-user queries.
  const monthAgoIso = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [users, oracles, profiles, spend, activity] = await Promise.all([
    listAllUsers(supabase),
    safeSelect<{ user_id: string; updated_at: string }>(
      supabase,
      "oracles",
      "user_id, updated_at",
      (query) => query.is("deleted_at", null),
    ),
    safeSelect<{
      id: string;
      terms_accepted_at: string | null;
      pro_until: string | null;
      trial_ends_at: string | null;
      plan_source: string | null;
      stripe_subscription_id: string | null;
      cancel_at_period_end: boolean | null;
      subscription_status: string | null;
    }>(
      supabase,
      "profiles",
      "id, terms_accepted_at, pro_until, trial_ends_at, plan_source, stripe_subscription_id, cancel_at_period_end, subscription_status",
    ),
    safeSelect<{ user_id: string; cents: number | null }>(
      supabase,
      "chat_spend_events",
      "user_id, cents",
      (q2) => q2.gte("created_at", monthAgoIso),
    ),
    safeSelect<{ user_id: string; created_at: string }>(
      supabase,
      "messages",
      "user_id, created_at",
      (q2) => q2.eq("role", "user").gte("created_at", monthAgoIso),
    ),
  ]);

  const spendByUser = new Map<string, number>();
  for (const row of spend) {
    if (!row.user_id) continue;
    const c = typeof row.cents === "number" ? row.cents : 0;
    spendByUser.set(row.user_id, (spendByUser.get(row.user_id) ?? 0) + c);
  }
  // Per-user last-message timestamp — "last active" reflects app
  // usage, not just sign-in cookie refresh.
  const lastMessageByUser = new Map<string, string>();
  for (const row of activity) {
    if (!row.user_id || !row.created_at) continue;
    const existing = lastMessageByUser.get(row.user_id);
    if (!existing || row.created_at > existing) {
      lastMessageByUser.set(row.user_id, row.created_at);
    }
  }

  const identityCounts = new Map<string, number>();
  for (const o of oracles) {
    identityCounts.set(o.user_id, (identityCounts.get(o.user_id) ?? 0) + 1);
  }
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const termsByUser = new Map(profiles.map((p) => [p.id, p.terms_accepted_at]));

  // Plan resolution — verbatim port of the web page's planLabel().
  // Allowlisted admins resolve FIRST so a stale trial_ends_at from
  // before allowlisting never reads as "Trial"/"Free".
  const nowMs = Date.now();
  function planLabel(
    userId: string,
    email: string | null | undefined,
  ): { label: string; tone: PlanTone } {
    if (isAdmin(email)) return { label: "Admin", tone: "comped" };
    const p = profileById.get(userId);
    if (!p) return { label: "Free", tone: "free" };
    const proActive = p.pro_until && new Date(p.pro_until).getTime() > nowMs;
    const trialActive =
      p.trial_ends_at && new Date(p.trial_ends_at).getTime() > nowMs;
    if (p.plan_source === "admin_grant" && proActive) {
      return { label: "Comped", tone: "comped" };
    }
    if (p.stripe_subscription_id && proActive) {
      if (p.cancel_at_period_end) {
        return { label: "Cancelling", tone: "cancel" };
      }
      return { label: "Paid Pro", tone: "pro" };
    }
    if (trialActive && !p.stripe_subscription_id) {
      return { label: "Trial", tone: "trial" };
    }
    if (p.subscription_status === "canceled" && !proActive) {
      return { label: "Cancelled", tone: "lapsed" };
    }
    return { label: "Free", tone: "free" };
  }

  const sinceMs =
    sinceFilter === "today"
      ? Date.now() - 24 * 60 * 60 * 1000
      : sinceFilter === "week"
        ? Date.now() - 7 * 24 * 60 * 60 * 1000
        : sinceFilter === "month"
          ? Date.now() - 30 * 24 * 60 * 60 * 1000
          : null;

  const needle = q.trim().toLowerCase();
  const filtered = users
    .filter((u) => !needle || (u.email ?? "").toLowerCase().includes(needle))
    .filter(
      (u) => !activeFilter || planLabel(u.id, u.email).tone === activeFilter,
    )
    .filter(
      (u) => sinceMs === null || new Date(u.created_at).getTime() >= sinceMs,
    )
    .sort((a, b) => {
      if (sortKey === "spend") {
        return (spendByUser.get(b.id) ?? 0) - (spendByUser.get(a.id) ?? 0);
      }
      if (sortKey === "activity") {
        const av = lastMessageByUser.get(a.id) ?? "";
        const bv = lastMessageByUser.get(b.id) ?? "";
        return bv.localeCompare(av);
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

  const pageRows = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    users: pageRows.map((u) => {
      const plan = planLabel(u.id, u.email);
      const lastMsg = lastMessageByUser.get(u.id) ?? null;
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at,
        is_admin: isAdmin(u.email),
        terms_accepted_at: termsByUser.get(u.id) ?? null,
        identity_count: identityCounts.get(u.id) ?? 0,
        // Prefer real last-message-sent over GoTrue's last_sign_in_at,
        // same as the web column.
        last_active: lastMsg ?? u.last_sign_in_at ?? null,
        spend_30d_cents: spendByUser.get(u.id) ?? 0,
        plan,
      };
    }),
    total: filtered.length,
    hasMore: offset + pageRows.length < filtered.length,
  });
}
