import Link from "next/link";
import { isAdmin } from "@/lib/admin/allowlist";
import {
  createAdminClient,
  daysAgo,
  fetchPaidPayments,
  formatUsd,
  safeCount,
  safeSelect,
  startOfMonth,
  startOfToday,
  sumCents,
} from "@/lib/admin/queries";
import {
  EmptyStateCard,
  MetricCard,
  MetricSection,
} from "./_components/MetricCard";

/**
 * /admin — overview dashboard. All reads go through the service-role
 * client (bypasses RLS) because every number here spans all users.
 * The admin gate lives in layout.tsx + the edge proxy.
 */
export default async function AdminOverviewPage() {
  const supabase = createAdminClient();

  const today = startOfToday().toISOString();
  const week = daysAgo(7).toISOString();
  const prevWeek = daysAgo(14).toISOString();

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
  ] = await Promise.all([
    // People — profiles is 1:1 with auth.users (created by the signup
    // trigger in 0001), so counting profiles counts users without a
    // GoTrue admin-API round-trip.
    safeCount(supabase, "profiles"),
    safeCount(supabase, "profiles", (q) => q.gte("created_at", today)),
    safeCount(supabase, "profiles", (q) => q.gte("created_at", week)),
    safeCount(supabase, "profiles", (q) =>
      q.gte("created_at", prevWeek).lt("created_at", week),
    ),
    safeCount(supabase, "profiles", (q) => q.not("terms_accepted_at", "is", null)),

    // Identities
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
      q.is("deleted_at", null).gte("created_at", prevWeek).lt("created_at", week),
    ),
    safeCount(supabase, "inherit_codes"),
    // Redemptions live on oracles since 0111: each redeemed code
    // stamps an inherited copy with inherited_at.
    safeCount(supabase, "oracles", (q) => q.not("inherited_at", "is", null)),

    // Engagement — messages table exists (0011)
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
  ]);

  // Subscription breakdown — pro_until in future = paid Pro,
  // trial_ends_at in future = trialer, plan_source='admin_grant'
  // = comped, everything else = free. Also count cancellations
  // (subscription_status='canceled' or cancel_at_period_end=true).
  // Allowlisted admins are checked FIRST (same ordering rule as the
  // settings plan label): they're Pro-forever via isAdmin, and many
  // carry a stale trial_ends_at from before they were allowlisted —
  // without this they'd inflate "On trial" (and drag the conversion
  // rate) or pad "Free".
  const { data: planRows } = await supabase
    .from("profiles")
    .select(
      "email, pro_until, trial_ends_at, plan_source, stripe_subscription_id, subscription_status, cancel_at_period_end, deleted_at",
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
    if (isAdmin(row.email as string | null)) {
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

  // Activity cohorts — DAU/WAU/MAU by distinct message-sending user.
  const dayAgoIso = daysAgo(1).toISOString();
  const monthAgoIso = daysAgo(30).toISOString();
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

  // Moderation queue — pending reports awaiting admin action.
  const pendingReports = await safeCount(supabase, "message_reports", (q) =>
    q.eq("status", "pending"),
  );

  // COGS: what Anthropic + OpenAI cost us this month, per the
  // chat_spend_events ledger (0081). Zero rows before Batch A/B/D/E
  // extended the recorders; real numbers show once traffic lands.
  const monthStartIso = startOfMonth().toISOString();
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
  const topSpendRoutes = [...spendByRoute.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topSpendUserCents = [...spendByUser.values()].sort((a, b) => b - a)[0] ?? 0;

  // Cron heartbeat: last row per configured job.
  const { data: cronRows } = await supabase
    .from("cron_runs")
    .select("job, status, created_at, error")
    .order("created_at", { ascending: false })
    .limit(200);
  type CronRow = {
    job: string;
    status: string | null;
    created_at: string;
    error: string | null;
  };
  const latestByJob = new Map<string, CronRow>();
  for (const row of (cronRows ?? []) as CronRow[]) {
    if (!latestByJob.has(row.job)) latestByJob.set(row.job, row);
  }
  const cronJobList = [
    "outreach",
    "proactive",
    "purge",
    "reflect",
    "anniversaries",
    "daily-question",
    "check-in",
    "persona-outreach",
    "passing",
  ];
  const staleCrons = cronJobList.filter((job) => {
    const row = latestByJob.get(job);
    if (!row) return true;
    // Vercel Hobby caps at once-per-day so all crons are daily-
    // invoked. 48h grace = 2× cadence.
    const graceMs = 48 * 60 * 60 * 1000;
    return Date.now() - new Date(row.created_at).getTime() > graceMs;
  });
  const erroredCrons = cronJobList.filter(
    (job) => latestByJob.get(job)?.status === "error",
  );

  // Randomized = everything that isn't explicitly legacy (is_legacy is
  // false OR null for pre-0055 rows).
  const randomizedIdentities = totalIdentities - legacyIdentities;

  // Distinct (user, oracle) conversations active this week.
  const activeChats = new Set(chatPairs.map((m) => `${m.user_id}:${m.oracle_id}`))
    .size;

  const revenueAllTime = sumCents(payments);
  const revenueToday = sumCents(payments, startOfToday());
  const revenueWeek = sumCents(payments, daysAgo(7));
  const revenuePrevWeek = sumCents(payments, daysAgo(14)) - revenueWeek;
  const revenueMonth = sumCents(payments, startOfMonth());
  const hasAnyRevenue = revenueAllTime > 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-warm-50">
          Overview
        </h1>
        <p className="text-sm text-warm-300">
          Everything across chapter3five, updated on every load.
        </p>
      </header>

      <MetricSection title="People" collapsibleKey="admin.overview.people">
        <MetricCard
          label="Total users"
          value={totalUsers.toLocaleString()}
          href="/admin/users"
        />
        <MetricCard
          label="Signed up today"
          value={usersToday.toLocaleString()}
          href="/admin/users?since=today"
        />
        <MetricCard
          label="Signed up this week"
          value={usersThisWeek.toLocaleString()}
          delta={usersThisWeek - usersPrevWeek}
          href="/admin/users?since=week"
        />
        <MetricCard
          label="Accepted terms"
          value={acceptedTerms.toLocaleString()}
          hint={
            totalUsers > 0
              ? `${Math.round((acceptedTerms / totalUsers) * 100)}% of all users`
              : undefined
          }
        />
      </MetricSection>

      {/* Subscription health — the "who's paying, who's on trial,
          who cancelled" story. Every card links to the filtered
          /admin/users view for that cohort. */}
      <MetricSection title="Subscriptions" collapsibleKey="admin.overview.subscriptions">
        <MetricCard
          label="Paid Pro"
          value={paidPro.toLocaleString()}
          href="/admin/users?plan=pro"
          hint={
            canceledPending > 0
              ? `${canceledPending.toLocaleString()} cancelling at period end`
              : "tap to see emails"
          }
        />
        <MetricCard
          label="On trial"
          value={trialers.toLocaleString()}
          href="/admin/users?plan=trial"
          hint={`Conversion so far: ${conversionRate}%`}
        />
        <MetricCard
          label="Comped (admin)"
          value={comped.toLocaleString()}
          href="/admin/users?plan=comped"
          hint={
            comped > 0
              ? "allowlist admins + admin_grant"
              : "no comped accounts"
          }
        />
        <MetricCard
          label="Free"
          value={freeUsers.toLocaleString()}
          href="/admin/users?plan=free"
          hint={
            softDeleted > 0
              ? `${softDeleted.toLocaleString()} soft-deleted excluded`
              : "tap to see emails"
          }
        />
        <MetricCard
          label="Cancelled (lapsed)"
          value={canceledLapsed.toLocaleString()}
          href="/admin/users?plan=lapsed"
          hint="pro_until in past, no active sub"
        />
        <MetricCard
          label="Cancelled (pending)"
          value={canceledPending.toLocaleString()}
          href="/admin/users?plan=cancel"
          hint="Still in period, sub set to cancel"
        />
      </MetricSection>

      {/* Activity — the shape of engagement past the vanity count. */}
      <MetricSection title="Activity" collapsibleKey="admin.overview.activity">
        <MetricCard
          label="Daily active"
          value={dau.toLocaleString()}
          hint="users who sent a message today"
        />
        <MetricCard
          label="Weekly active"
          value={wau.toLocaleString()}
          hint="last 7 days"
        />
        <MetricCard
          label="Monthly active"
          value={mau.toLocaleString()}
          hint="last 30 days"
        />
        <MetricCard
          label="DAU / MAU"
          value={`${dauMau}%`}
          hint="stickiness — 20%+ is very good for a companion app"
        />
      </MetricSection>

      {/* Moderation surface — anything waiting on Wilson. */}
      <MetricSection title="Needs attention" collapsibleKey="admin.overview.attention">
        <MetricCard
          label="Reports pending"
          value={pendingReports.toLocaleString()}
          href={pendingReports > 0 ? "/admin/reports" : undefined}
          hint={
            pendingReports > 0 ? "tap to review" : "queue is empty"
          }
        />
      </MetricSection>

      <MetricSection title="Identities" collapsibleKey="admin.overview.identities">
        <MetricCard
          label="Total identities"
          value={totalIdentities.toLocaleString()}
        />
        <MetricCard
          label="Randomized"
          value={randomizedIdentities.toLocaleString()}
        />
        <MetricCard label="Legacy" value={legacyIdentities.toLocaleString()} />
        <MetricCard
          label="Created this week"
          value={identitiesThisWeek.toLocaleString()}
          delta={identitiesThisWeek - identitiesPrevWeek}
          hint={`${identitiesToday.toLocaleString()} today`}
        />
        <MetricCard
          label="Inherit codes minted"
          value={codesMinted.toLocaleString()}
        />
        <MetricCard
          label="Inherit codes redeemed"
          value={codesRedeemed.toLocaleString()}
        />
      </MetricSection>

      <MetricSection title="Money" collapsibleKey="admin.overview.money">
        {hasAnyRevenue ? (
          <>
            <MetricCard
              label="MRR estimate"
              value="—"
              hint="No subscriptions table yet — based on active subs once Stripe billing is wired"
            />
            <MetricCard label="Revenue today" value={formatUsd(revenueToday)} />
            <MetricCard
              label="Revenue this week"
              value={formatUsd(revenueWeek)}
              delta={
                revenueWeek - revenuePrevWeek !== 0
                  ? Math.round((revenueWeek - revenuePrevWeek) / 100)
                  : 0
              }
              deltaLabel="USD vs last week"
            />
            <MetricCard
              label="Revenue this month"
              value={formatUsd(revenueMonth)}
              hint={`All-time ${formatUsd(revenueAllTime)}`}
            />
          </>
        ) : (
          <EmptyStateCard
            title="No payments yet — Stripe billing not wired"
            body="The money widgets are pre-plumbed against the payments table. The moment Stripe is connected and the first charge lands, today / week / month / all-time revenue appear here automatically."
          />
        )}
      </MetricSection>

      <MetricSection title="Engagement" collapsibleKey="admin.overview.engagement">
        <MetricCard
          label="Chats active this week"
          value={activeChats.toLocaleString()}
          hint="Distinct person-to-identity conversations"
        />
        <MetricCard
          label="Messages this week"
          value={messagesThisWeek.toLocaleString()}
          delta={messagesThisWeek - messagesPrevWeek}
        />
      </MetricSection>

      {/* COGS — Anthropic + OpenAI spend this month, per the
          chat_spend_events ledger. Populated by /api/chat/[id]/stream,
          the crons that were wired in Batch E, and the whisper route. */}
      <MetricSection title="COGS (this month)" collapsibleKey="admin.overview.cogs">
        <MetricCard
          label="Spend this month"
          value={formatUsd(spendMonthCents)}
          hint={`${(spendRows ?? []).length.toLocaleString()} ledgered calls`}
        />
        <MetricCard
          label="Top user this month"
          value={formatUsd(topSpendUserCents)}
          hint={`${spendByUser.size} distinct spenders`}
        />
        <MetricCard
          label="Top route this month"
          value={topSpendRoutes[0] ? topSpendRoutes[0][0] : "—"}
          hint={
            topSpendRoutes[0]
              ? formatUsd(topSpendRoutes[0][1])
              : "no traffic yet"
          }
        />
      </MetricSection>

      {/* Cron heartbeat. Stale = last run older than 2× cadence. */}
      <MetricSection title="Cron health" collapsibleKey="admin.overview.cron">
        <MetricCard
          label="Configured jobs"
          value={cronJobList.length.toString()}
        />
        <MetricCard
          label="Stale"
          value={staleCrons.length.toString()}
          hint={staleCrons.length > 0 ? staleCrons.join(", ") : "all fresh"}
        />
        <MetricCard
          label="Errored (last run)"
          value={erroredCrons.length.toString()}
          hint={erroredCrons.length > 0 ? erroredCrons.join(", ") : "all clean"}
        />
      </MetricSection>

      <p className="text-xs text-warm-400">
        Deeper cuts live in{" "}
        <Link href="/admin/users" className="font-medium text-warm-200 hover:text-warm-50">
          Users
        </Link>
        ,{" "}
        <Link href="/admin/revenue" className="font-medium text-warm-200 hover:text-warm-50">
          Revenue
        </Link>{" "}
        and{" "}
        <Link href="/admin/identities" className="font-medium text-warm-200 hover:text-warm-50">
          Identities
        </Link>
        .
      </p>
    </div>
  );
}
