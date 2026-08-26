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
  /** "counting Jul 27 → Aug 26 · final on the 27th" */
  periodLabel: string;
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
  /** Each partner's FULL transfer out (their half of profit) — the
   *  tax share travels with it and goes to their personal savings. */
  transferPerPartnerCents: number;
  /** Of that transfer, what each sends to savings for taxes. */
  taxSavingsPerPartnerCents: number;
  partnerA: string;
  partnerB: string;
  keepInAccountCents: number; // bills + growth cushion, held before any split
  billsCents: number;
  cushionCents: number;
  refundedCents: number; // informational
  /** amount → reserve-rate rungs, computed from the same formula. */
  taxLadder: { profitCents: number; ratePct: number }[];
  /** Net receipts earned during the window's tail (the previous
   *  month's 27th → its end): Wilson's compounding rule — this money
   *  STAYS in the account permanently (held back before any split),
   *  while its taxes are still reserved with the rest of profit. */
  retainedTailCents: number;
};

/**
 * THE EXAMPLE MONTH (Wilson 2026-08-26): until real payments exist,
 * the empty revenue screen teaches the formula with made-up revenue —
 * clearly labeled EXAMPLE — run through the SAME math and the REAL
 * configured rates/costs, so the day money arrives, the page looks
 * exactly like the example did. Sample story: $1,000 month — $650
 * through the stores, $350 through the site.
 */
export function exampleMonthBreakdown(settings: {
  tax_reserve_rate: number;
  store_commission_rate: number;
  web_processing_rate: number;
  partner_a: string;
  partner_b: string;
  fixed_monthly_costs: { name: string; cents: number }[];
}): MonthBreakdown {
  return computeBreakdown({
    month: "0000-00",
    monthLabel: "Example month",
    grossWebCents: 35000,
    grossStoreCents: 65000,
    anthropicCents: 2600, // ~what a month of chatting costs at this scale
    replicateCents: 200, // ~50 faces
    refundedCents: 0,
    settings,
  });
}

/** 2026-ish federal brackets (single filer, annual dollars) — the
 *  progressive stack applied to the annualized profit share. Bracket
 *  edges drift yearly; close is honest for a reserve. */
function federalAnnualTaxDollars(taxable: number): number {
  const brackets: [number, number][] = [
    [11925, 0.1],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [626350, 0.35],
    [Infinity, 0.37],
  ];
  let tax = 0;
  let prev = 0;
  for (const [edge, rate] of brackets) {
    if (taxable <= prev) break;
    const slice = Math.min(taxable, edge) - prev;
    tax += slice * rate;
    prev = edge;
  }
  return tax;
}

/** Per-partner monthly tax reserve for a Bethlehem PA resident's LLC
 *  profit share: SE (SS wage-base capped, Medicare uncapped + 0.9%
 *  additional) + PA 3.07% + Bethlehem 1% + federal brackets on the
 *  annualized share (minus the deductible half of SE). */
function taxSaveForShareCents(shareCents: number): number {
  if (shareCents <= 0) return 0;
  const seBaseAnnualDollars = (shareCents * 0.9235 * 12) / 100;
  const ssAnnual = Math.min(seBaseAnnualDollars, 176100) * 0.124;
  const medicareAnnual =
    seBaseAnnualDollars * 0.029 +
    Math.max(0, seBaseAnnualDollars - 200000) * 0.009;
  const seCents = ((ssAnnual + medicareAnnual) * 100) / 12;
  const paCents = shareCents * 0.0307;
  const localCents = shareCents * 0.01;
  const annualTaxable = Math.max(0, (shareCents - seCents / 2) * 12) / 100;
  const fedCents = (federalAnnualTaxDollars(annualTaxable) * 100) / 12;
  return Math.round(seCents + paCents + localCents + fedCents);
}

/** THE LADDER (Wilson 2026-08-26: "write somewhere the amount → tax
 *  rate so we always know what to put into savings"). Computed from
 *  the SAME formula at sample monthly-profit levels — it can never
 *  drift from the card's math. Rates are marginal-stacked: only the
 *  dollars past each rung pay the higher lanes. */
export function taxLadder(): { profitCents: number; ratePct: number }[] {
  const samples = [
    100000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 100000000,
  ];
  return samples.map((profitCents) => {
    const share = profitCents / 2;
    const save = taxSaveForShareCents(share);
    return { profitCents, ratePct: Math.round((save / share) * 1000) / 10 };
  });
}

/** The one place the formula lives — the real month and the example
 *  both flow through here, so they can never disagree. */
