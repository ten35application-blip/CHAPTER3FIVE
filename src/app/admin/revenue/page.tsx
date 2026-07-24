import {
  createAdminClient,
  daysAgo,
  fetchPaidPayments,
  formatUsd,
  paymentDate,
  startOfMonth,
  sumCents,
} from "@/lib/admin/queries";
import { ExportCsvButton } from "./ExportCsvButton";

/**
 * /admin/revenue — money reports. Reads the one-time `payments` table
 * (0009); the recurring side arrives with the Stripe-billing task, at
 * which point subscription rows land here with purpose 'subscription'
 * and the breakdown below just starts filling in.
 */
export default async function AdminRevenuePage() {
  const supabase = createAdminClient();
  const payments = await fetchPaidPayments(supabase);

  if (payments.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-3xl font-semibold tracking-tight text-warm-50">
          Revenue lives here once Stripe is wired.
        </p>
        <p className="max-w-md text-base leading-relaxed text-warm-300">
          Everything is pre-plumbed — the charts, the breakdown, the CSV
          export. The first paid charge that lands in the{" "}
          <span className="font-medium text-warm-100">payments</span> table
          lights this page up.
        </p>
      </div>
    );
  }

  const mtd = sumCents(payments, startOfMonth());
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
            All-time {formatUsd(allTime)} · one-time payments only until
            Stripe subscriptions land
          </p>
        </div>
        <ExportCsvButton />
      </header>

      <section className="flex flex-col gap-1 rounded-3xl bg-ink-soft px-8 py-8 ring-1 ring-warm-700">
        <p className="text-xs font-semibold uppercase tracking-wider text-warm-400">
          Month to date
        </p>
        <p className="text-5xl font-semibold tracking-tight">
          <span className="text-gradient-cta">{formatUsd(mtd)}</span>
        </p>
      </section>

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
