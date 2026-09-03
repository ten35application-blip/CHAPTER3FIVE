import Link from "next/link";
import type { ReactNode } from "react";
import {
  createAdminClient,
  daysAgo,
  fetchPaidPayments,
  formatUsd,
  paymentDate,
  startOfMonth,
  sumCents,
} from "@/lib/admin/queries";
import {
  LAUNCH_MONTH,
  fetchExampleBreakdown,
  fetchMonthBreakdown,
  nextMonth,
  normalizeMonthParam,
  prevMonth,
  settlementWindow,
  type MonthBreakdown,
} from "@/lib/admin/monthBreakdown";
import { fetchMarketingReport, type MarketingReport } from "@/lib/admin/marketingReports";
import {
  TAX_GOVERNMENTS,
  TAX_GOVERNMENT_LABEL,
  fetchTaxPayments,
  todayInNewYork,
  type TaxPayment,
} from "@/lib/admin/taxPayments";
import { ExportCsvButton } from "./ExportCsvButton";
import {
  deleteTaxPaymentAction,
  recordTaxPaymentAction,
  saveMarketingReportAction,
} from "./actions";

/** The one input look, shared by every field on the card's forms. */
const fieldClass =
  "rounded-xl bg-ink px-3 py-1.5 text-sm font-semibold tabular-nums text-warm-50 ring-1 ring-warm-700 focus:outline-none focus:ring-2 focus:ring-teal";

/**
 * /admin/revenue — money reports: the month breakdown FIRST (what
 * stays for taxes and bills, what Danisel and Pedro each transfer —
 * Wilson's launch-morning ask, 2026-08-26), then the Stripe payment
 * detail below. Stripe + both app stores have been wired since
 * 2026-08-21; the old "once Stripe is wired" copy here outlived the
 * wiring by five days.
 */
