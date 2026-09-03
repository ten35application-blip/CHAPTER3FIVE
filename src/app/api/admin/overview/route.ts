import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { ADMIN_EMAILS } from "@/lib/admin/allowlist";
import {
  daysAgo,
  fetchPaidPayments,
  safeCount,
  safeSelect,
  startOfMonth,
  startOfToday,
  sumCents,
} from "@/lib/admin/queries";

export const runtime = "nodejs";
// Every read spans all users + hits the DB on request; can't be
// statically cached.
export const dynamic = "force-dynamic";

/**
 * Admin overview payload — 1:1 mirror of the data web
 * src/app/admin/page.tsx renders. Bearer-authed via requireAdminApi
 * (signed-in + email on the allowlist; 404 for signed-in non-admins).
 *
 * All the aggregation runs through the service-role client (bypasses
 * RLS) — these are cross-user counts. Every count is `safe`: a
 * missing table degrades to 0 instead of a 500, so the admin dash
 * never breaks because a migration hasn't landed.
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const supabase = gate.admin;

  const today = startOfToday().toISOString();
  const week = daysAgo(7).toISOString();
  const prevWeek = daysAgo(14).toISOString();
  const monthStartIso = startOfMonth().toISOString();
  const dayAgoIso = daysAgo(1).toISOString();
  const monthAgoIso = daysAgo(30).toISOString();

  const [
    totalUsers,
    usersToday,
    usersThisWeek,
    usersPrevWeek,
    acceptedTerms,
    totalIdentities,
    legacyIdentities,
    identitiesToday,
    identitiesThisWeek,
    identitiesPrevWeek,
    codesMinted,
    codesRedeemed,
    messagesThisWeek,
    messagesPrevWeek,
    chatPairs,
    payments,
    pendingReports,
  ] = await Promise.all([
    safeCount(supabase, "profiles"),
    safeCount(supabase, "profiles", (q) => q.gte("created_at", today)),
    safeCount(supabase, "profiles", (q) => q.gte("created_at", week)),
    safeCount(supabase, "profiles", (q) =>
      q.gte("created_at", prevWeek).lt("created_at", week),
    ),
    safeCount(supabase, "profiles", (q) =>
      q.not("terms_accepted_at", "is", null),
    ),
    safeCount(supabase, "oracles", (q) => q.is("deleted_at", null)),
    safeCount(supabase, "oracles", (q) =>
      q.is("deleted_at", null).eq("is_legacy", true),
    ),
    safeCount(supabase, "oracles", (q) =>
      q.is("deleted_at", null).gte("created_at", today),
    ),
    safeCount(supabase, "oracles", (q) =>
      q.is("deleted_at", null).gte("created_at", week),
    ),
    safeCount(supabase, "oracles", (q) =>
      q
        .is("deleted_at", null)
        .gte("created_at", prevWeek)
        .lt("created_at", week),
    ),
    safeCount(supabase, "inherit_codes"),
    safeCount(supabase, "oracles", (q) => q.not("inherited_at", "is", null)),
    safeCount(supabase, "messages", (q) => q.gte("created_at", week)),
    safeCount(supabase, "messages", (q) =>
      q.gte("created_at", prevWeek).lt("created_at", week),
    ),
    safeSelect<{ user_id: string; oracle_id: string }>(
      supabase,
      "messages",
      "user_id, oracle_id",
      (q) => q.gte("created_at", week),
    ),
    fetchPaidPayments(supabase),
    safeCount(supabase, "message_reports", (q) => q.eq("status", "pending")),
  ]);

  // Subscription breakdown — pro_until in future = paid Pro,
  // trial_ends_at in future = trialer, plan_source='admin_grant' or
  // allowlisted email = comped, else free. Allowlisted admins are
  // checked FIRST so a stale trial_ends_at doesn't inflate "On trial."
  // Two-step: fetch the admin auth.users ids (email lives on
  // auth.users, NOT public.profiles — same bug class killed today in
  // canCreateOracle / isProByUserId / isTrialOnly). Correlate by id
  // instead of email inside the loop.
  const { data: adminAuthRows } = await supabase
    .schema("auth")
    .from("users")
    .select("id")
    .in(
      "email",
      ADMIN_EMAILS.map((e) => e.toLowerCase()),
    )
    .returns<{ id: string }[]>();
  const adminUserIds = new Set((adminAuthRows ?? []).map((r) => r.id));

  const { data: planRows } = await supabase
    .from("profiles")
    .select(
      "id, pro_until, trial_ends_at, plan_source, stripe_subscription_id, subscription_status, cancel_at_period_end, deleted_at",
    );
  const nowMs = Date.now();
  let paidPro = 0;
  let trialers = 0;
  let comped = 0;
  let freeUsers = 0;
  let softDeleted = 0;
  let canceledPending = 0;
  let canceledLapsed = 0;
  for (const row of planRows ?? []) {
    if (row.deleted_at) {
      softDeleted += 1;
      continue;
    }
    const proActive =
      row.pro_until && new Date(row.pro_until as string).getTime() > nowMs;
    const trialActive =
      row.trial_ends_at &&
      new Date(row.trial_ends_at as string).getTime() > nowMs;
    if (adminUserIds.has(row.id as string)) {
      comped += 1;
    } else if (row.plan_source === "admin_grant" && proActive) {
      comped += 1;
    } else if (row.stripe_subscription_id && proActive) {
      paidPro += 1;
      if (row.cancel_at_period_end) canceledPending += 1;
    } else if (trialActive && !row.stripe_subscription_id) {
      trialers += 1;
    } else {
      freeUsers += 1;
    }
    if (row.subscription_status === "canceled" && !proActive) {
      canceledLapsed += 1;
    }
  }
  const conversionRate =
    trialers + paidPro > 0
      ? Math.round((paidPro / (paidPro + trialers)) * 100)
      : 0;

  // DAU / WAU / MAU by distinct message-sending user.
  const [{ data: dauRows }, { data: wauRows }, { data: mauRows }] =
    await Promise.all([
      supabase
        .from("messages")
        .select("user_id")
        .eq("role", "user")
        .gte("created_at", dayAgoIso),
      supabase
        .from("messages")
        .select("user_id")
        .eq("role", "user")
        .gte("created_at", week),
      supabase
        .from("messages")
        .select("user_id")
        .eq("role", "user")
        .gte("created_at", monthAgoIso),
    ]);
  const dau = new Set(
    (dauRows ?? []).map((r) => r.user_id as string).filter(Boolean),
  ).size;
  const wau = new Set(
    (wauRows ?? []).map((r) => r.user_id as string).filter(Boolean),
  ).size;
  const mau = new Set(
    (mauRows ?? []).map((r) => r.user_id as string).filter(Boolean),
  ).size;
  const dauMau = mau > 0 ? Math.round((dau / mau) * 100) : 0;

  // COGS — Anthropic + OpenAI spend this month.
  const { data: spendRows } = await supabase
    .from("chat_spend_events")
    .select("cents, route, user_id")
    .gte("created_at", monthStartIso);
  const spendMonthCents = (spendRows ?? []).reduce(
    (sum, r) => sum + (typeof r.cents === "number" ? r.cents : 0),
    0,
  );
  const spendByRoute = new Map<string, number>();
  const spendByUser = new Map<string, number>();
  for (const r of spendRows ?? []) {
    const c = typeof r.cents === "number" ? r.cents : 0;
    if (r.route) {
      spendByRoute.set(r.route, (spendByRoute.get(r.route) ?? 0) + c);
    }
    if (r.user_id) {
      spendByUser.set(r.user_id, (spendByUser.get(r.user_id) ?? 0) + c);
    }
  }
  const topRoutes = [...spendByRoute.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([route, cents]) => ({ route, cents }));
  const topUserCents = [...spendByUser.values()].sort((a, b) => b - a)[0] ?? 0;

  // Cron heartbeat. Timestamp column is ran_at (migration 0020);
  // created_at doesn't exist and made the query fail outright.
  const { data: cronRows } = await supabase
    .from("cron_runs")
    .select("job, status, ran_at, error")
    .order("ran_at", { ascending: false })
    .limit(200);
  type CronRow = {
    job: string;
    status: string | null;
    ran_at: string;
    error: string | null;
  };
  const latestByJob = new Map<string, CronRow>();
  for (const row of (cronRows ?? []) as CronRow[]) {
    if (!latestByJob.has(row.job)) latestByJob.set(row.job, row);
  }
  // passing intentionally absent (unscheduled 2026-08-04 — see
  // api/cron/passing/route.ts header); reflect is weekly so it gets a
  // 9-day grace instead of the daily jobs' 48h. Mirrors admin/page.tsx.
  const cronJobList = [
    "outreach",
    "proactive",
    "purge",
    "reflect",
    "anniversaries",
    "check-in",
    "persona-outreach",
    "archive-backup",
    "settle",
  ];
  // Same table as api/admin/cron-health: settle is monthly (the 27th)
  // and first fires 2026-09-27 — not stale before it's ever due.
  const graceMsFor = (job: string) =>
    (job === "reflect" ? 9 * 24 : job === "settle" ? 33 * 24 : 48) * 60 * 60 * 1000;
  const notBefore: Record<string, string> = { settle: "2026-09-27T05:05:00Z" };
  const stale = cronJobList.filter((job) => {
    const row = latestByJob.get(job);
    if (!row) return !(notBefore[job] && Date.now() < new Date(notBefore[job]).getTime());
    return Date.now() - new Date(row.ran_at).getTime() > graceMsFor(job);
  });
  const errored = cronJobList.filter(
    (job) => latestByJob.get(job)?.status === "error",
  );

  const randomizedIdentities = totalIdentities - legacyIdentities;
  const activeChats = new Set(
    chatPairs.map((m) => `${m.user_id}:${m.oracle_id}`),
  ).size;
  const revenueAllTime = sumCents(payments);
  const revenueToday = sumCents(payments, startOfToday());
  const revenueWeek = sumCents(payments, daysAgo(7));
  const revenuePrevWeek = sumCents(payments, daysAgo(14)) - revenueWeek;
  const revenueMonth = sumCents(payments, startOfMonth());

  return NextResponse.json({
    people: {
      total: totalUsers,
      today: usersToday,
      week: usersThisWeek,
      prevWeek: usersPrevWeek,
      acceptedTerms,
    },
    subscriptions: {
      paidPro,
      trialers,
      comped,
      free: freeUsers,
      softDeleted,
      canceledPending,
      canceledLapsed,
      conversionRate,
    },
    activity: { dau, wau, mau, dauMau },
    moderation: { pendingReports },
    identities: {
      total: totalIdentities,
      randomized: randomizedIdentities,
      legacy: legacyIdentities,
      week: identitiesThisWeek,
      prevWeek: identitiesPrevWeek,
      today: identitiesToday,
      codesMinted,
      codesRedeemed,
    },
    money: {
      today: revenueToday,
      week: revenueWeek,
      prevWeek: revenuePrevWeek,
      month: revenueMonth,
      allTime: revenueAllTime,
      hasAny: revenueAllTime > 0,
    },
    engagement: {
      activeChats,
      messagesThisWeek,
      messagesPrevWeek,
    },
    cogs: {
      spendMonthCents,
      spendCallCount: (spendRows ?? []).length,
      topUserCents,
      distinctSpenders: spendByUser.size,
      topRoutes,
    },
    cron: {
      configured: cronJobList.length,
      stale,
      errored,
    },
  });
}