function computeBreakdown(inputs: {
  month: string;
  monthLabel: string;
  periodLabel?: string;
  grossWebCents: number;
  grossStoreCents: number;
  anthropicCents: number;
  replicateCents: number;
  refundedCents: number;
  /** Net receipts from the window's tail days — retained, never split. */
  retainedTailCents?: number;
  settings: {
    tax_reserve_rate: number;
    store_commission_rate: number;
    web_processing_rate: number;
    partner_a: string;
    partner_b: string;
    fixed_monthly_costs: { name: string; cents: number }[];
  };
}): MonthBreakdown {
  const { settings } = inputs;
  const grossCents = inputs.grossWebCents + inputs.grossStoreCents;
  const storeCommissionCents = Math.round(
    inputs.grossStoreCents * Number(settings.store_commission_rate),
  );
  const webProcessingCents = Math.round(
    inputs.grossWebCents * Number(settings.web_processing_rate),
  );
  const netReceiptsCents = grossCents - storeCommissionCents - webProcessingCents;

  const fixed = (settings.fixed_monthly_costs ?? []).map((f) => ({
    name: f.name,
    cents: f.cents,
    estimated: false,
  }));
  const expenses = [
    ...fixed,
    {
      name: "Anthropic (actual, per message)",
      cents: inputs.anthropicCents,
      estimated: false,
    },
    {
      name: "Replicate (faces, estimated)",
      cents: inputs.replicateCents,
      estimated: true,
    },
  ];
  const totalExpensesCents = expenses.reduce((a, e) => a + e.cents, 0);
  const profitCents = netReceiptsCents - totalExpensesCents;
  // THE COMPUTED TAX RESERVE (Wilson 2026-08-26: "implement the
  // correct percentage into the formula"). Not a flat guess — built
  // from the verified components for a Bethlehem PA resident's LLC
  // profit share:
  //   PA flat income tax          3.07%
  //   Bethlehem local EIT         1.00% (taxes residents' net profits)
  //   Self-employment             15.3% on 92.35% of the share
  //   Federal                     the real progressive brackets,
  //                               applied to the ANNUALIZED share
  //                               (minus the deductible half of SE) —
  //                               a big month reserves at a higher
  //                               rate, exactly like April will.
  // Deliberately conservative: no standard deduction assumed (other
  // income likely consumes it). Still an estimate — brackets shift
  // yearly and personal situations differ — but it now moves with the
  // money the way the real bill does.
  const shareCents = profitCents > 0 ? profitCents / 2 : 0;
  const taxSavePerPartner = taxSaveForShareCents(shareCents);
  const taxReserveCents = profitCents > 0 ? taxSavePerPartner * 2 : 0;
  const taxReserveRate =
    shareCents > 0 ? taxSavePerPartner / shareCents : Number(settings.tax_reserve_rate);
  const fixedTotal = fixed.reduce((a, f) => a + f.cents, 0);
  // Wilson's holdback rule (2026-08-26): before ANY split, the
  // account keeps its own survival money — next month's bills plus a
  // 50% growth cushion, so a soft month or a growth spurt never
  // catches the account empty. Only what's left after the holdback
  // gets split.
  // Cushion = the BIGGER of 50% of bills (survival floor for lean
  // months) or 10% of profit (great months bank real growth money).
  // Both halves recompute monthly from live numbers — the cushion
  // grows itself as the business does.
  const cushionCents = Math.max(
    Math.round(fixedTotal * 0.5),
    profitCents > 0 ? Math.round(profitCents * 0.1) : 0,
  );
  // Wilson's compounding rule (2026-08-26): money made from the 27th
  // to month-end never gets distributed — it stays and compounds (for
  // hires, usage spikes, whatever growth demands). Its TAXES are
  // still reserved (pass-through taxes all profit, withdrawn or not).
  const retainedTailCents = Math.max(0, Math.round(inputs.retainedTailCents ?? 0));
  const holdbackCents = fixedTotal + cushionCents + Math.min(retainedTailCents, Math.max(0, profitCents));
  const distributableCents =
    profitCents > holdbackCents ? profitCents - holdbackCents : 0;
  // Each partner transfers their half of the after-holdback pool.
  // Taxes are owed on their share of PROFIT (not of the transfer), so
  // the savings line is (profit/2) × rate regardless of what was
  // withheld — the honest number for year-end.
  const transferPerPartnerCents = Math.floor(distributableCents / 2);
  const taxSavingsPerPartnerCents = profitCents > 0 ? taxSavePerPartner : 0;
  const perPartnerCents = Math.max(
    0,
    transferPerPartnerCents - taxSavingsPerPartnerCents,
  );

  return {
    month: inputs.month,
    monthLabel: inputs.monthLabel,
    periodLabel:
      inputs.periodLabel ?? "counting the 27th → the 26th · final on the 27th",
    grossWebCents: inputs.grossWebCents,
    grossStoreCents: inputs.grossStoreCents,
    grossCents,
    storeCommissionCents,
    webProcessingCents,
    netReceiptsCents,
    webNetCents: inputs.grossWebCents - webProcessingCents,
    storeNetCents: inputs.grossStoreCents - storeCommissionCents,
    expenses,
    totalExpensesCents,
    profitCents,
    taxReserveRate,
    taxReserveCents,
    distributableCents,
    perPartnerCents,
    transferPerPartnerCents,
    taxSavingsPerPartnerCents,
    partnerA: settings.partner_a ?? "Danisel",
    partnerB: settings.partner_b ?? "Pedro",
    keepInAccountCents: holdbackCents,
    billsCents: fixedTotal,
    cushionCents,
    refundedCents: inputs.refundedCents,
    taxLadder: taxLadder(),
    retainedTailCents,
  };
}

