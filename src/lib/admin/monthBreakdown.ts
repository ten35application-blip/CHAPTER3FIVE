import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * THE MONTH BREAKDOWN (Wilson, launch morning 2026-08-26).
 *
 * Turns a month of revenue into the answer that actually matters:
 * what stays in the account (taxes + next month's bills), and what
 * Danisel and Pedro — 50/50 owners of the LLC — can each transfer out
 * and spend.
 *
 * The shape of the math, top to bottom:
 *
 *   gross revenue        what customers paid (web + stores)
 *   − store commission   Apple/Google's cut before payout (est.)
 *   − web processing     Stripe's cut (est.)
 *   = net receipts       what actually reaches the bank
 *   − operating costs    fixed subs + REAL Anthropic spend (ledger)
 *                        + Replicate estimate
 *   = profit             the month's true earnings
 *   − tax reserve        profit × tax_reserve_rate — STAYS in the
 *                        account for year-end taxes
 *   = distributable      split 50/50: each partner's transfer-out
 *
 * Anthropic costs are REAL cents from chat_spend_events (every model
 * call is logged). Store commission, Stripe fees, Replicate, and the
 * tax rate are labeled ESTIMATES — the rates live in
 * business_settings and get tuned as reality reports in. None of
 * this is tax advice; Pedro files the taxes and confirms the rate.
 */

export type MonthBreakdown = {
  month: string; // "2026-08"
  monthLabel: string; // "August 2026"
  grossWebCents: number;
  grossStoreCents: number;
  grossCents: number;
  storeCommissionCents: number; // estimate
  webProcessingCents: number; // estimate
  netReceiptsCents: number;
  /** Web money after Stripe's cut — lands in the bank within days. */
  webNetCents: number;
  /** Store money after commission — Apple pays roughly a MONTH after
   *  the fiscal month closes, Google around mid-next-month. Earned
   *  now, in the bank later; transfers should wait for it to land. */
  storeNetCents: number;
  expenses: { name: string; cents: number; estimated: boolean }[];
  totalExpensesCents: number;
  profitCents: number; // can be negative
  taxReserveRate: number;
  taxReserveCents: number; // 0 when profit <= 0
  distributableCents: number;
  perPartnerCents: number;
  partnerA: string;
  partnerB: string;
  keepInAccountCents: number; // tax reserve + next month's fixed bills
  refundedCents: number; // informational
};

export async function fetchMonthBreakdown(
  supabase: SupabaseClient,
  month: string, // "YYYY-MM"
): Promise<MonthBreakdown> {
  const [yStr, mStr] = month.split("-");
  const y = Number.parseInt(yStr, 10);
  const m = Number.parseInt(mStr, 10); // 1-12
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [settingsRow, payments, storeRows, spendRows, oracleCount] =
    await Promise.all([
      supabase
        .from("business_settings")
        .select(
          "tax_reserve_rate, store_commission_rate, web_processing_rate, partner_a, partner_b, fixed_monthly_costs",
        )
        .eq("id", true)
        .maybeSingle(),
      supabase
        .from("payments")
        .select("amount_cents, status, paid_at, created_at")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .limit(10000),
      supabase
        .from("store_purchases")
        .select("amount_cents, refunded_at, purchased_at")
        .gte("purchased_at", startIso)
        .lt("purchased_at", endIso)
        .limit(10000),
      supabase
        .from("chat_spend_events")
        .select("cents")
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .limit(100000),
      supabase
        .from("oracles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startIso)
        .lt("created_at", endIso),
    ]);

  const settings = settingsRow.data ?? {
    tax_reserve_rate: 0.32,
    store_commission_rate: 0.15,
    web_processing_rate: 0.032,
    partner_a: "Danisel",
    partner_b: "Pedro",
    fixed_monthly_costs: [] as { name: string; cents: number }[],
  };

  const paidWeb = (payments.data ?? []).filter((p) => p.status === "paid");
  const refundedWeb = (payments.data ?? [])
    .filter((p) => p.status === "refunded")
    .reduce((a, p) => a + p.amount_cents, 0);
  const grossWebCents = paidWeb.reduce((a, p) => a + p.amount_cents, 0);

  const storeEarned = (storeRows.data ?? []).filter((r) => !r.refunded_at);
  const refundedStore = (storeRows.data ?? [])
    .filter((r) => r.refunded_at)
    .reduce((a, r) => a + r.amount_cents, 0);
  const grossStoreCents = storeEarned.reduce((a, r) => a + r.amount_cents, 0);

  const grossCents = grossWebCents + grossStoreCents;
  const storeCommissionCents = Math.round(
    grossStoreCents * Number(settings.store_commission_rate),
  );
  const webProcessingCents = Math.round(
    grossWebCents * Number(settings.web_processing_rate),
  );
  const netReceiptsCents =
    grossCents - storeCommissionCents - webProcessingCents;

  // Real Anthropic spend for the month, straight from the ledger.
  const anthropicCents = (spendRows.data ?? []).reduce(
    (a, r) => a + (r.cents ?? 0),
    0,
  );
  // Replicate: ~4¢ per generated face; identities created this month
  // is the honest proxy until per-call logging exists.
  const replicateCents = (oracleCount.count ?? 0) * 4;

  const fixed = (
    (settings.fixed_monthly_costs ?? []) as { name: string; cents: number }[]
  ).map((f) => ({ name: f.name, cents: f.cents, estimated: false }));
  const expenses = [
    ...fixed,
    { name: "Anthropic (actual, per message)", cents: anthropicCents, estimated: false },
    { name: "Replicate (faces, estimated)", cents: replicateCents, estimated: true },
  ];
  const totalExpensesCents = expenses.reduce((a, e) => a + e.cents, 0);

  const profitCents = netReceiptsCents - totalExpensesCents;
  const taxReserveRate = Number(settings.tax_reserve_rate);
  const taxReserveCents =
    profitCents > 0 ? Math.round(profitCents * taxReserveRate) : 0;
  const distributableCents = profitCents > 0 ? profitCents - taxReserveCents : 0;
  // Odd cent goes to the reserve, never invented: split floors.
  const perPartnerCents = Math.floor(distributableCents / 2);

  const fixedTotal = fixed.reduce((a, f) => a + f.cents, 0);
  const keepInAccountCents = taxReserveCents + fixedTotal;

  return {
    month,
    monthLabel: start.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    grossWebCents,
    grossStoreCents,
    grossCents,
    storeCommissionCents,
    webProcessingCents,
    netReceiptsCents,
    webNetCents: grossWebCents - webProcessingCents,
    storeNetCents: grossStoreCents - storeCommissionCents,
    expenses,
    totalExpensesCents,
    profitCents,
    taxReserveRate,
    taxReserveCents,
    distributableCents,
    perPartnerCents,
    partnerA: settings.partner_a ?? "Danisel",
    partnerB: settings.partner_b ?? "Pedro",
    keepInAccountCents,
    refundedCents: refundedWeb + refundedStore,
  };
}

/** "2026-08" for now (or a validated ?month= param). */
export function normalizeMonthParam(raw: string | null | undefined): string {
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map((n) => Number.parseInt(n, 10));
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map((n) => Number.parseInt(n, 10));
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
