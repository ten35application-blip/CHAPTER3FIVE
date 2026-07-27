import Link from "next/link";
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
    safeCount(supabase, "oracle_shares"),

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

      <MetricSection title="People">
        <MetricCard label="Total users" value={totalUsers.toLocaleString()} />
        <MetricCard label="Signed up today" value={usersToday.toLocaleString()} />
        <MetricCard
          label="Signed up this week"
          value={usersThisWeek.toLocaleString()}
          delta={usersThisWeek - usersPrevWeek}
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

      <MetricSection title="Identities">
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

      <MetricSection title="Money">
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

      <MetricSection title="Engagement">
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
      <MetricSection title="COGS (this month)">
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
      <MetricSection title="Cron health">
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
