import Link from "next/link";
import { createAdminClient, formatUsd } from "@/lib/admin/queries";
import { fetchAdminHome } from "@/lib/admin/home";

/**
 * The admin home, redone (Wilson 2026-08-26: "CLEAN, easy to read,
 * easy to navigate — chevrons, not the slide to the right").
 *
 * One page, three chevron sections — Revenue, Users, Reports — built
 * on native <details>/<summary>: zero client JS, nothing horizontally
 * scrolling except tables inside their own containers, and every
 * drawer's summary row tells the story while closed.
 *
 * ALL data comes from fetchAdminHome — the same assembly the mobile
 * app renders via /api/admin/home. One source; the two admins cannot
 * disagree (self-audit 2026-08-27: this page briefly kept its own
 * duplicate assembly, which is drift waiting to happen).
 */

export const dynamic = "force-dynamic";

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
  const home = await fetchAdminHome(createAdminClient());
  const { revenue, users, reports } = home;

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
          summary={`${formatUsd(revenue.month)} this month · ${formatUsd(revenue.allTime)} all-time`}
          alert={
            revenue.openFailures.length > 0
              ? `${revenue.openFailures.length} grant failure(s)`
              : null
          }
          defaultOpen
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Today" value={formatUsd(revenue.today)} />
            <Stat label="7 days" value={formatUsd(revenue.week)} />
            <Stat label="This month" value={formatUsd(revenue.month)} />
            <Stat label="All-time" value={formatUsd(revenue.allTime)} />
          </div>

          {revenue.openFailures.length > 0 && (
            <div className="mt-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-strong">
              <p className="font-semibold">
                {revenue.openFailures.length} payment(s) may not have
                delivered what was bought:
              </p>
              <ul className="mt-2 space-y-1">
                {revenue.openFailures.slice(0, 5).map((f, i) => (
                  <li key={i}>
                    {fmtDateTime(f.when)} — {f.email} — {f.kind}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <AdminTable
            head={["When", "Who", "What", "Where", "Amount"]}
            rows={revenue.ledger.map((l) => [
              fmtDateTime(l.when),
              l.email,
              l.refunded ? `${l.item} (refunded)` : l.item,
              l.platform,
              formatUsd(l.amountCents),
            ])}
            dimRow={(i) => revenue.ledger[i].refunded}
            empty="No payments yet — the first one shows up here."
          />
        </Section>

        {/* ── 2 · USERS ───────────────────────────────── */}
        <Section
          title="Users"
          summary={`${users.total} total · ${users.newThisWeek} new this week`}
        >
          <AdminTable
            head={["Email", "Joined", "Plan", "Last seen"]}
            rows={users.rows.map((u) => [
              <Link
                key={u.id}
                href={`/admin/users/${u.id}`}
                className="font-medium text-warm-100 underline-offset-4 hover:underline"
              >
                {u.email}
              </Link>,
              fmtDate(u.joined),
              u.plan,
              fmtDate(u.lastSeen),
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
            reports.needingEyes === 0
              ? "queue empty"
              : `${reports.needingEyes} need eyes`
          }
          alert={
            reports.crisis.length > 0
              ? `${reports.crisis.length} crisis flag(s)`
              : reports.needingEyes > 0
                ? `${reports.needingEyes} pending`
                : null
          }
        >
          {reports.crisis.length > 0 && (
            <div className="mb-4 rounded-xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm text-coral-strong">
              <p className="font-semibold">
                Crisis flags — these are people. Same-day, always.
              </p>
              <ul className="mt-2 space-y-1">
                {reports.crisis.map((c) => (
                  <li key={c.id}>
                    {fmtDateTime(c.when)} —{" "}
                    <Link
                      href={`/admin/users/${c.userId}`}
                      className="underline underline-offset-4"
                    >
                      {c.email}
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
            rows={reports.messages.map((r) => [
              fmtDateTime(r.when),
              r.reporter,
              r.reason,
              r.status,
            ])}
            dimRow={(i) => reports.messages[i].status !== "pending"}
            empty="No message reports."
          />

          <h3 className="mt-6 text-sm font-semibold text-warm-200">
            Identity reports
          </h3>
          <AdminTable
            head={["When", "Reporter", "Reason", "Status"]}
            rows={reports.identities.map((r) => [
              fmtDateTime(r.when),
              r.reporter,
              r.reason,
              r.status,
            ])}
            dimRow={(i) => reports.identities[i].status !== "pending"}
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
