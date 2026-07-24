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
