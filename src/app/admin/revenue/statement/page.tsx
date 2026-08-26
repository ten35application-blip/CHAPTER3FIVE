import Link from "next/link";
import Image from "next/image";
import { createAdminClient, formatUsd } from "@/lib/admin/queries";
import {
  fetchMonthBreakdown,
  nextMonth,
  normalizeMonthParam,
  prevMonth,
} from "@/lib/admin/monthBreakdown";
import { PrintButton } from "./PrintButton";

export const metadata = {
  title: "Settlement Statement · chapter3five",
};

/**
 * /admin/revenue/statement — THE ACCOUNTANT'S PAGE (Wilson
 * 2026-08-26: "this form we should hand to accountants — Chapter3FIVE
 * on the top left with our logo, show our expenses, the 50/50 split,
 * how much is held in and how much was pulled out on the 27th").
 *
 * A one-page, print-ready settlement statement per month: white paper
 * regardless of app theme, logo + legal name top-left, revenue → fees
 * → itemized expenses → profit → every held dollar named → each
 * partner's 27th transfer. Reads the ONE formula
 * (fetchMonthBreakdown), so it can never disagree with the revenue
 * card or the CSV ledger. Print → Save as PDF is the export.
 */
export default async function SettlementStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = createAdminClient();
  const { month: monthParam } = await searchParams;
  const month = normalizeMonthParam(monthParam ?? null);
  const currentMonth = normalizeMonthParam(null);
  const b = await fetchMonthBreakdown(supabase, month);

  const isFinal = b.month < currentMonth;
  const window = b.periodLabel.split(" · ")[0].replace("counting ", "");
  const tailHeld = Math.min(b.retainedTailCents, Math.max(0, b.profitCents));
  const transferredTotal = b.partners.reduce((a, p) => a + p.transferCents, 0);

  return (
    <div className="mx-auto max-w-[860px]">
      {/* On paper: admin chrome disappears, the statement fills the page. */}
      <style>{`@media print {
        aside, nav { display: none !important; }
        main { padding: 0 !important; }
        body { background: #ffffff !important; }
      }`}</style>

      {/* Screen-only toolbar */}
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/revenue"
          className="text-sm font-medium text-warm-300 transition-colors hover:text-warm-100"
        >
          ← Back to revenue
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/revenue/statement?month=${prevMonth(b.month)}`}
            aria-label="Previous month"
            className="rounded-full bg-ink-soft px-4 py-2 text-sm font-semibold text-warm-100 ring-1 ring-warm-700 transition-colors hover:bg-ink"
          >
            ‹
          </Link>
          {b.month < currentMonth ? (
            <Link
              href={`/admin/revenue/statement?month=${nextMonth(b.month)}`}
              aria-label="Next month"
              className="rounded-full bg-ink-soft px-4 py-2 text-sm font-semibold text-warm-100 ring-1 ring-warm-700 transition-colors hover:bg-ink"
            >
              ›
            </Link>
          ) : null}
          <PrintButton />
        </div>
      </div>

      {/* THE PAPER — explicit white/near-black so it reads identically
          on screen (any theme) and on paper. */}
      <div className="rounded-2xl bg-white px-8 py-9 text-neutral-900 shadow-xl ring-1 ring-neutral-200 print:rounded-none print:px-2 print:py-0 print:shadow-none print:ring-0">
        {/* Letterhead */}
        <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-6">
          <div className="flex items-center gap-4">
            <Image
              src="/logo-transparent.png"
              alt="chapter3five logo"
              width={56}
              height={56}
              className="h-14 w-14"
            />
            <div>
              <p className="text-2xl font-bold tracking-tight text-neutral-900">
                chapter<span className="text-coral-strong">3</span>
                <span className="text-teal-strong">five</span>
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                Chapter3FIVE LLC · Bethlehem, Pennsylvania
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-neutral-500">
              Monthly Settlement Statement
            </p>
            <p className="mt-1 text-xl font-bold text-neutral-900">
              {b.monthLabel}
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Counting {window}
            </p>
            <p
              className={`mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
                isFinal
                  ? "bg-neutral-900 text-white"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isFinal ? "Final — settled on the 27th" : "In progress — final on the 27th"}
            </p>
          </div>
        </header>

        {/* Ownership line — the fact the accountant checks first */}
        <p className="mt-4 text-sm text-neutral-600">
          Members:{" "}
          <span className="font-semibold text-neutral-900">
            {b.partners[0].name} (50%, {b.partners[0].residence})
          </span>{" "}
          and{" "}
          <span className="font-semibold text-neutral-900">
            {b.partners[1].name} (50%, {b.partners[1].residence})
          </span>{" "}
          — equal partners; each files individually and is taxed only on their
          own half of profit, under their own state&apos;s rules.
        </p>

        {/* 1 · Revenue */}
        <StatementSection title="1 · Revenue">
          <Row label="Web sales (site, via Stripe)" cents={b.grossWebCents} />
          <Row label="App store sales (Apple + Google)" cents={b.grossStoreCents} />
          <Row label="Total sales" cents={b.grossCents} strong />
          <Row label="Less: store commission (est.)" cents={-b.storeCommissionCents} muted />
          <Row label="Less: card processing (est.)" cents={-b.webProcessingCents} muted />
          <Row label="Net receipts (reaches the bank)" cents={b.netReceiptsCents} strong rule />
        </StatementSection>

        {/* 2 · Operating expenses */}
        <StatementSection title="2 · Operating expenses">
          {b.expenses.map((e) => (
            <Row
              key={e.name}
              label={e.estimated ? `${e.name}` : e.name}
              cents={-e.cents}
              muted
            />
          ))}
          <Row label="Total operating expenses" cents={-b.totalExpensesCents} strong rule />
        </StatementSection>

        {/* Profit band */}
        <div className="mt-6 flex items-center justify-between rounded-xl bg-neutral-900 px-5 py-3.5 text-white print:rounded-none">
          <p className="text-sm font-bold uppercase tracking-wide">Net profit</p>
          <p className="text-lg font-bold tabular-nums">{formatUsd(b.profitCents)}</p>
        </div>

        {/* 3 · Held in the business account */}
        <StatementSection title="3 · Held in the business account">
          <Row label="Next month's operating bills" cents={b.billsCents} />
          <Row label="Growth cushion (larger of 50% of bills / 10% of profit)" cents={b.cushionCents} />
          <Row label="Compounding reserve (earned the 27th → 1st — never distributed)" cents={tailHeld} />
          {b.partners.map((p) => (
            <Row
              key={p.name}
              label={`${p.name}'s tax envelope (${p.taxRatePct}% of their half — ${p.residence}; paid quarterly in ${p.name}'s name)`}
              cents={p.taxEnvelopeCents}
            />
          ))}
          <Row label="Total kept in the account" cents={b.keepInAccountCents} strong rule />
        </StatementSection>

        {/* 4 · Distributions */}
        <StatementSection title="4 · Distributions to members (the 27th)">
          {b.partners.map((p) => (
            <Row
              key={p.name}
              label={`Transferred to ${p.name} — their half after their own tax envelope, fully spendable`}
              cents={p.transferCents}
            />
          ))}
          <Row label="Total distributed" cents={transferredTotal} strong rule />
        </StatementSection>

        {/* Tax basis note — the K-1 anchor */}
        <div className="mt-6 rounded-xl bg-neutral-50 px-5 py-4 ring-1 ring-neutral-200 print:rounded-none">
          <p className="text-xs leading-relaxed text-neutral-600">
            <span className="font-bold text-neutral-900">Tax basis:</span> each
            member's distributive share of profit this month is{" "}
            <span className="font-bold tabular-nums text-neutral-900">
              {formatUsd(b.profitShareCents)}
            </span>{" "}
            (50% of net profit) — taxable to each member individually when
            earned, regardless of what was distributed. Envelopes are sized
            for where each member lives: {b.partners[0].name} (
            {b.partners[0].residence}) at {b.partners[0].taxRatePct}%,{" "}
            {b.partners[1].name} ({b.partners[1].residence}) at{" "}
            {b.partners[1].taxRatePct}%. For the New York member, PA taxes
            the share first and New York credits every PA dollar (Form
            IT-112-R) — taxed once, never twice; NYC&apos;s city tax stacks
            with no credit. Tax money is held by the business and paid at
            quarterly estimated-tax dates in each member&apos;s own name;
            member transfers are not taxable events.
            {b.refundedCents > 0
              ? ` Refunds this period (informational): ${formatUsd(b.refundedCents)}.`
              : ""}
          </p>
        </div>

        {/* Footer */}
        <footer className="mt-6 flex items-end justify-between gap-4 border-t border-neutral-300 pt-4">
          <p className="text-[10px] leading-relaxed text-neutral-400">
            Prepared automatically from the live settlement ledger — the same
            formula behind the admin revenue card and the CSV export. Store
            commission, card fees, and Replicate are estimates until real
            statements land. Not tax advice.
          </p>
          <p className="shrink-0 text-[10px] font-semibold text-neutral-500">
            chapter3five · admin
          </p>
        </footer>
      </div>
    </div>
  );
}

function StatementSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="border-b border-neutral-300 pb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
        {title}
      </h2>
      <div className="mt-2 flex flex-col">{children}</div>
    </section>
  );
}

function Row({
  label,
  cents,
  strong,
  muted,
  rule,
}: {
  label: string;
  cents: number;
  strong?: boolean;
  muted?: boolean;
  rule?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1 ${
        rule ? "mt-1 border-t border-neutral-300 pt-1.5" : ""
      }`}
    >
      <p
        className={`text-sm ${
          strong
            ? "font-bold text-neutral-900"
            : muted
              ? "text-neutral-500"
              : "text-neutral-700"
        }`}
      >
        {label}
      </p>
      <p
        className={`text-sm tabular-nums ${
          strong ? "font-bold text-neutral-900" : "text-neutral-700"
        }`}
      >
        {formatUsd(cents)}
      </p>
    </div>
  );
}