/** Example with the LIVE settings (rates + fixed costs) applied. */
export async function fetchExampleBreakdown(
  supabase: SupabaseClient,
): Promise<MonthBreakdown> {
  const { data } = await supabase
    .from("business_settings")
    .select(
      "tax_reserve_rate, store_commission_rate, web_processing_rate, partner_a, partner_b, fixed_monthly_costs",
    )
    .eq("id", true)
    .maybeSingle();
  return exampleMonthBreakdown(
    (data ?? {
      tax_reserve_rate: 0.32,
      store_commission_rate: 0.15,
      web_processing_rate: 0.032,
      partner_a: "Danisel",
      partner_b: "Pedro",
      fixed_monthly_costs: [],
    }) as Parameters<typeof exampleMonthBreakdown>[0],
  );
}

export async function fetchMonthBreakdown(
  supabase: SupabaseClient,
  month: string, // "YYYY-MM"
): Promise<MonthBreakdown> {
  const [yStr, mStr] = month.split("-");
  const y = Number.parseInt(yStr, 10);
  const m = Number.parseInt(mStr, 10); // 1-12
  // SETTLEMENT WINDOW (Wilson 2026-08-26, final): month M counts the
  // 27th of the PREVIOUS month through the 26th of M, and goes FINAL
  // on M's 27th — transfer day. Sales on the 27th-31st belong to the
  // NEXT month's window, so settled numbers can never move after the
  // transfer. Boundary pinned at midnight EST (05:00 UTC) year-round
  // for determinism; the one-hour summer skew is deliberate.
  const start = new Date(Date.UTC(y, m - 2, 27, 5, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, 27, 5, 0, 0));
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const fmtDay = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });
  const lastDay = new Date(end.getTime() - 24 * 3600 * 1000);
  const periodLabel = `counting ${fmtDay(start)} → ${fmtDay(lastDay)} · final on the 27th`;
  // The tail: window start (prev 27th) → the 1st of the settlement
  // month. Revenue in here is Wilson's compound-in-the-account money.
  const tailEnd = new Date(Date.UTC(y, m - 1, 1, 5, 0, 0));
  const tailEndIso = tailEnd.toISOString();

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

  // Real Anthropic spend for the month, straight from the ledger.
  const anthropicCents = (spendRows.data ?? []).reduce(
    (a, r) => a + (r.cents ?? 0),
    0,
  );
  // Replicate: ~4¢ per generated face; identities created this month
  // is the honest proxy until per-call logging exists.
  const replicateCents = (oracleCount.count ?? 0) * 4;

  // Tail-net: what the 27th→month-end days brought in, after the
  // platform cuts — the amount that stays and compounds.
  const tailWeb = paidWeb
    .filter((p) => (p.paid_at ?? p.created_at) < tailEndIso)
    .reduce((a, p) => a + p.amount_cents, 0);
  const tailStore = storeEarned
    .filter((r) => r.purchased_at < tailEndIso)
    .reduce((a, r) => a + r.amount_cents, 0);
  const retainedTailCents =
    Math.round(tailWeb * (1 - Number(settings.web_processing_rate))) +
    Math.round(tailStore * (1 - Number(settings.store_commission_rate)));

  // ONE formula (computeBreakdown) — the real month and the example
  // can never disagree.
  return computeBreakdown({
    retainedTailCents,
    month,
    monthLabel: new Date(y, m - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    }),
    periodLabel,
    grossWebCents,
    grossStoreCents,
    anthropicCents,
    replicateCents,
    refundedCents: refundedWeb + refundedStore,
    settings: settings as Parameters<typeof exampleMonthBreakdown>[0],
  });
}

/** "YYYY-MM" default (or a validated ?month= param).
 *
 * Wilson's cadence (2026-08-26, final): the NEW month takes the stage
 * on the 1st; the 27th is settlement day (figures final, transfers
 * made) — both stated on the card. Month is reckoned in EASTERN so
 * the 1st arrives on Wilson's midnight, not UTC's. */
export function normalizeMonthParam(raw: string | null | undefined): string {
  if (raw && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) return raw;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => +(parts.find((p) => p.type === t)?.value ?? "0");
  return `${get("year")}-${String(get("month")).padStart(2, "0")}`;
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
