import Link from "next/link";
import Image from "next/image";
import { createAdminClient, formatUsd } from "@/lib/admin/queries";
import {
  fetchMonthBreakdown,
  normalizeMonthParam,
  prevMonth,
  type MonthBreakdown,
} from "@/lib/admin/monthBreakdown";
import { fetchMarketingReports, type MarketingReport } from "@/lib/admin/marketingReports";
import { TAX_GOVERNMENT_LABEL } from "@/lib/admin/taxPayments";
import { PrintButton } from "./PrintButton";
import { MonthPicker } from "./MonthPicker";

export const metadata = {
  title: "Settlement Statement · chapter3five",
};

/**
 * /admin/revenue/statement — THE ACCOUNTANT'S DOCUMENT (Wilson
 * 2026-08-26: "Chapter3FIVE on the top left with our logo… show all
 * the months and we can check off which ones we want and together
 * will put all the pages together — press year and boom"). Check any
 * set of months (a year chip selects the whole year); every checked
 * month renders as its own letterhead page, and Print / Save as PDF
 * binds them into ONE document. Replaces the Months CSV as the thing
 * you physically hand to an accountant. Reads the ONE formula
 * (fetchMonthBreakdown), so it can never disagree with the revenue
 * card or the ledger.
 */
const LAUNCH_MONTH = "2026-08";

