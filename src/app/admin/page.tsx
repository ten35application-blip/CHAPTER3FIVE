import Link from "next/link";
import {
  createAdminClient,
  daysAgo,
  fetchPaidPayments,
  formatUsd,
  getEmailMap,
  safeCount,
  safeSelect,
  startOfMonth,
  startOfToday,
  sumCents,
} from "@/lib/admin/queries";

/**
 * The admin home, redone (Wilson 2026-08-26: "CLEAN, easy to read,
 * easy to navigate — chevrons, not the slide to the right").
 *
 * One page, three chevron sections — Revenue, Users, Reports — built
 * on native <details>/<summary>, so there is zero client JS, nothing
 * horizontally scrolling except tables inside their own containers,
 * and every section's summary row already tells the story while
 * closed (counts and totals live in the chevron row itself). Deep
 * pages (/admin/users/[id], /admin/identities/[id]) remain for
 * drill-down; this page is the place you actually live.
 */

export const dynamic = "force-dynamic";

type StoreRow = {
  user_id: string | null;
  product_id: string | null;
  platform: string | null;
  amount_cents: number | null;
  purchased_at: string | null;
  refunded_at: string | null;
};
type ProfileRow = {
  id: string;
  created_at: string;
  subscription_tier: string | null;
  pro_until: string | null;
  last_active_at: string | null;
  deleted_at: string | null;
};
type ReportRow = {
  id: string;
  reason: string | null;
  status: string | null;
  created_at: string;
  reporter_user_id: string | null;
};
type OracleReportRow = {
  id: string;
  reason: string | null;
  status: string | null;
  created_at: string;
  reporter_user_id: string | null;
};
type CrisisRow = {
  id: string;
  user_id: string | null;
  flagged_at: string;
  resolved_at: string | null;
};
type FailRow = {
  id: string;
  kind: string | null;
  created_at: string;
  user_id: string | null;
  resolved_at: string | null;
};

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";
const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export default async function AdminHomePage() {
  const supabase = createAdminClient();
  const monthStart = startOfMonth();
  const today = startOfToday();
  const week = daysAgo(7);

  const [
    payments,
    storeRows,
    profiles,
    totalUsers,
    msgReports,
    oracleReports,
    crisisFlags,
    grantFails,
  ] = await Promise.all([
    fetchPaidPayments(supabase),
    safeSelect<StoreRow>(
      supabase,
      "store_purchases",
      "user_id, product_id, platform, amount_cents, purchased_at, refunded_at",
      (q) => q.order("purchased_at", { ascending: false }).limit(200),
    ),
    safeSelect<ProfileRow>(
      supabase,
      "profiles",
      "id, created_at, subscription_tier, pro_until, last_active_at, deleted_at",
      (q) => q.order("created_at", { ascending: false }).limit(100),
    ),
    safeCount(supabase, "profiles"),
    safeSelect<ReportRow>(
      supabase,
      "message_reports",
      "id, reason, status, created_at, reporter_user_id",
      (q) => q.order("created_at", { ascending: false }).limit(50),
    ),
    safeSelect<OracleReportRow>(
      supabase,
      "oracle_reports",
      "id, reason, status, created_at, reporter_user_id",
      (q) => q.order("created_at", { ascending: false }).limit(50),
    ),
    safeSelect<CrisisRow>(
      supabase,
      "crisis_flags",
      "id, user_id, flagged_at, resolved_at",
      (q) => q.order("flagged_at", { ascending: false }).limit(50),
    ),
    safeSelect<FailRow>(
      supabase,
      "grant_failures",
      "id, kind, created_at, user_id, resolved_at",
      (q) => q.order("created_at", { ascending: false }).limit(50),
    ),
  ]);

  // getEmailMap loads the whole auth list once (fine at this scale —
  // its own docstring says move to a SQL view past a few thousand).
  const emails = await getEmailMap(supabase);
  const emailOf = (id: string | null | undefined) =>
    (id && emails.get(id)) || "—";

  // ── Revenue numbers ──
  const liveStore = storeRows.filter((r) => !r.refunded_at);
  const storeSum = (since?: Date) =>
    liveStore
      .filter((r) => !since || new Date(r.purchased_at ?? 0) >= since)
      .reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const webToday = sumCents(payments, today);
  const webMonth = sumCents(payments, monthStart);
  const webAll = sumCents(payments);
  const revToday = storeSum(today) + webToday;
  const revWeek = storeSum(week) + sumCents(payments, week);
  const revMonth = storeSum(monthStart) + webMonth;
  const revAll = storeSum() + webAll;

  // A single unified ledger, newest first.
  type LedgerRow = {
    when: string;
    email: string;
    item: string;
    platform: string;
    amount: number;
    refunded: boolean;
  };
  const ledger: LedgerRow[] = [
    ...storeRows.map((r) => ({
      when: r.purchased_at ?? "",
      email: emailOf(r.user_id),
      item: (r.product_id ?? "").replace("chapter3five.", ""),
      platform: r.platform === "ios" ? "" : "▶",
      amount: r.amount_cents ?? 0,
      refunded: !!r.refunded_at,
    })),
    ...payments.map((p) => ({
      when: (p.paid_at ?? p.created_at) as string,
      email: emailOf(p.user_id),
      item: p.purpose ?? "payment",
      platform: "web",
      amount: p.amount_cents ?? 0,
      refunded: p.status === "refunded",
    })),
  ]
    .sort((a, b) => (a.when < b.when ? 1 : -1))
    .slice(0, 60);

  const openFails = grantFails.filter((f) => !f.resolved_at);

  // ── Reports numbers ──
  const pendingMsg = msgReports.filter((r) => r.status === "pending");
  const pendingOracle = oracleReports.filter((r) => r.status === "pending");
  const openCrisis = crisisFlags.filter((c) => !c.resolved_at);
  const reportsNeedingEyes =
    pendingMsg.length + pendingOracle.length + openCrisis.length;

  const usersThisWeek = profiles.filter(
    (p) => new Date(p.created_at) >= week,
  ).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight text-warm-50">
        Admin
      </h1>
      <p className="mt-1 text-sm text-warm-400">
        Everything in three drawers. A number on the row means something
        is inside.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {/* ── 1 · REVENUE ─────────────────────────────── */}
        <Section
          title="Revenue"
          summary={`${formatUsd(revMonth)} this month · ${formatUsd(revAll)} all-time`}
          alert={openFails.length > 0 ? `${openFails.length} grant failure(s)` : null}
          defaultOpen
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Today" value={formatUsd(revToday)} />
            <Stat label="7 days" value={formatUsd(revWeek)} />
            <Stat label="This month" value={formatUsd(revMonth)} />
            <Stat label="All-time" value={formatUsd(revAll)} />
          </div>

          {openFails.length > 0 && (
            <div className="mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-strong">
              <p className="font-semibold">
                {openFails.length} payment(s) may not have delivered what
                was bought:
              </p>
              <ul className="mt-2 space-y-1">
                {openFails.slice(0, 5).map((f) => (
                  <li key={f.id}>
                    {fmtDateTime(f.created_at)} — {emailOf(f.user_id)} —{" "}
                    {f.kind ?? "unknown"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AdminTable
            head={["When", "Who", "What", "Where", "Amount"]}
            rows={ledger.map((l) => [
              fmtDateTime(l.when),
              l.email,
              l.refunded ? `${l.item} (refunded)` : l.item,
              l.platform,
              formatUsd(l.amount),
            ])}
            dimRow={(i) => ledger[i].refunded}
            empty="No payments yet — the first one shows up here."
          />
        </Section>

        {/* ── 2 · USERS ───────────────────────────────── */}
        <Section
          title="Users"
          summary={`${totalUsers} total · ${usersThisWeek} new this week`}
        >
          <AdminTable
            head={["Email", "Joined", "Plan", "Last seen"]}
            rows={profiles.map((p) => [
              <Link
                key={p.id}
                href={`/admin/users/${p.id}`}
                className="font-medium text-warm-100 underline-offset-4 hover:underline"
              >
                {emailOf(p.id)}
              </Link>,
              fmtDate(p.created_at),
              p.deleted_at
                ? "deleted"
                : p.subscription_tier ??
                  (p.pro_until && new Date(p.pro_until) > new Date()
                    ? "pro"
                    : "free"),
              fmtDate(p.last_active_at),
            ])}
            empty="Nobody yet."
          />
          <p className="mt-3 text-xs text-warm-400">
            Newest 100 shown — open{" "}
            <Link href="/admin/users" className="underline underline-offset-4">
              the full list
            </Link>{" "}
            to search, or{" "}
            <Link
              href="/admin/identities"
              className="underline underline-offset-4"
            >
              browse identities
            </Link>
            .
          </p>
        </Section>

        {/* ── 3 · REPORTS ─────────────────────────────── */}
        <Section
          title="Reports"
          summary={
            reportsNeedingEyes === 0
              ? "queue empty"
              : `${reportsNeedingEyes} need eyes`
          }
          alert={
            openCrisis.length > 0
              ? `${openCrisis.length} crisis flag(s)`
              : reportsNeedingEyes > 0
                ? `${reportsNeedingEyes} pending`
                : null
          }
        >
          {openCrisis.length > 0 && (
            <div className="mb-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-strong">
              <p className="font-semibold">
                Crisis flags — these are people. Same-day, always.
              </p>
              <ul className="mt-2 space-y-1">
                {openCrisis.map((c) => (
                  <li key={c.id}>
                    {fmtDateTime(c.flagged_at)} —{" "}
                    <Link
                      href={`/admin/users/${c.user_id}`}
                      className="underline underline-offset-4"
                    >
                      {emailOf(c.user_id)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h3 className="text-sm font-semibold text-warm-200">
            Message reports
          </h3>
          <AdminTable
            head={["When", "Reporter", "Reason", "Status"]}
            rows={msgReports.map((r) => [
              fmtDateTime(r.created_at),
              emailOf(r.reporter_user_id),
              r.reason ?? "—",
              r.status ?? "—",
            ])}
            dimRow={(i) => msgReports[i].status !== "pending"}
            empty="No message reports."
          />

          <h3 className="mt-6 text-sm font-semibold text-warm-200">
            Identity reports
          </h3>
          <AdminTable
            head={["When", "Reporter", "Reason", "Status"]}
            rows={oracleReports.map((r) => [
              fmtDateTime(r.created_at),
              emailOf(r.reporter_user_id),
              r.reason ?? "—",
              r.status ?? "—",
            ])}
            dimRow={(i) => oracleReports[i].status !== "pending"}
            empty="No identity reports."
          />
          <p className="mt-3 text-xs text-warm-400">
            Actions (resolve, dismiss) live on{" "}
            <Link href="/admin/reports" className="underline underline-offset-4">
              the reports page
            </Link>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}

/* ── building blocks ─────────────────────────────────── */

function Section({
  title,
  summary,
  alert,
  defaultOpen,
  children,
}: {
  title: string;
  summary: string;
  alert?: string | null;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-warm-700 bg-ink-soft"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="shrink-0 text-warm-400 transition-transform group-open:rotate-90"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-lg font-bold tracking-tight text-warm-50">
          {title}
        </span>
        <span className="min-w-0 truncate text-sm text-warm-400">
          {summary}
        </span>
        {alert ? (
          <span className="ml-auto shrink-0 rounded-full bg-coral/15 px-2.5 py-1 text-xs font-semibold text-coral-strong ring-1 ring-coral/30">
            {alert}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-warm-700/60 px-5 py-5">{children}</div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-warm-700/60 bg-ink px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-warm-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-warm-50">
        {value}
      </p>
    </div>
  );
}

function AdminTable({
  head,
  rows,
  empty,
  dimRow,
}: {
  head: string[];
  rows: React.ReactNode[][];
  empty: string;
  dimRow?: (index: number) => boolean;
}) {
  if (rows.length === 0) {
    return <p className="mt-4 text-sm text-warm-400">{empty}</p>;
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-warm-700/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-warm-700/60 bg-ink text-left">
            {head.map((h) => (
              <th
                key={h}
                className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-warm-400"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr
              key={i}
              className={`border-b border-warm-700/40 last:border-b-0 ${
                dimRow?.(i) ? "opacity-45" : ""
              }`}
            >
              {cells.map((c, j) => (
                <td
                  key={j}
                  className="whitespace-nowrap px-3 py-2 tabular-nums text-warm-200"
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