export default async function AdminRevenuePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = createAdminClient();
  const { month: monthParam } = await searchParams;
  const month = normalizeMonthParam(monthParam ?? null);
  // The Marketing account (Navy Federal) as Wilson read it off the bank
  // on the 1st — this month's report, plus last month's so the live
  // card can nudge when the 1st came and went without one.
  const [payments, breakdown, report, prevReport, taxPayments] = await Promise.all([
    fetchPaidPayments(supabase),
    fetchMonthBreakdown(supabase, month),
    fetchMarketingReport(supabase, month),
    fetchMarketingReport(supabase, prevMonth(month)),
    fetchTaxPayments(supabase, { limit: 50 }),
  ]);
  const example =
    breakdown.grossCents === 0 ? await fetchExampleBreakdown(supabase) : null;

  if (payments.length === 0) {
    return (
      <div className="flex max-w-3xl flex-col gap-8">
        <div className="flex justify-end gap-2">
          <Link
            href="/admin/revenue/statement"
            className="rounded-full bg-teal/10 px-4 py-2 text-sm font-semibold text-teal-strong ring-1 ring-teal/25 transition-colors hover:bg-teal/15"
          >
            Statement
          </Link>
        </div>
        <div className="rounded-2xl bg-ink-soft px-6 py-8 text-center ring-1 ring-warm-700">
          <p className="text-xl font-semibold tracking-tight text-warm-50">
            No payments yet
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-warm-300">
            Stripe and both app stores are wired and listening — the first
            real sale fills in the breakdown below, using exactly the
            formula shown in the example.
          </p>
        </div>
        {example ? (
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold uppercase tracking-wider text-teal-strong [&::-webkit-details-marker]:hidden">
            <span className="inline-block text-2xl leading-none transition-transform group-open:rotate-90">›</span>
            Example — how a month reads
            <span className="rounded-full bg-coral/15 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-coral-strong ring-1 ring-coral/30">
              EXAMPLE
            </span>
          </summary>
          <div className="mt-3">
            <MonthBreakdownCard b={example} example />
          </div>
        </details>
        ) : null}
        <MonthBreakdownCard b={breakdown} report={report} prevReport={prevReport} taxPayments={taxPayments} />
      </div>
    );
  }

  const allTime = sumCents(payments);

  // ---- Last-30-days daily buckets (pure CSS bar chart — no library). ----
  // Bucket by SERVER-LOCAL calendar day (not toISOString/UTC) so a
  // late-evening payment doesn't slide into tomorrow's bar.
  const localDayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const days: { key: string; label: string; cents: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    days.push({
      key: localDayKey(d),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      cents: 0,
    });
  }
  const byKey = new Map(days.map((d) => [d.key, d]));
  const windowStart = daysAgo(29);
  for (const p of payments) {
    if (p.status !== "paid") continue;
    const date = paymentDate(p);
    if (date < windowStart) continue;
    const bucket = byKey.get(localDayKey(date));
    if (bucket) bucket.cents += p.amount_cents;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.cents));

  // ---- Breakdown: subscriptions vs one-time vs refunds. ----
  const subscriptionCents = payments
    .filter((p) => p.status === "paid" && p.purpose === "subscription")
    .reduce((a, p) => a + p.amount_cents, 0);
  const oneTimeCents = payments
    .filter((p) => p.status === "paid" && p.purpose !== "subscription")
    .reduce((a, p) => a + p.amount_cents, 0);
  const refundedCents = payments
    .filter((p) => p.status === "refunded")
    .reduce((a, p) => a + p.amount_cents, 0);

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-warm-50">
            Revenue
          </h1>
          <p className="text-sm text-warm-300">
            All-time web {formatUsd(allTime)} · Stripe + both app stores
            feed the month breakdown below
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/revenue/statement?months=${month}`}
            className="rounded-full bg-teal/10 px-4 py-2 text-sm font-semibold text-teal-strong ring-1 ring-teal/25 transition-colors hover:bg-teal/15"
          >
            Statement
          </Link>
          <ExportCsvButton />
        </div>
      </header>

      {example ? (
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold uppercase tracking-wider text-teal-strong [&::-webkit-details-marker]:hidden">
            <span className="inline-block text-2xl leading-none transition-transform group-open:rotate-90">›</span>
            Example — how a month reads
            <span className="rounded-full bg-coral/15 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-coral-strong ring-1 ring-coral/30">
              EXAMPLE
            </span>
          </summary>
          <div className="mt-3">
            <MonthBreakdownCard b={example} example />
          </div>
        </details>
      ) : null}
      <MonthBreakdownCard b={breakdown} report={report} prevReport={prevReport} taxPayments={taxPayments} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-300">
          Last 30 days — what the app made each day
        </h2>
        <div className="rounded-2xl bg-ink-soft px-5 pb-3 pt-6 ring-1 ring-warm-700">
          <div className="flex h-40 items-end gap-[3px]">
            {days.map((d) => (
              <div
                key={d.key}
                className="group relative flex-1"
                title={`${d.label}: ${formatUsd(d.cents)}`}
              >
                <div
                  className={
                    d.cents > 0
                      ? "bg-gradient-cta w-full rounded-t-sm"
                      : "w-full rounded-t-sm bg-warm-700/60"
                  }
                  style={{
                    height: `${d.cents > 0 ? Math.max(6, (d.cents / maxDay) * 100) : 2}%`,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-warm-400">
            <span>{days[0].label}</span>
            <span>{days[days.length - 1].label}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-300">
          Breakdown
        </h2>
        <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
          <BreakdownRow label="Subscriptions" value={formatUsd(subscriptionCents)} />
          <BreakdownRow label="One-time (extras)" value={formatUsd(oneTimeCents)} />
          <BreakdownRow label="Refunds" value={`−${formatUsd(refundedCents)}`} muted />
          <BreakdownRow
            label="Net all-time"
            value={formatUsd(subscriptionCents + oneTimeCents)}
            strong
          />
        </div>
      </section>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  muted = false,
  strong = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-warm-700/60 px-5 py-3.5 text-sm last:border-b-0 odd:bg-ink">
      <span className={strong ? "font-semibold text-warm-50" : "text-warm-300"}>
        {label}
      </span>
      <span
        className={
          muted
            ? "font-medium text-warm-400"
            : strong
              ? "font-semibold text-warm-50"
              : "font-medium text-warm-100"
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The month, settled — the answer the owners open this page for:
 * what stays in the account (taxes + bills) and what Danisel and
 * Pedro can each transfer out. Amounts from fetchMonthBreakdown;
 * store commission / Stripe fees / Replicate / the tax rate are
 * labeled estimates, and Anthropic is the real ledger number.
 */
function MonthBreakdownCard({
  b,
  example = false,
  report = null,
  prevReport = null,
  taxPayments = [],
}: {
  b: MonthBreakdown;
  example?: boolean;
  /** What Navy Federal showed in the Marketing account on the 1st after this month's transfer day. */
  report?: MarketingReport | null;
  /** Last month's report — the live card nudges when it's missing. */
  prevReport?: MarketingReport | null;
  /** Recent tax payments with ids — so a live one can be removed. */
  taxPayments?: TaxPayment[];
}) {
  // The 1st the report is read on: the month AFTER the settlement month.
  const reportDay = `${settlementWindow(nextMonth(b.month)).monthLabel.split(" ")[0]} 1`;
  const prevLabel = settlementWindow(prevMonth(b.month)).monthLabel;
  const reportDiff = report ? report.balanceCents - (b.growthBalanceCents ?? 0) : 0;
  const nudgePrev =
    !example && !b.frozen && !prevReport && prevMonth(b.month) >= LAUNCH_MONTH;
  return (
    <section className="flex flex-col gap-3">
      {example ? null : (
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-warm-300">
          The month, settled
          <span className="normal-case tracking-normal font-normal text-xs text-warm-400">
            · figures settle every 27th · new month shows on the 1st
          </span>
          {example ? (
            <span className="rounded-full bg-coral/15 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-coral-strong ring-1 ring-coral/30">
              EXAMPLE
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-3 text-sm">
          {example ? (
            <span className="font-semibold text-warm-50">{b.monthLabel}</span>
          ) : (
            <>
              <Link
                href={`/admin/revenue?month=${prevMonth(b.month)}`}
                aria-label="Previous month"
                className="flex h-11 w-11 items-center justify-center rounded-full text-4xl font-semibold leading-none text-coral-strong ring-1 ring-warm-700 hover:bg-ink-soft hover:text-coral"
              >
                ‹
              </Link>
              <span className="text-base font-semibold text-warm-50">{b.monthLabel}</span>
              <Link
                href={`/admin/revenue?month=${nextMonth(b.month)}`}
                aria-label="Next month"
                className="flex h-11 w-11 items-center justify-center rounded-full text-4xl font-semibold leading-none text-coral-strong ring-1 ring-warm-700 hover:bg-ink-soft hover:text-coral"
              >
                ›
              </Link>
            </>
          )}
        </div>
      </div>
      )}

      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
        <p className="bg-ink px-5 py-2 text-[11px] font-medium tracking-wide text-warm-400">
          {b.periodLabel}
          {" · "}
          {b.frozen ? (
            <span className="font-bold text-teal-strong">
              FINAL — in the ledger
              {b.settledAt ? ` ${b.settledAt.slice(0, 10)}` : ""}
            </span>
          ) : example ? (
            "goes final on the 27th"
          ) : (
            "still counting — final on the 27th"
          )}
          {b.settlementNote ? ` · ${b.settlementNote}` : ""}
        </p>
        {example ? (
          <p className="bg-ink px-5 pb-2.5 text-xs leading-relaxed text-warm-400">
            A made-up $1,000 month right after launch — $650 through the stores,
            $350 through the site, about 5 of 31 days after the 27th, the
            reserve empty and both $175s coming in — run through the real
            formula with your real rates and bills.
          </p>
        ) : null}

        {/* THE MONTH IN ONE BREATH (Wilson 2026-09-03: "a quick paragraph
            summary … so we don't have to look at all the numbers").
            Written by the formula, same words on mobile and the sheet. */}
        <div className="flex flex-col gap-3 border-t border-warm-700/60 px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-warm-400">
            Summary
          </p>
          <p className="text-[15px] leading-relaxed text-warm-50">{b.summary}</p>
          <p
            className={`text-xs leading-relaxed ${b.selfSustaining ? "font-semibold text-teal-strong" : "text-warm-200"}`}
          >
            {b.selfSustaining ? "✅ " : "🤝 "}
            {b.contributionsVerdict}
          </p>
        </div>
        <div className="flex flex-col gap-1.5 border-t border-warm-700/60 px-5 py-3">
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-warm-400">
            Coming up
          </p>
          {b.upcoming.map((line, i) => (
            <p key={i} className="text-xs leading-relaxed text-warm-200">
              {line}
            </p>
          ))}
        </div>

        <details className="group border-t border-warm-700/60 bg-ink">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-warm-400 [&::-webkit-details-marker]:hidden">
            <span className="inline-block text-base leading-none transition-transform group-open:rotate-90">
              ›
            </span>
            Show every number
          </summary>
          <div className="bg-ink-soft">
        <Section title="Money in">
          <BRow label="Customers paid" value={formatUsd(b.grossCents)} strong />
          <BRow
            label={`Apple/Google keep${b.storeCommissionActual ? " (actual)" : " (est.)"}`}
            value={`−${formatUsd(b.storeCommissionCents)}`}
          />
          <BRow
            label={`Stripe keeps (2.9% + 30¢ × ${b.webChargeCount ?? 0})`}
            value={`−${formatUsd(b.webProcessingCents)}`}
          />
          <BRow label="Reaches the bank" value={formatUsd(b.netReceiptsCents)} strong />
        </Section>

        <Section title="Bills">
          {b.expenses.map((e) => (
            <BRow key={e.name} label={e.name} value={`−${formatUsd(e.cents)}`} />
          ))}
          <BRow
            label="Profit"
            value={formatUsd(b.profitCents)}
            strong
            tint={b.profitCents >= 0 ? "text-teal-strong" : "text-coral-strong"}
          />
        </Section>

        {(b.contributionsCents ?? 0) > 0 ||
        (b.lockedSavingsDepositCents ?? 0) > 0 ||
        (b.shortfallCoveredCents ?? 0) > 0 ? (
          <Section
            title="Capital put in"
            note="Not income, not taxed, never split — the business owes it back."
          >
            {(b.contributionsCents ?? 0) > 0 ? (
              <BRow
                label={`Member contributions on the 1st (${formatUsd(b.contributionsPerMemberCents)} each)`}
                value={`+${formatUsd(b.contributionsCents)}`}
              />
            ) : null}
            {(b.lockedSavingsDepositCents ?? 0) > 0 ? (
              <BRow
                label={`Savings floor — ${b.partners
                  .filter((p) => (p.savingsDepositCents ?? 0) > 0)
                  .map((p) => `${p.name} ${formatUsd(p.savingsDepositCents ?? 0)}`)
                  .join(" + ")}`}
                value={`+${formatUsd(b.lockedSavingsDepositCents)}`}
              />
            ) : null}
            {(b.shortfallCoveredCents ?? 0) > 0 ? (
              <BRow
                label={`Loss covered out of pocket by ${b.shortfallPaidBy ?? "a member"}`}
                value={`+${formatUsd(b.shortfallCoveredCents)}`}
              />
            ) : null}
          </Section>
        ) : null}

        {b.profitCents > 0 ? (
          <Section title="The split — on the 27th">
            {b.partners.map((p) => (
              <div key={p.name} className="mb-2 flex flex-col gap-1">
                <p className="text-xs font-bold text-teal-strong">
                  {p.name}{" "}
                  <span className="font-medium text-warm-400">· {p.residence}</span>
                </p>
                {p.payout === "december" ? (
                  <>
                    <BRow
                      label="Share this month → December pot"
                      value={formatUsd(p.transferCents)}
                      strong
                    />
                    {(p.drawCents ?? 0) > 0 ? (
                      <BRow
                        label="December draw — to their bank (this month + the pot)"
                        value={formatUsd(p.drawCents)}
                        strong
                        tint="text-teal-strong"
                      />
                    ) : (
                      <BRow
                        label="Waiting in the December pot"
                        value={formatUsd(p.undrawnBalanceCents)}
                      />
                    )}
                  </>
                ) : (
                  <BRow
                    label="To their bank — theirs to spend"
                    value={formatUsd(p.transferCents)}
                    strong
                    tint="text-teal-strong"
                  />
                )}
                <BRow
                  label={`Tax envelope, held (${p.taxRatePct}% of their ${formatUsd(p.profitShareCents)})`}
                  value={formatUsd(p.taxEnvelopeCents)}
                />
                {p.taxParts ? (
                  <p className="text-[11px] leading-snug text-warm-400 tabular-nums">
                    SE {formatUsd(p.taxParts.seCents)} · federal{" "}
                    {formatUsd(p.taxParts.federalCents)} ·{" "}
                    {p.taxParts.cityCents > 0
                      ? `NY State ${formatUsd(p.taxParts.stateCents)} (PA first ${formatUsd(p.taxParts.paNonresidentCents)}, NY credits it) · NYC ${formatUsd(p.taxParts.cityCents)}`
                      : `PA ${formatUsd(p.taxParts.stateCents)} · Bethlehem ${formatUsd(p.taxParts.localCents)}`}
                    {" · "}held for {p.name} now {formatUsd(p.taxHeldCents ?? p.taxEnvelopeCents)}
                    {(p.taxPaidCents ?? 0) > 0 ? ` (after ${formatUsd(p.taxPaidCents)} sent this month)` : ""}
                  </p>
                ) : null}
              </div>
            ))}
            <BRow
              label={`To Marketing (Navy Federal) — 27th→1st money, ${formatUsd(b.retainedTailCents)} earned${
                (b.growthTransferCents ?? 0) < b.retainedTailCents
                  ? "; the rest went to taxes + the reserve"
                  : ""
              }`}
              value={formatUsd(b.growthTransferCents ?? 0)}
              strong
            />
            <BRow
              label={`Kept by the business — both envelopes${
                (b.reserveTopUpCents ?? 0) > 0
                  ? ` + ${formatUsd(b.reserveTopUpCents)} reserve top-up`
                  : (b.reserveAfterCents ?? 0) >= (b.reserveTargetCents ?? 0)
                    ? " (reserve already at target)"
                    : ""
              }`}
              value={formatUsd(b.keepInAccountCents)}
            />
            {b.storeNetCents > 0 ? (
              <p className="mt-1 text-[11px] leading-snug text-warm-400">
                {formatUsd(b.storeNetCents)} of this is store money and lands late
                (Apple about a month behind, Google mid-next-month) — transfer
                after it lands.
              </p>
            ) : null}
          </Section>
        ) : (
          <Section title="The split — on the 27th">
            <p className="text-warm-300">
              No profit to split — nothing to the partners from this month,
              nothing to Marketing.
              {(b.reserveDrawCents ?? 0) > 0
                ? ` The reserve covered ${formatUsd(b.reserveDrawCents)} of the ${formatUsd(-b.profitCents)} loss.`
                : ""}
            </p>
            {/* A December pot still leaves in December, profit or not —
                it's money already counted in earlier months. */}
            {b.partners
              .filter((p) => (p.drawCents ?? 0) > 0)
              .map((p) => (
                <BRow
                  key={p.name}
                  label={`${p.name}'s December draw — the pot, to their bank`}
                  value={formatUsd(p.drawCents)}
                  strong
                  tint="text-teal-strong"
                />
              ))}
            {(b.shortfallCents ?? 0) > 0 ? (
              <p className="font-semibold text-coral-strong">
                {formatUsd(b.shortfallCents)} beyond the reserve —{" "}
                {b.shortfallPaidBy
                  ? `${b.shortfallPaidBy} paid it out of pocket (capital, owed back).`
                  : "paid out of pocket; nobody booked yet — say who and it becomes their capital."}
              </p>
            ) : null}
          </Section>
        )}

        {/* The Marketing account, reconciled: what the formula says it
            should hold vs what Navy Federal showed on the 1st (Wilson
            2026-09-02 — he reports it every 1st). Keyed by this month. */}
        <Section title="Marketing account · Navy Federal">
          <BRow
            label="Formula says it holds (every 27th→1st tail since launch)"
            value={formatUsd(b.growthBalanceCents ?? 0)}
            strong
          />
          {report ? (
            <>
              <BRow
                label={`Bank showed on ${report.reportedOn}`}
                value={formatUsd(report.balanceCents)}
              />
              <BRow
                label={
                  reportDiff === 0
                    ? "Matches the formula"
                    : reportDiff > 0
                      ? "More than the formula expects"
                      : "Less than the formula expects"
                }
                value={
                  reportDiff === 0
                    ? "✓"
                    : `${reportDiff > 0 ? "+" : "−"}${formatUsd(Math.abs(reportDiff))}`
                }
                tint={
                  reportDiff === 0
                    ? "font-semibold text-teal-strong"
                    : "font-semibold text-coral-strong"
                }
              />
            </>
          ) : (
            <p className="text-[11px] leading-snug text-warm-400">
              {example
                ? "On the 1st you type what the bank shows; the two sit side by side."
                : `Not reported yet — on ${reportDay}, type what the bank shows.`}
            </p>
          )}
          {example ? null : (
            <form
              action={saveMarketingReportAction}
              className="mt-1 flex flex-wrap items-end gap-2"
            >
              <input type="hidden" name="month" value={b.month} />
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">
                  Navy Federal on {reportDay}
                </span>
                <input
                  name="balance"
                  type="text"
                  inputMode="decimal"
                  pattern="^\$?[0-9,]+(\.[0-9]{0,2})?$"
                  title="A dollar amount like 1234.56"
                  placeholder="0.00"
                  required
                  defaultValue={report ? (report.balanceCents / 100).toFixed(2) : ""}
                  className="w-36 rounded-xl bg-ink px-3 py-1.5 text-sm font-semibold tabular-nums text-warm-50 ring-1 ring-warm-700 focus:outline-none focus:ring-2 focus:ring-teal"
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-teal/10 px-4 py-1.5 text-sm font-semibold text-teal-strong ring-1 ring-teal/25 transition-colors hover:bg-teal/15"
              >
                {report ? "Update" : "Save"}
              </button>
            </form>
          )}
          {nudgePrev ? (
            <p className="mt-1 text-xs font-semibold text-coral-strong">
              {prevLabel}&apos;s balance isn&apos;t reported yet — tap ‹ and enter
              what Navy Federal showed on the 1st.
            </p>
          ) : null}
        </Section>

        {/* Taxes actually sent (Wilson 2026-09-02: Danisel four times a
            year, Pedro once in December). Each payment drains that
            member's held envelope in the month it went out. */}
        <Section
          title="Taxes · sent in each name"
          note="Held money leaves when they pay. Record every payment here; the held amount drains and the bank line stays true."
        >
          {b.partners.map((p) => (
            <div key={p.name} className="flex flex-col gap-0.5">
              <BRow
                label={`Held for ${p.name} now${(p.taxPaidCents ?? 0) > 0 ? ` (after ${formatUsd(p.taxPaidCents)} sent this month)` : ""}`}
                value={formatUsd(p.taxHeldCents ?? 0)}
                tint={(p.taxOverpaidCents ?? 0) > 0 ? "font-semibold text-coral-strong" : undefined}
              />
              {p.taxDueNote ? (
                <p className="text-[11px] leading-snug text-warm-400">{p.taxDueNote}</p>
              ) : null}
              {(p.taxOverpaidCents ?? 0) > 0 ? (
                <p className="text-[11px] font-semibold leading-snug text-coral-strong">
                  {formatUsd(p.taxOverpaidCents)} more was sent than was held for {p.name} — the
                  business advanced it; the next envelopes fill it back.
                </p>
              ) : null}
              {(p.taxPayments ?? []).map((t, i) => {
                const match = !b.frozen && !example
                  ? taxPayments.find(
                      (x) =>
                        x.partner === p.name &&
                        x.paidOn === t.paidOn &&
                        x.amountCents === t.amountCents &&
                        x.government === t.government,
                    )
                  : undefined;
                return (
                  <div
                    key={`${t.paidOn}-${i}`}
                    className="flex items-baseline justify-between gap-3 pl-3 text-xs text-warm-300"
                  >
                    <span>
                      {t.paidOn} · {TAX_GOVERNMENT_LABEL[t.government] ?? t.government}
                      {t.note ? ` · ${t.note}` : ""}
                    </span>
                    <span className="flex items-baseline gap-2 tabular-nums">
                      {formatUsd(t.amountCents)}
                      {match ? (
                        <form action={deleteTaxPaymentAction}>
                          <input type="hidden" name="id" value={match.id} />
                          <button
                            type="submit"
                            title="Remove this payment (typed wrong)"
                            className="text-[11px] text-warm-400 hover:text-coral-strong"
                          >
                            remove
                          </button>
                        </form>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
          {example ? null : (
            <form
              action={recordTaxPaymentAction}
              className="mt-1 flex flex-wrap items-end gap-2"
            >
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">
                  Who
                </span>
                <select name="partner" required className={fieldClass}>
                  {b.partners.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">
                  To
                </span>
                <select name="government" required className={fieldClass}>
                  {TAX_GOVERNMENTS.map((g) => (
                    <option key={g} value={g}>
                      {TAX_GOVERNMENT_LABEL[g]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">
                  Paid on
                </span>
                <input
                  name="paidOn"
                  type="date"
                  required
                  defaultValue={todayInNewYork()}
                  max={todayInNewYork()}
                  className={fieldClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">
                  Amount
                </span>
                <input
                  name="amount"
                  type="text"
                  inputMode="decimal"
                  pattern="^\$?[0-9,]+(\.[0-9]{0,2})?$"
                  title="A dollar amount like 1234.56"
                  placeholder="0.00"
                  required
                  className={`w-28 ${fieldClass}`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-warm-400">
                  Note (optional)
                </span>
                <input name="note" type="text" maxLength={500} placeholder="e.g. Q3 estimate" className={`w-40 ${fieldClass}`} />
              </label>
              <button
                type="submit"
                className="rounded-full bg-teal/10 px-4 py-1.5 text-sm font-semibold text-teal-strong ring-1 ring-teal/25 transition-colors hover:bg-teal/15"
              >
                Record payment
              </button>
            </form>
          )}
        </Section>

        <Section title="Balances after transfer day">
          <BRow
            label={`Operating reserve (target ${formatUsd(b.reserveTargetCents ?? 0)})`}
            value={formatUsd(b.reserveAfterCents ?? 0)}
          />
          <BRow
            label="Taxes held for the partners (after payments sent)"
            value={formatUsd(b.taxHeldTotalCents ?? 0)}
          />
          {(b.taxPaidTotalCents ?? 0) > 0 ? (
            <BRow
              label="Taxes sent this month in their names (already left the account)"
              value={formatUsd(b.taxPaidTotalCents ?? 0)}
            />
          ) : null}
          {b.partners
            .filter((p) => p.payout === "december" && p.undrawnBalanceCents > 0)
            .map((p) => (
              <BRow
                key={p.name}
                label={`${p.name}'s December pot — already counted, taken once a year`}
                value={formatUsd(p.undrawnBalanceCents)}
              />
            ))}
          <BRow
            label="The account should hold"
            value={formatUsd(b.accountShouldHoldCents ?? 0)}
            strong
          />
          {(b.lockedSavingsCents ?? 0) > 0 ? (
            <BRow
              label="Savings account — the bank's minimum, separate, never spent"
              value={formatUsd(b.lockedSavingsCents)}
            />
          ) : null}
        </Section>

          </div>
        </details>

        <details className="group border-t border-warm-700/60 bg-ink">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-warm-400 [&::-webkit-details-marker]:hidden">
            <span className="inline-block text-base leading-none transition-transform group-open:rotate-90">
              ›
            </span>
            How this works
          </summary>
          <div className="flex flex-col gap-2 px-5 pb-4 text-xs leading-relaxed text-warm-400">
            <p>
              <span className="font-semibold text-warm-200">The month.</span>{" "}
              Every month goes final on its 27th and is written to the ledger —
              those numbers never move. Taxes are held by the business until
              each partner sends their own estimated payment. Money made from
              the 27th to the 1st is never split; it moves to the Marketing
              account at Navy Federal on the 27th.
            </p>
            <p>
              <span className="font-semibold text-warm-200">Capital.</span> The
              $175s on the 1st, the savings floor, and any loss covered out of
              pocket are capital — not income, not taxed, never split. The
              1st-of-month money fills the reserve until profit does. The
              business owes it all back; returning it is not income.
            </p>
            <p>
              <span className="font-semibold text-warm-200">The reserve.</span>{" "}
              A target balance the account keeps, not a monthly charge: next
              month&apos;s bills ({formatUsd(b.billsCents)} — the fixed subs
              plus this month&apos;s usage) + a {formatUsd(b.cushionCents)}{" "}
              cushion for growth. It rises as the app gets used more, fills
              once, tops up only when it dips, and a loss draws it down.
            </p>
            <p>
              <span className="font-semibold text-warm-200">Marketing.</span>{" "}
              The formula&apos;s balance is every 27th→1st tail since launch,
              never distributed; its taxes are already in the envelopes. On the
              1st you type what the bank shows and the two sit side by side.
            </p>
            <p>
              <span className="font-semibold text-warm-200">Taxes.</span> The
              business holds each partner&apos;s envelope until they send an
              estimated payment in their own name — Danisel four times a year
              (IRS + PA Apr 15 / Jun 15 / Sep 15 / Jan 15; Bethlehem through
              Keystone Apr 15 / Jul 15 / Oct 15 / Jan 15), Pedro once in
              December with his draw. Record every payment above; the held
              amount drains in the month it was sent. Danisel files
              married-filing-separately, Pedro single — the federal brackets
              follow. Not tax advice.
            </p>
            <p>
              <span className="font-semibold text-warm-200">Timing.</span> Web
              money arrives within days. Apple pays about a month behind,
              Google mid-next-month — transfer after it lands, not before.
            </p>
            <p className="tabular-nums">
              <span className="font-semibold text-warm-200">
                The ladder — monthly profit → each one&apos;s rate.
              </span>
              <br />
              Bethlehem PA:{" "}
              {b.taxLadder
                .map((r) => `$${(r.profitCents / 100000).toFixed(0)}k → ${r.ratePctPA ?? r.ratePct}%`)
                .join("  ·  ")
                .replace("$1000k", "$1M")}
              <br />
              Bronx NYC:{" "}
              {b.taxLadder
                .map((r) => `$${(r.profitCents / 100000).toFixed(0)}k → ${r.ratePctNYC ?? r.ratePct}%`)
                .join("  ·  ")
                .replace("$1000k", "$1M")}
              <br />
              Only the dollars past each rung pay the higher lanes — a bigger
              month is always more take-home.
            </p>
            {b.partners.map((p) => (
              <p key={p.name}>{p.taxNote}</p>
            ))}
            <p>
              Estimates, not tax advice. Store commission, Stripe fees, and the
              tax rates are labeled estimates; Anthropic is the real ledger
              number.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}

/** One labeled group of the card: a small-caps caption, label:value
 *  rows, an optional one-line footnote. Mirrors MSection on mobile. */
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-warm-700/60 px-5 py-3 text-sm">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-warm-400">
        {title}
      </p>
      {children}
      {note ? (
        <p className="mt-1 text-[11px] leading-snug text-warm-400">{note}</p>
      ) : null}
    </div>
  );
}

function BRow({
  label,
  value,
  strong,
  tint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className={strong ? "font-semibold text-warm-50" : "text-warm-400"}>
        {label}
      </span>
      <span
        className={`tabular-nums ${tint ?? (strong ? "font-bold text-warm-50" : "font-medium text-warm-200")}`}
      >
        {value}
      </span>
    </div>
  );
}