export default async function SettlementStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string; month?: string }>;
}) {
  const supabase = createAdminClient();
  const { months: monthsParam, month: legacyParam } = await searchParams;
  const currentMonth = normalizeMonthParam(null);

  // Every month from launch to the current settlement month.
  const available: string[] = [];
  let m = currentMonth;
  while (m >= LAUNCH_MONTH && available.length < 120) {
    available.push(m);
    m = prevMonth(m);
  }
  available.reverse();

  const requested = (monthsParam ?? legacyParam ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => available.includes(s));
  const selected = [...new Set(requested.length > 0 ? requested : [currentMonth])].sort();

  const breakdowns: MonthBreakdown[] = [];
  for (const month of selected) {
    breakdowns.push(await fetchMonthBreakdown(supabase, month));
  }
  // What Navy Federal showed in the Marketing account on the 1st, per
  // month — printed beside the formula's figure in section 6.
  const reports = await fetchMarketingReports(supabase);

  return (
    <div className="mx-auto max-w-[860px]">
      {/* On paper: admin chrome + picker disappear, each month fills
          its own page. */}
      <style>{`@media print {
        aside, nav { display: none !important; }
        main { padding: 0 !important; }
        body { background: #ffffff !important; }
        .statement-sheet { break-after: page; }
        .statement-sheet:last-child { break-after: auto; }
      }`}</style>

      {/* Screen-only toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/admin/revenue"
          className="text-sm font-medium text-warm-300 transition-colors hover:text-warm-100"
        >
          ← Back to revenue
        </Link>
        <PrintButton />
      </div>

      <div className="mb-6 print:hidden">
        <MonthPicker available={available} selected={selected} />
      </div>

      <div className="flex flex-col gap-8">
        {breakdowns.map((b) => (
          <StatementSheet
            key={b.month}
            b={b}
            report={reports.get(b.month) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function StatementSheet({
  b,
  report,
}: {
  b: MonthBreakdown;
  report: MarketingReport | null;
}) {
  const window = b.periodLabel.split(" · ")[0].replace("counting ", "");
  // FINAL means one thing: the month is in the ledger. A past month
  // that somehow isn't frozen must not be dressed up as final.
  const frozen = b.frozen;
  const decemberPartners = b.partners.filter((p) => p.payout === "december");
  const potsAfter = decemberPartners.reduce((a, p) => a + (p.undrawnBalanceCents ?? 0), 0);

  return (
    <div className="statement-sheet rounded-2xl bg-white px-8 py-9 text-neutral-900 shadow-xl ring-1 ring-neutral-200 print:rounded-none print:px-2 print:py-0 print:shadow-none print:ring-0">
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
          <p className="mt-0.5 text-xs text-neutral-500">Counting {window}</p>
          <p
            className={`mt-2 inline-block rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
              frozen
                ? "bg-neutral-900 text-white"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {frozen
              ? `Final — ledger ${b.settledAt?.slice(0, 10) ?? "entry"}`
              : "In progress — final on the 27th"}
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

      {/* The month in one paragraph — same words as the card and the sheet */}
      <div className="mt-5 rounded-md border border-neutral-300 bg-neutral-50 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">Summary</p>
        <p className="mt-1 text-sm leading-relaxed text-neutral-900">{b.summary}</p>
      </div>

      {/* 1 · Revenue */}
      <StatementSection title="1 · Revenue">
        <Row label="Web sales (site, via Stripe)" cents={b.grossWebCents} />
        <Row label="App store sales (Apple + Google)" cents={b.grossStoreCents} />
        <Row label="Total sales" cents={b.grossCents} strong />
        <Row
          label={`Less: store commission (${b.storeCommissionActual ? "per RevenueCat" : "est."})`}
          cents={-b.storeCommissionCents}
          muted
        />
        <Row
          label={`Less: card processing (Stripe 2.9% + 30¢ × ${b.webChargeCount ?? 0} charges)`}
          cents={-b.webProcessingCents}
          muted
        />
        <Row label="Net receipts (reaches the bank)" cents={b.netReceiptsCents} strong rule />
      </StatementSection>

      {/* 2 · Operating expenses */}
      <StatementSection title="2 · Operating expenses">
        {b.expenses.map((e) => (
          <Row key={e.name} label={e.name} cents={-e.cents} muted />
        ))}
        <Row label="Total operating expenses" cents={-b.totalExpensesCents} strong rule />
      </StatementSection>

      {/* Profit band */}
      <div className="mt-6 flex items-center justify-between rounded-xl bg-neutral-900 px-5 py-3.5 text-white print:rounded-none">
        <p className="text-sm font-bold uppercase tracking-wide">Net profit</p>
        <p className="text-lg font-bold tabular-nums">{formatUsd(b.profitCents)}</p>
      </div>

      {/* 3 · Member contributions — capital, outside profit */}
      {(b.contributionsCents ?? 0) > 0 ||
      (b.lockedSavingsDepositCents ?? 0) > 0 ||
      (b.shortfallCoveredCents ?? 0) > 0 ||
      b.partners.some((p) => (p.capitalCents ?? 0) > 0) ? (
        <StatementSection title="3 · Member capital contributions (not income)">
          {b.partners.map((p) => (
            <Row
              key={p.name}
              label={`Contributed by ${p.name} on the 1st — capital; cumulative ${formatUsd(p.capitalCents ?? 0)} (owed back to the member; a return of capital is not income)`}
              cents={p.contributionCents ?? 0}
            />
          ))}
          {b.partners
            .filter((p) => (p.savingsDepositCents ?? 0) > 0)
            .map((p) => (
              <Row
                key={`${p.name}-savings`}
                label={`Savings-account minimum put in by ${p.name} — capital; stays in savings`}
                cents={p.savingsDepositCents ?? 0}
              />
            ))}
          {b.partners
            .filter((p) => (p.shortfallCoveredCents ?? 0) > 0)
            .map((p) => (
              <Row
                key={`${p.name}-shortfall`}
                label={`Loss beyond the reserve paid out of pocket by ${p.name} — capital; owed back`}
                cents={p.shortfallCoveredCents ?? 0}
              />
            ))}
          <Row
            label="Total capital put in this month"
            cents={
              (b.contributionsCents ?? 0) +
              (b.lockedSavingsDepositCents ?? 0) +
              (b.shortfallCoveredCents ?? 0)
            }
            strong
            rule
          />
        </StatementSection>
      ) : null}

      {/* 4 · Taxes held — itemized per government */}
      <StatementSection title="4 · Tax envelopes held by the business (paid in each member's own name — Danisel four times a year, Pedro once in December)">
        {b.partners.map((p) => {
          const t = p.taxParts;
          return (
            <div key={p.name} className="flex flex-col">
              <Row
                label={`${p.name} — ${p.taxRatePct}% of their ${formatUsd(p.profitShareCents)} half (${p.residence})`}
                cents={p.taxEnvelopeCents}
                strong
              />
              {t ? (
                <>
                  <Row label="   Self-employment tax (IRS)" cents={t.seCents} muted />
                  <Row label="   Federal income tax (IRS)" cents={t.federalCents} muted />
                  {t.cityCents > 0 ? (
                    <>
                      <Row
                        label={`   New York State income tax (of which ${formatUsd(t.paNonresidentCents)} is paid to PA first as nonresident tax and credited by NY, Form IT-112-R)`}
                        cents={t.stateCents}
                        muted
                      />
                      <Row label="   New York City income tax (no credit)" cents={t.cityCents} muted />
                    </>
                  ) : (
                    <>
                      <Row label="   Pennsylvania income tax (3.07%)" cents={t.stateCents} muted />
                      <Row label="   Bethlehem earned-income tax (1%)" cents={t.localCents} muted />
                    </>
                  )}
                </>
              ) : null}
              <Row label={`   Held for ${p.name} coming into this month`} cents={p.taxHeldBeforeCents ?? 0} muted />
              {(p.taxPayments ?? []).map((t, i) => (
                <Row
                  key={`${t.paidOn}-${i}`}
                  label={`   Sent ${t.paidOn} — ${TAX_GOVERNMENT_LABEL[t.government] ?? t.government}${t.note ? ` (${t.note})` : ""}`}
                  cents={-t.amountCents}
                  muted
                />
              ))}
              <Row
                label={`   Held for ${p.name} after this month${(p.taxOverpaidCents ?? 0) > 0 ? ` — ${formatUsd(p.taxOverpaidCents)} more was sent than was held; the business advanced it` : ""}`}
                cents={p.taxHeldCents ?? p.taxEnvelopeCents}
                muted
              />
              {p.taxDueNote ? (
                <p className="pl-3 text-xs leading-relaxed text-warm-400">{p.taxDueNote}</p>
              ) : null}
            </div>
          );
        })}
        <Row label="Total tax envelopes this month" cents={b.taxReserveCents} strong rule />
        {(b.taxPaidTotalCents ?? 0) > 0 ? (
          <Row label="Total tax payments sent this month (both names)" cents={b.taxPaidTotalCents ?? 0} muted />
        ) : null}
        <Row label="Total held for taxes after this month (both)" cents={b.taxHeldTotalCents ?? 0} />
      </StatementSection>

      {/* 5 · The operating reserve — a balance, not a monthly charge */}
      <StatementSection title="5 · Operating reserve (a target balance the account keeps)">
        <Row label="Carried in from last month" cents={b.reserveCarriedCents ?? 0} muted />
        {(b.contributionsCents ?? 0) > 0 ? (
          <Row label="Plus member contributions (section 3)" cents={b.contributionsCents ?? 0} muted />
        ) : null}
        {(b.reserveTopUpCents ?? 0) > 0 ? (
          <Row label="Plus top-up from this month's profit" cents={b.reserveTopUpCents ?? 0} muted />
        ) : null}
        {(b.reserveDrawCents ?? 0) > 0 ? (
          <Row label="Less: drawn to cover this month's loss" cents={-(b.reserveDrawCents ?? 0)} muted />
        ) : null}
        <Row
          label={`Reserve after settlement — target ${formatUsd(b.reserveTargetCents ?? 0)} (next month's bills ${formatUsd(b.billsCents)} = fixed subscriptions + this month's usage costs, + cushion ${formatUsd(b.cushionCents)}, the larger of 50% of bills / 10% of profit — room for usage to grow)`}
          cents={b.reserveAfterCents ?? 0}
          strong
          rule
        />
        {(b.shortfallCents ?? 0) > 0 ? (
          <Row
            label={
              b.shortfallPaidBy
                ? `Shortfall the reserve could not cover — paid out of pocket by ${b.shortfallPaidBy} (booked as capital, section 3)`
                : "Shortfall the reserve could not cover — paid out of pocket, not yet booked to a member"
            }
            cents={b.shortfallCents ?? 0}
            strong
          />
        ) : null}
      </StatementSection>

      {/* 6 · Marketing account (Navy Federal) */}
      <StatementSection title="6 · Marketing account at Navy Federal (the 27th → 1st money — never distributed)">
        <Row label="Earned from the 27th → the 1st (net of platform fees)" cents={b.retainedTailCents} muted />
        <Row
          label="Transferred to the Marketing account on the 27th (after taxes and the reserve)"
          cents={b.growthTransferCents ?? 0}
          strong
        />
        <Row
          label="Marketing account balance per the formula, after this month's transfer (since launch)"
          cents={b.growthBalanceCents ?? 0}
          strong
          rule
        />
        <Row
          label={
            report
              ? `Marketing account balance per Navy Federal, reported ${report.reportedOn}${
                  report.balanceCents === (b.growthBalanceCents ?? 0)
                    ? " — matches the formula"
                    : ` — ${formatUsd(Math.abs(report.balanceCents - (b.growthBalanceCents ?? 0)))} ${report.balanceCents > (b.growthBalanceCents ?? 0) ? "above" : "below"} the formula`
                }`
              : "Marketing account balance per Navy Federal — not yet reported for this month"
          }
          cents={report ? report.balanceCents : null}
          muted={!report}
        />
      </StatementSection>

      {/* 7 · Member entitlements */}
      <StatementSection title="7 · Member entitlements (settled the 27th)">
        {b.partners.map((p) =>
          p.payout === "december" ? (
            <Row
              key={p.name}
              label={`Accrued to ${p.name} — held for their once-a-year December draw (member election); pot now ${formatUsd(p.undrawnBalanceCents)}${(p.drawCents ?? 0) > 0 ? ` — DECEMBER DRAW PAID ${formatUsd(p.drawCents)}` : ""}`}
              cents={p.transferCents}
            />
          ) : (
            <Row
              key={p.name}
              label={`Transferred to ${p.name} — their half after their own tax envelope and half the common holds, fully spendable`}
              cents={p.transferCents}
            />
          ),
        )}
        <Row
          label="Paid out of the account on transfer day (member draws + marketing transfer)"
          cents={b.paidOutCents ?? 0}
          strong
          rule
        />
        {potsAfter > 0
          ? decemberPartners.map((p) => (
              <Row
                key={`${p.name}-pot`}
                label={`Remains in the account for ${p.name}'s December draw (cumulative)`}
                cents={p.undrawnBalanceCents}
                strong
              />
            ))
          : null}
        {(b.taxPaidTotalCents ?? 0) > 0 ? (
          <Row
            label="Tax payments sent this month in their names (already left, on the days they were sent)"
            cents={b.taxPaidTotalCents ?? 0}
            muted
          />
        ) : null}
        <Row
          label="The operating account should hold after transfer day (reserve + taxes still held after payments sent + December pots)"
          cents={b.accountShouldHoldCents ?? 0}
          strong
        />
        {(b.lockedSavingsCents ?? 0) > 0 ? (
          <Row
            label="The savings account holds (bank minimum, a member's capital — never reserve, never marketing, never spent)"
            cents={b.lockedSavingsCents ?? 0}
            strong
          />
        ) : null}
      </StatementSection>

      {b.contributionsVerdict ? (
        <p className="mt-4 text-xs font-semibold text-neutral-700">
          Member contributions: {b.contributionsVerdict}
        </p>
      ) : null}

      {/* Tax basis note — the K-1 anchor */}
      <div className="mt-6 rounded-xl bg-neutral-50 px-5 py-4 ring-1 ring-neutral-200 print:rounded-none">
        <p className="text-xs leading-relaxed text-neutral-600">
          <span className="font-bold text-neutral-900">Tax basis:</span> each
          member&apos;s distributive share of profit this month is{" "}
          <span className="font-bold tabular-nums text-neutral-900">
            {formatUsd(b.profitShareCents)}
          </span>{" "}
          (50% of net profit) — taxable to each member individually when
          earned, regardless of what was distributed or deferred. Envelopes
          are sized for where each member lives: {b.partners[0].name} (
          {b.partners[0].residence}) at {b.partners[0].taxRatePct}%,{" "}
          {b.partners[1].name} ({b.partners[1].residence}) at{" "}
          {b.partners[1].taxRatePct}%. For the New York member, PA taxes the
          share first and New York credits every PA dollar (Form IT-112-R) —
          taxed once, never twice; NYC&apos;s city tax stacks with no credit.
          Each envelope is paid in that member&apos;s own name on their own
          schedule — Danisel four times a year (IRS + PA Apr 15 / Jun 15 /
          Sep 15 / Jan 15; Bethlehem through Keystone Collections Apr 15 /
          Jul 15 / Oct 15 / Jan 15), Pedro once in December, his election.
          Danisel files married-filing-separately and Pedro single; the
          federal brackets and the Additional Medicare threshold follow.
          Payments sent are recorded and drain the held amount in the month
          they went out. Member transfers are not taxable events.
          {b.refundedCents > 0
            ? ` Refunds this period (informational): ${formatUsd(b.refundedCents)}.`
            : ""}
        </p>
      </div>

      {/* Footer */}
      <footer className="mt-6 flex items-end justify-between gap-4 border-t border-neutral-300 pt-4">
        <p className="text-[10px] leading-relaxed text-neutral-400">
          Prepared automatically from the settlement ledger — the same
          formula behind the admin revenue card and the in-app ledger. Frozen
          months are written on the 27th and never change. Store commission
          (when RevenueCat didn&apos;t report it), Replicate, and the tax
          engine are estimates. Not tax advice.
        </p>
        <p className="shrink-0 text-[10px] font-semibold text-neutral-500">
          chapter3five · admin
        </p>
      </footer>
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
  /** null = no figure exists yet (prints "—", never a misleading $0.00). */
  cents: number | null;
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
        {cents === null ? "—" : formatUsd(cents)}
      </p>
    </div>
  );
}
