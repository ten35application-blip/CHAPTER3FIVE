import Link from "next/link";
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
  fetchExampleBreakdown,
  fetchMonthBreakdown,
  nextMonth,
  normalizeMonthParam,
  prevMonth,
  type MonthBreakdown,
} from "@/lib/admin/monthBreakdown";
import { ExportCsvButton } from "./ExportCsvButton";

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
  const [payments, breakdown] = await Promise.all([
    fetchPaidPayments(supabase),
    fetchMonthBreakdown(supabase, month),
  ]);
  const example =
    breakdown.grossCents === 0 ? await fetchExampleBreakdown(supabase) : null;

  if (payments.length === 0) {
    return (
      <div className="flex max-w-3xl flex-col gap-8">
        <div className="flex justify-end">
          <ExportCsvButton kind="settlements" />
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
        {example ? <MonthBreakdownCard b={example} example /> : null}
        <MonthBreakdownCard b={breakdown} />
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
        <div className="flex gap-2">
          <ExportCsvButton kind="settlements" />
          <ExportCsvButton />
        </div>
      </header>

      {example ? <MonthBreakdownCard b={example} example /> : null}
      <MonthBreakdownCard b={breakdown} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-warm-300">
          Daily revenue · last 30 days
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
}: {
  b: MonthBreakdown;
  example?: boolean;
}) {
  const pct = Math.round(b.taxReserveRate * 100);
  return (
    <section className="flex flex-col gap-3">
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
                className="font-semibold text-coral-strong hover:text-coral"
              >
                ‹
              </Link>
              <span className="font-semibold text-warm-50">{b.monthLabel}</span>
              <Link
                href={`/admin/revenue?month=${nextMonth(b.month)}`}
                className="font-semibold text-coral-strong hover:text-coral"
              >
                ›
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
        <p className="border-b border-warm-700/60 bg-ink px-5 py-2 text-[11px] font-medium tracking-wide text-warm-400">
          {b.periodLabel} — transfer day. After that, these numbers never move.
        </p>
        {example ? (
          <p className="border-b border-warm-700/60 bg-ink px-5 py-3 text-xs leading-relaxed text-warm-400">
            Made-up revenue ($1,000 month: $650 through the stores, $350
            through the site) run through the REAL formula with your real
            rates and bills — so the first real month reads exactly like
            this rehearsal.
          </p>
        ) : null}
        <div className="flex flex-col gap-1 px-5 py-4 text-sm">
          <BRow label="Customers paid" value={formatUsd(b.grossCents)} strong />
          <BRow
            label="Apple/Google keep (est.)"
            value={`−${formatUsd(b.storeCommissionCents)}`}
          />
          <BRow
            label="Stripe keeps (est.)"
            value={`−${formatUsd(b.webProcessingCents)}`}
          />
          <BRow
            label="Reaches the bank"
            value={formatUsd(b.netReceiptsCents)}
            strong
          />
        </div>
        <div className="flex flex-col gap-1 border-t border-warm-700/60 px-5 py-4 text-sm">
          {b.expenses.map((e) => (
            <BRow key={e.name} label={e.name} value={`−${formatUsd(e.cents)}`} />
          ))}
          <BRow
            label="Profit"
            value={formatUsd(b.profitCents)}
            strong
            tint={b.profitCents >= 0 ? "text-teal-strong" : "text-coral-strong"}
          />
        </div>
        <div className="m-4 rounded-xl bg-ink px-4 py-4 text-sm leading-relaxed ring-1 ring-warm-700">
          {b.profitCents > 0 ? (
            <>
              <p className="font-bold text-teal-strong">
                {b.partnerA} — transfer to bank account:{" "}
                {formatUsd(b.transferPerPartnerCents)}
              </p>
              <p className="mt-1 font-bold text-teal-strong">
                {b.partnerB} — transfer to bank account:{" "}
                {formatUsd(b.transferPerPartnerCents)}
              </p>
              <p className="mt-2 text-warm-50">
                After the bank transfer: each sends{" "}
                <span className="font-bold">
                  {formatUsd(b.taxSavingsPerPartnerCents)}
                </span>{" "}
                to savings for taxes ({pct}%) — leaving{" "}
                <span className="font-bold">
                  {formatUsd(b.perPartnerCents)}
                </span>{" "}
                each to spend.
              </p>
              <p className="mt-2 text-warm-300">
                Stays in the business account:{" "}
                <span className="font-semibold text-warm-100">
                  {formatUsd(b.keepInAccountCents)}
                </span>{" "}
                — next month&apos;s bills ({formatUsd(b.billsCents)}) + a
                growth cushion ({formatUsd(b.cushionCents)}) so the account
                never runs dry if we keep growing. Held back before the
                split.
              </p>
            </>
          ) : (
            <p className="text-warm-300">
              No profit to split this month — nothing transfers out, nothing
              owed to the reserve. The lines above show what the account still
              covers.
            </p>
          )}
          {b.storeNetCents > 0 ? (
            <p className="mt-2 text-xs leading-relaxed text-warm-400">
              Timing: {formatUsd(b.webNetCents)} of this arrives within days
              (web). {formatUsd(b.storeNetCents)} is store money — Apple pays
              about a month behind, Google mid-next-month. Transfer after it
              lands, not before.
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-warm-400">
            Estimates, not tax advice — the {pct}% reserve is the working
            guess until Pedro confirms the real rate with the filings.
          </p>
        </div>
      </div>
    </section>
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
