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
        <div className="flex justify-end gap-2">
          <Link
            href="/admin/revenue/statement"
            className="rounded-full bg-teal/10 px-4 py-2 text-sm font-semibold text-teal-strong ring-1 ring-teal/25 transition-colors hover:bg-teal/15"
          >
            Accountant statement
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
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/revenue/statement?months=${month}`}
            className="rounded-full bg-teal/10 px-4 py-2 text-sm font-semibold text-teal-strong ring-1 ring-teal/25 transition-colors hover:bg-teal/15"
          >
            Accountant statement
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
      <MonthBreakdownCard b={breakdown} />

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
}: {
  b: MonthBreakdown;
  example?: boolean;
}) {
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
      )}

      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
        <p className="border-b border-warm-700/60 bg-ink px-5 py-2 text-[11px] font-medium tracking-wide text-warm-400">
          {b.periodLabel} — transfer day. After that, these numbers never
          move. All taxes are already accounted for and left in the
          account. Money made from the 27th to the 1st stays in the account
          — compounding monthly for emergencies, hiring, and future
          endeavors.
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
              {b.partners.map((p) => (
                <div
                  key={p.name}
                  className="mb-2 rounded-lg bg-ink-soft px-3 py-2.5 ring-1 ring-warm-700/60"
                >
                  <p className="text-sm font-bold text-teal-strong">
                    {p.name}{" "}
                    <span className="font-semibold text-warm-400">
                      · lives in {p.residence}
                    </span>
                  </p>
                  {p.payout === "december" ? (
                    <>
                      <p className="mt-1 text-warm-50">
                        🗓️ {p.name}&apos;s share this month:{" "}
                        <span className="font-bold">
                          {formatUsd(p.transferCents)}
                        </span>{" "}
                        <span className="text-warm-400">
                          — stays in the account for his once-a-year December
                          draw
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-teal-strong">
                        💰 Waiting in {p.name}&apos;s December pot:{" "}
                        {formatUsd(p.undrawnBalanceCents)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-warm-50">
                      💵 To {p.name}&apos;s bank:{" "}
                      <span className="font-bold">
                        {formatUsd(p.transferCents)}
                      </span>{" "}
                      <span className="text-warm-400">— all theirs to spend</span>
                    </p>
                  )}
                  <p className="mt-0.5 text-xs leading-relaxed text-warm-400">
                    🏦 {p.name}&apos;s tax envelope:{" "}
                    <span className="font-semibold text-warm-200">
                      {formatUsd(p.taxEnvelopeCents)}
                    </span>{" "}
                    ({p.taxRatePct}% of their own {formatUsd(p.profitShareCents)}{" "}
                    half) — held by the business. {p.taxNote}
                    {p.payout === "december"
                      ? " Waiting until December does NOT delay taxes — the envelope still goes out every quarter."
                      : ""}
                  </p>
                </div>
              ))}
              <p className="mt-2 text-warm-300">
                🏢 The business keeps{" "}
                <span className="font-semibold text-warm-100">
                  {formatUsd(b.keepInAccountCents)}
                </span>{" "}
                — next month&apos;s bills, a safety cushion, both tax
                envelopes ({formatUsd(b.partners[0].taxEnvelopeCents)} for{" "}
                {b.partners[0].name} + {formatUsd(b.partners[1].taxEnvelopeCents)}{" "}
                for {b.partners[1].name}), and the after-the-27th money
                (compounding for future endeavors). Nobody spends this.
                {b.partners
                  .filter((p) => p.payout === "december")
                  .map(
                    (p) =>
                      ` ${p.name}'s December pot (${formatUsd(p.undrawnBalanceCents)}) waits in the account too — his money, already counted, taken once a year.`,
                  )
                  .join("")}
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
          <div className="mt-3 rounded-lg bg-ink-soft px-3 py-2.5 ring-1 ring-warm-700/60">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-warm-400">
              The ladder — monthly profit → each one&apos;s rate
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-warm-300 tabular-nums">
              <span className="font-semibold text-warm-200">Bethlehem PA:</span>{" "}
              {b.taxLadder
                .map(
                  (r) =>
                    `$${(r.profitCents / 100000).toFixed(0)}k → ${r.ratePctPA ?? r.ratePct}%`,
                )
                .join("  ·  ")
                .replace("$1000k", "$1M")}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-warm-300 tabular-nums">
              <span className="font-semibold text-warm-200">Bronx NYC:</span>{" "}
              {b.taxLadder
                .map(
                  (r) =>
                    `$${(r.profitCents / 100000).toFixed(0)}k → ${r.ratePctNYC ?? r.ratePct}%`,
                )
                .join("  ·  ")
                .replace("$1000k", "$1M")}
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-warm-400">
              Only the dollars past each rung pay the higher lanes — a bigger
              month is always more take-home.
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-warm-400">
            Each rate is computed fresh each month for where that partner
            lives. Danisel (Bethlehem): PA&apos;s flat 3.07% + Bethlehem&apos;s
            1% local + self-employment + the federal brackets. Pedro (Bronx):
            NY State&apos;s brackets + NYC&apos;s city tax + self-employment +
            federal — PA taxes his share first and New York credits every PA
            dollar, so he&apos;s never taxed twice; the city tax is his real
            extra. Estimates, not tax advice.
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
