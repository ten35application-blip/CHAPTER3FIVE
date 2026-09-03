import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * THE MONTH BREAKDOWN (Wilson, launch morning 2026-08-26; rebuilt as
 * a frozen ledger 2026-09-02: "make sure it updates every 27th …
 * from the 27th to the 1st that's a transfer to a separate bank
 * account … fix it all").
 *
 * Turns a month of revenue into the answer that actually matters:
 * what stays in the account, what moves to the Marketing account at
 * Navy Federal, and what Danisel and Pedro — 50/50 owners of the LLC
 * — each get.
 *
 * The shape of the math, top to bottom:
 *
 *   gross revenue        what customers paid (web + stores)
 *   − store commission   what Apple/Google kept (RevenueCat's real
 *                        take-home when reported, else the est. rate)
 *   − card fees          Stripe: 2.9% + 30¢ per charge
 *   = net receipts       what actually reaches the bank
 *   − operating costs    fixed subs + REAL Anthropic spend (ledger,
 *                        exact cents) + Replicate estimate
 *   = profit             the month's true earnings (can be negative)
 *
 *   then, in this order, out of profit:
 *   1. tax envelopes     each partner's own taxes on their own half,
 *                        HELD by the business until they send an
 *                        estimated payment in their own name — Danisel
 *                        four times a year (IRS + PA Apr 15 / Jun 15 /
 *                        Sep 15 / Jan 15; Bethlehem via Keystone Apr 15
 *                        / Jul 15 / Oct 15 / Jan 15), Pedro once in
 *                        December. Payments are recorded (tax_payments)
 *                        and drain the held amount in the month they
 *                        were sent; the 27th sheet says what's due next.
 *                        Danisel files married-filing-separately, Pedro
 *                        single — the federal brackets follow.
 *   2. reserve top-up    the operating reserve is a TARGET BALANCE
 *                        (next month's bills + cushion; bills = the
 *                        fixed subs + this month's usage costs, so it
 *                        scales with how much the app is used): filled
 *                        once, topped up only when it's below target —
 *                        never re-deducted every month
 *   3. growth transfer   money earned from the 27th → the 1st goes to
 *                        the Marketing account at Navy Federal — the
 *                        code still says growth*, the label changed
 *                        2026-09-02 (Wilson's compounding rule; its
 *                        taxes are in step 1)
 *   4. partner split     what's left, 50/50, each partner's envelope
 *                        out of their own half. Danisel's goes to her
 *                        bank on the 27th; Pedro's piles into his
 *                        once-a-year December pot.
 *
 *   Separately, NOT profit and NOT taxed: the members' $175 each on
 *   the 1st — capital contributions that fill the reserve until the
 *   business sustains itself (the formula says when).
 *
 * Every month is written down ONCE on transfer day (the 27th) into
 * public.settlements and never moves; balances (reserve, growth
 * total, each partner's tax held / pot / capital) carry forward from
 * the frozen row. Anthropic spend is REAL cents; store commission
 * (when RevenueCat didn't report it), Replicate, and the tax engine
 * are labeled ESTIMATES. None of this is tax advice.
 */

export const LAUNCH_MONTH = "2026-08";
/** The month the frozen ledger shipped — earlier months are settled
 *  retroactively and say so. */
export const LEDGER_SHIPPED_MONTH = "2026-09";

/** One partner's tax envelope, itemized per government so each
 *  accountant sees their own slice. All monthly cents. */
export type TaxParts = {
  /** Self-employment (Social Security + Medicare) — IRS. */
  seCents: number;
  /** Federal income tax on the annualized share — IRS. */
  federalCents: number;
  /** State income tax: PA flat 3.07% (Danisel) or NY State brackets
   *  (Pedro; the PA nonresident payment below rides INSIDE this). */
  stateCents: number;
  /** City income tax — NYC only (no credit anywhere). */
  cityCents: number;
  /** Local earned-income tax — Bethlehem 1% (Danisel). */
  localCents: number;
  /** Pedro only: paid to PA first as a nonresident (3.07%), then
   *  credited dollar-for-dollar by New York (IT-112-R). Already part
   *  of stateCents — shown so nobody thinks it's taxed twice. */
  paNonresidentCents: number;
  totalCents: number;
};

export type FilingStatus = "single" | "married_separate";
export type TaxSchedule = "quarterly" | "december";

/** One estimated-tax payment as it sits inside a frozen month. */
export type TaxPaymentLine = {
  paidOn: string; // YYYY-MM-DD
  government: "federal" | "state" | "city" | "local";
  amountCents: number;
  note: string | null;
};

export type PartnerBreakdown = {
  name: string;
  residence: string; // "Bethlehem, PA" | "Bronx, NYC"
  profitShareCents: number; // their half of profit
  taxEnvelopeCents: number; // held by the business for THEIR taxes
  taxParts: TaxParts;
  taxRatePct: number; // effective rate on their half, 1 decimal
  /** Their spendable entitlement this month (after their own
   *  envelope and their half of the reserve top-up + growth
   *  transfer). monthly payout: leaves on the 27th. december payout:
   *  stays, piling into their once-a-year pot. */
  transferCents: number;
  /** Cash that actually leaves the account for them THIS month:
   *  monthly partner = transferCents; December partner = the whole
   *  pot in December, else 0. */
  drawCents: number;
  payout: "monthly" | "december";
  /** December partners: pot carried in from prior months. */
  potBeforeCents: number;
  /** December partners: pot after this month (0 after the December
   *  draw). Monthly partners: 0. */
  undrawnBalanceCents: number;
  /** Held for their taxes coming into this month (last month's
   *  taxHeldCents). */
  taxHeldBeforeCents: number;
  /** Estimated-tax payments sent in their name THIS month, out of the
   *  operating account (recorded in tax_payments). Already left the
   *  bank on the day they were sent — not part of the 27th transfers. */
  taxPaidCents: number;
  /** The payments themselves, for the statement. */
  taxPayments: TaxPaymentLine[];
  /** Held for their taxes after this month: before + envelope − paid.
   *  Goes NEGATIVE when more was sent than was held — the business
   *  advanced them the difference (taxOverpaidCents) and the next
   *  envelopes fill it back. Never clamped: the account really has
   *  that much less, and "should hold" must stay true to the bank. */
  taxHeldCents: number;
  /** max(0, −taxHeldCents): paid beyond what was held, flagged. */
  taxOverpaidCents: number;
  /** How they file federally — the brackets follow. */
  filingStatus: FilingStatus;
  /** When they send their estimates. */
  taxSchedule: TaxSchedule;
  /** The next due dates after this month's transfer day, written once
   *  here and shown on every surface. */
  taxDueNote: string;
  /** Their contribution this month (capital, not income). */
  contributionCents: number;
  /** Their share of the savings-floor deposit, in the month it went
   *  in (0 every other month). Capital, like the $175. */
  savingsDepositCents: number;
  /** A loss the reserve couldn't cover that THEY paid out of pocket
   *  this month (Wilson 2026-09-02: Danisel). Capital, owed back. */
  shortfallCoveredCents: number;
  /** Total capital they've put in since launch — the business owes it
   *  back; returning it is not income and not taxed. */
  capitalCents: number;
  taxNote: string; // the how-it-works line, written once, shown everywhere
};

export type MonthBreakdown = {
  month: string; // "2026-08"
  monthLabel: string; // "August 2026"
  /** "counting Jul 27 → Aug 26 · final on the 27th" */
  periodLabel: string;
  /** true once the month is written to the ledger — numbers never
   *  move after. */
  frozen: boolean;
  settledAt: string | null;
  settledBy: "cron" | "lazy" | "admin" | null;
  settlementNote: string | null;
  grossWebCents: number;
  grossStoreCents: number;
  grossCents: number;
  storeCommissionCents: number;
  /** true when every store row carried RevenueCat's real take-home. */
  storeCommissionActual: boolean;
  webProcessingCents: number; // 2.9% + 30¢ × charges
  webChargeCount: number;
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
  taxReserveCents: number; // both envelopes; 0 when profit <= 0
  /** Both partners' entitlements together (what the split produced). */
  distributableCents: number;
  perPartnerCents: number;
  transferPerPartnerCents: number;
  taxSavingsPerPartnerCents: number;
  profitShareCents: number;
  partnerA: string;
  partnerB: string;
  /** What the business keeps FROM THIS MONTH'S PROFIT: envelopes +
   *  reserve top-up. Never more than profit. */
  keepInAccountCents: number;
  billsCents: number; // next month's bills = fixed subs + this month's usage (Anthropic + Replicate)
  cushionCents: number; // max(50% of bills, 10% of profit) — room for usage to grow
  refundedCents: number; // informational
  // ── THE OPERATING RESERVE (a balance, not a monthly deduction) ──
  reserveTargetCents: number; // bills + cushion
  /** Reserve carried in from last month. */
  reserveCarriedCents: number;
  /** Reserve after the 1st-of-month contributions landed. */
  reserveBeforeCents: number;
  reserveTopUpCents: number; // from profit, only up to target
  reserveDrawCents: number; // a loss month eats the reserve first
  reserveAfterCents: number;
  /** A loss the reserve couldn't cover — a member covered it. */
  shortfallCents: number;
  /** How much of that shortfall is booked as a member's capital (all
   *  of it when `shortfall_paid_by` names someone; 0 = unassigned). */
  shortfallCoveredCents: number;
  /** Who covered it, as booked — null when nobody is named. */
  shortfallPaidBy: string | null;
  // ── THE MARKETING ACCOUNT at Navy Federal (27th → 1st money; the
  //    fields keep their growth* names — same money, new label) ──
  /** Net receipts earned in the window's tail (prev 27th → the 1st). */
  retainedTailCents: number;
  /** What actually moves to the Marketing account on the 27th (the
   *  tail, capped by what profit had left after taxes + reserve). */
  growthTransferCents: number;
  growthBalanceCents: number; // cumulative moved there since launch
  // ── MEMBER CONTRIBUTIONS (capital, not income) ──
  contributionsPerMemberCents: number;
  contributionsCents: number; // both members
  /** true when the month paid for itself AND the reserve is full —
   *  the $175s can stop. */
  selfSustaining: boolean;
  contributionsVerdict: string;
  // ── THE SAVINGS FLOOR (Wilson 2026-09-02: "we had to put 255 in
  //    savings and its staying there") ──
  /** Sits in the savings account — never reserve, never growth, never
   *  spent. Members' capital, owed back like the $175s. */
  lockedSavingsCents: number;
  /** The deposit itself, in the month it went in; 0 after. */
  lockedSavingsDepositCents: number;
  // ── RUNNING TOTALS ──
  /** Both partners' held envelopes after this month's payments. */
  taxHeldTotalCents: number;
  /** Estimated-tax payments sent this month in both names — money that
   *  already left the account on the days it was sent. */
  taxPaidTotalCents: number;
  /** What the account should hold after transfer day: reserve + every
   *  tax envelope still held (after payments sent) + December pots.
   *  Compare to the bank. */
  accountShouldHoldCents: number;
  /** Cash leaving the account on the 27th: partner draws + growth.
   *  Tax payments are NOT in here — they left on their own days. */
  paidOutCents: number;
  /** The month in one plain paragraph (Wilson 2026-09-03: "a quick
   *  paragraph summary … so we don't have to look at all the
   *  numbers"). Written once here; every surface prints it. */
  summary: string;
  /** What's coming: the 1st, next month's bills, tax due dates, the
   *  27th. One short line each. */
  upcoming: string[];
  taxLadder: {
    profitCents: number;
    ratePct: number;
    ratePctPA: number;
    ratePctNYC: number;
  }[];
  partners: PartnerBreakdown[];
};

export type BusinessSettings = {
  tax_reserve_rate: number;
  store_commission_rate: number;
  web_processing_rate: number;
  web_processing_fixed_cents: number;
  partner_a: string;
  partner_b: string;
  fixed_monthly_costs: { name: string; cents: number }[];
  member_contribution_cents: number;
  member_contributions_start_month: string;
  member_contributions_end_month: string | null;
  /** The bank's savings minimum — deposited once, stays put. */
  locked_savings_cents: number;
  locked_savings_month: string | null;
  /** Which partner put the savings floor in (their capital). NULL =
   *  both, split evenly. Wilson 2026-09-02: "danisel put the entire 255". */
  locked_savings_by: string | null;
  /** Who pays a loss the reserve can't cover, until the business card
   *  and the $175s arrive (Wilson 2026-09-02: "Danisel."). Booked as
   *  that partner's capital. NULL = unassigned (flagged, not booked). */
  shortfall_paid_by: string | null;
};

const SETTINGS_COLUMNS =
  "tax_reserve_rate, store_commission_rate, web_processing_rate, web_processing_fixed_cents, partner_a, partner_b, fixed_monthly_costs, member_contribution_cents, member_contributions_start_month, member_contributions_end_month, locked_savings_cents, locked_savings_month, locked_savings_by, shortfall_paid_by";

const DEFAULT_SETTINGS: BusinessSettings = {
  tax_reserve_rate: 0.32,
  store_commission_rate: 0.15,
  web_processing_rate: 0.029,
  web_processing_fixed_cents: 30,
  partner_a: "Pedro",
  partner_b: "Danisel",
  fixed_monthly_costs: [],
  member_contribution_cents: 17500,
  // Wilson 2026-09-02: "the 175 goes in october 1st for both me and
  // pedro thats when the money in starts."
  member_contributions_start_month: "2026-10",
  member_contributions_end_month: null,
  locked_savings_cents: 25500,
  locked_savings_month: "2026-09",
  locked_savings_by: "Danisel",
  shortfall_paid_by: "Danisel",
};

/** Balances the month starts from — the previous frozen row's
 *  "after" numbers, or zeros at launch. */
export type PriorBalances = {
  reserveCents: number;
  growthCents: number;
  partners: Record<
    string,
    { potCents: number; taxHeldCents: number; capitalCents: number }
  >;
  /** When the previous month was written to the ledger — rows that
   *  arrived after that instant (a late store webhook, a checkout
   *  paid after the freeze) were never counted there and belong to
   *  the month being computed. Null = the previous month isn't frozen. */
  settledAt?: string | null;
};

const ZERO_PRIOR: PriorBalances = { reserveCents: 0, growthCents: 0, partners: {}, settledAt: null };

/** Is the $175 due this month? */
function contributionForMonth(settings: BusinessSettings, month: string): number {
  if (month < (settings.member_contributions_start_month ?? LAUNCH_MONTH)) return 0;
  if (settings.member_contributions_end_month && month > settings.member_contributions_end_month)
    return 0;
  return Math.max(0, Math.round(Number(settings.member_contribution_cents ?? 0)));
}

/** The savings floor as this month sees it: the balance sitting there
 *  (from its deposit month on) and the deposit itself (that month
 *  only — it's the members' capital, counted once). */
function lockedSavingsForMonth(
  settings: BusinessSettings,
  month: string,
): { balanceCents: number; depositCents: number } {
  const amount = Math.max(0, Math.round(Number(settings.locked_savings_cents ?? 0)));
  const since = settings.locked_savings_month;
  if (!amount || !since || month < since) return { balanceCents: 0, depositCents: 0 };
  return { balanceCents: amount, depositCents: month === since ? amount : 0 };
}

/**
 * THE EXAMPLE MONTH (Wilson 2026-08-26, updated 2026-09-02): until
 * real payments exist, the empty revenue screen teaches the formula
 * with made-up revenue — clearly labeled EXAMPLE — run through the
 * SAME math and the REAL configured rates/costs, so the day money
 * arrives the page looks exactly like the example did.
 *
 * Story: the first $1,000 month right after launch — $650 through the
 * stores (65 subscriptions), $350 through the site (35 charges),
 * about 5 of the 31 days landing after the 27th (the growth money).
 * The reserve starts empty, both members put in their $175 on the
 * 1st, each has one prior month of contributions on the books, and
 * the savings floor went in earlier (so it shows as a balance and as
 * capital already owed, not as this month's deposit).
 */
export function exampleMonthBreakdown(settings: BusinessSettings): MonthBreakdown {
  const perMember = Math.max(0, Math.round(Number(settings.member_contribution_cents ?? 17500)));
  const savings = Math.max(0, Math.round(Number(settings.locked_savings_cents ?? 0)));
  const names = [settings.partner_a ?? "Pedro", settings.partner_b ?? "Danisel"];
  const savingsShare = savingsShares(savings, names, settings.locked_savings_by);
  const prior: PriorBalances = {
    reserveCents: 0,
    growthCents: 0,
    partners: Object.fromEntries(
      names.map((n, i) => [
        n,
        { potCents: 0, taxHeldCents: 0, capitalCents: perMember + savingsShare[i] },
      ]),
    ),
  };
  return computeBreakdown({
    month: "0000-00",
    monthLabel: "Example month",
    grossWebCents: 35000,
    webChargeCount: 35,
    grossStoreCents: 65000,
    storeCommissionActual: false,
    anthropicCents: 2600, // ~what a month of chatting costs at this scale
    replicateCents: 200, // ~50 faces
    refundedCents: 0,
    retainedTailCents: 14200, // ≈ 5 of 31 days of net receipts
    contributionsPerMemberCents: perMember,
    lockedSavingsCents: savings,
    lockedSavingsDepositCents: 0,
    prior,
    settings,
  });
}

/** "2026-10" → "October 2026". */
function monthName(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1, 12)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Whole cents, first partner takes the odd cent. */
function splitEvenly(cents: number, ways: number): number[] {
  const base = Math.floor(cents / ways);
  const extra = cents - base * ways;
  return Array.from({ length: ways }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Index of the partner a setting names (case/space-insensitive), or
 *  -1 when it names nobody we know. */
function partnerIndex(names: string[], by: string | null | undefined): number {
  return by ? names.findIndex((n) => n.toLowerCase() === by.trim().toLowerCase()) : -1;
}

/** Whose capital the savings floor is: all of it to the named partner
 *  when one put it in, otherwise split evenly. */
function savingsShares(cents: number, names: string[], by: string | null | undefined): number[] {
  const owner = partnerIndex(names, by);
  if (owner >= 0) return names.map((_, i) => (i === owner ? cents : 0));
  return splitEvenly(cents, names.length);
}

/** Whose capital a covered shortfall is: all of it to the named
 *  partner, or nobody's (zeros) when the setting is empty — an
 *  out-of-pocket loss is never silently split. */
function coveredShares(cents: number, names: string[], by: string | null | undefined): number[] {
  const payer = partnerIndex(names, by);
  return names.map((_, i) => (i === payer ? cents : 0));
}

/** Marginal-bracket tax on annual dollars — shared by the federal,
 *  NY State, and NYC stacks. Edges drift yearly; close is honest for
 *  a reserve. */
function bracketTaxDollars(
  taxable: number,
  brackets: [number, number][],
): number {
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

/** Federal brackets (annual dollars) — 2025 tables; update each
 *  January when the IRS publishes. Married-filing-separately shares
 *  every edge with single EXCEPT the top of the 35% lane ($375,800 vs
 *  $626,350) — half the joint table. Identical cents below that. */
const FEDERAL_BRACKETS: Record<FilingStatus, [number, number][]> = {
  single: [
    [11925, 0.1],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [626350, 0.35],
    [Infinity, 0.37],
  ],
  married_separate: [
    [11925, 0.1],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [375800, 0.35],
    [Infinity, 0.37],
  ],
};

/** Where the 0.9% Additional Medicare Tax starts (annual SE base):
 *  $200,000 single, $125,000 married filing separately. */
const ADDITIONAL_MEDICARE_THRESHOLD: Record<FilingStatus, number> = {
  single: 200000,
  married_separate: 125000,
};

/** NY State brackets (single filer, annual dollars). */
const NY_STATE_BRACKETS: [number, number][] = [
  [8500, 0.039],
  [11700, 0.044],
  [13900, 0.0515],
  [80650, 0.054],
  [215400, 0.059],
  [1077550, 0.0685],
  [5000000, 0.0965],
  [25000000, 0.103],
  [Infinity, 0.109],
];

/** NYC resident city income tax (single filer, annual dollars) —
 *  stacks ON TOP of NY State with NO credit for other states. */
const NYC_CITY_BRACKETS: [number, number][] = [
  [12000, 0.03078],
  [25000, 0.03762],
  [50000, 0.03819],
  [Infinity, 0.03876],
];

const PA_RATE = 0.0307;
const BETHLEHEM_RATE = 0.01;

/** WHERE EACH PARTNER LIVES decides which governments tax their half
 *  (Wilson 2026-08-26: "pedro lives in new york in the bronx").
 *  - bethlehem_pa (Danisel): PA flat 3.07% + Bethlehem 1% EIT.
 *  - nyc (Pedro): NY State brackets + NYC city tax. PA taxes his
 *    PA-source share first (nonresident, 3.07%) but New York credits
 *    every PA dollar (Form IT-112-R) — never taxed twice; the reserve
 *    only needs NY + NYC, and the PA payment rides inside it. NYC's
 *    city tax has no credit — that's Pedro's real extra cost.
 *  Anyone unlisted defaults to PA. */
type Residence = "bethlehem_pa" | "nyc";
const PARTNER_RESIDENCE: Record<string, Residence> = {
  Danisel: "bethlehem_pa",
  Pedro: "nyc",
};

const RESIDENCE_LABEL: Record<Residence, string> = {
  bethlehem_pa: "Bethlehem, PA",
  nyc: "Bronx, NYC",
};

/** WHEN each partner takes their money out (Wilson 2026-08-26:
 *  "pedro is doing yearly" — one December draw with his accountant;
 *  Danisel transfers on the 27th). Distribution timing is each
 *  member's own election and does NOT change taxes: envelopes still
 *  go out quarterly in each name — waiting doesn't delay taxes. */
const PARTNER_PAYOUT: Record<string, "monthly" | "december"> = {
  Danisel: "monthly",
  Pedro: "december",
};

/** HOW each partner files federally (Wilson 2026-09-02: "Danisel is my
 *  wife but we file separate … Married but separated"; Pedro single
 *  until told otherwise). Only the federal table and the Additional
 *  Medicare threshold differ; NY, NYC, PA and Bethlehem don't care. */
export const PARTNER_FILING: Record<string, FilingStatus> = {
  Danisel: "married_separate",
  Pedro: "single",
};

/** WHEN each partner sends their estimated taxes (Wilson 2026-09-02:
 *  "Taxes in Bethlehem have to be paid 4 times a year, Pedro pays his
 *  in December once"). Danisel: IRS + PA on Apr 15 / Jun 15 / Sep 15 /
 *  Jan 15, Bethlehem via Keystone Collections on Apr 15 / Jul 15 /
 *  Oct 15 / Jan 15 (keystonecollects.com FAQ). Pedro: one payment in
 *  December, his election with his accountant. */
const PARTNER_TAX_SCHEDULE: Record<string, TaxSchedule> = {
  Danisel: "quarterly",
  Pedro: "december",
};

/** IRS 1040-ES and PA-40 ES share these; NY IT-2105 too. */
const ESTIMATE_DUE_MMDD = ["04-15", "06-15", "09-15", "01-15"];
/** Bethlehem EIT quarterly estimates through Keystone Collections. */
const KEYSTONE_DUE_MMDD = ["04-15", "07-15", "10-15", "01-15"];

/** The first due date on or after `fromYmd` (YYYY-MM-DD), as
 *  "Sep 15, 2026". Jan 15 belongs to the following year. */
function nextDueDate(fromYmd: string, mmdds: string[]): string {
  const y = Number.parseInt(fromYmd.slice(0, 4), 10);
  const candidates = mmdds
    .flatMap((mmdd) => [`${y}-${mmdd}`, `${y + 1}-${mmdd}`])
    .filter((d) => d >= fromYmd)
    .sort();
  const [yy, mm, dd] = candidates[0].split("-").map((n) => Number.parseInt(n, 10));
  return new Date(Date.UTC(yy, mm - 1, dd, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** What's due next for a partner after this month's transfer day —
 *  one line, written here, shown on the card, the statement, and the
 *  27th sheet. Not tax advice; dates are the published ones. */
function taxDueNote(
  name: string,
  residence: Residence,
  schedule: TaxSchedule,
  transferDayYmd: string,
  heldCents: number,
): string {
  const held = (heldCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (schedule === "december") {
    return `${name} pays once, in December (his election): held for him now ${held}. December's sheet lists it with his draw.`;
  }
  const est = nextDueDate(transferDayYmd, ESTIMATE_DUE_MMDD);
  if (residence === "nyc") {
    return `${name} pays four times a year: IRS + NY State/NYC estimates next due ${est}. Held for ${name} now ${held}.`;
  }
  const keystone = nextDueDate(transferDayYmd, KEYSTONE_DUE_MMDD);
  return `${name} pays four times a year: IRS + PA estimates next due ${est}; Bethlehem (Keystone) next due ${keystone}. Held for ${name} now ${held}.`;
}

function residenceTaxNote(name: string, residence: Residence, filing: FilingStatus, schedule: TaxSchedule): string {
  const files = filing === "married_separate" ? "files married-filing-separately" : "files single";
  const cadence =
    schedule === "december"
      ? `Paid once a year, in December, in ${name}'s own name.`
      : `Paid four times a year in ${name}'s own name.`;
  return residence === "nyc"
    ? `${name}'s half is taxed by New York: NY State brackets + NYC city tax + self-employment + federal (${files}). PA taxes the share first (3.07%) and New York subtracts every PA dollar (Form IT-112-R) — taxed once, never twice; the city tax is the extra. ${cadence}`
    : `${name}'s half is taxed in Pennsylvania: PA flat 3.07% + Bethlehem 1% local + self-employment + federal (${files}). ${cadence}`;
}

const ZERO_PARTS: TaxParts = {
  seCents: 0,
  federalCents: 0,
  stateCents: 0,
  cityCents: 0,
  localCents: 0,
  paNonresidentCents: 0,
  totalCents: 0,
};

/** Per-partner monthly tax reserve for their LLC profit share,
 *  itemized: SE (SS wage-base capped, Medicare uncapped + 0.9%
 *  additional) + the RESIDENCE's state/local stack + federal brackets
 *  on the annualized share (minus the deductible half of SE).
 *  Deliberately conservative: no standard deduction or QBI assumed. */
export function taxPartsForShareCents(
  shareCents: number,
  residence: Residence,
  filing: FilingStatus = "single",
): TaxParts {
  if (shareCents <= 0) return ZERO_PARTS;
  const seBaseAnnualDollars = (shareCents * 0.9235 * 12) / 100;
  const ssAnnual = Math.min(seBaseAnnualDollars, 176100) * 0.124;
  const medicareAnnual =
    seBaseAnnualDollars * 0.029 +
    Math.max(0, seBaseAnnualDollars - ADDITIONAL_MEDICARE_THRESHOLD[filing]) * 0.009;
  const seCents = ((ssAnnual + medicareAnnual) * 100) / 12;
  const annualTaxable = Math.max(0, (shareCents - seCents / 2) * 12) / 100;
  const federalCents =
    (bracketTaxDollars(annualTaxable, FEDERAL_BRACKETS[filing]) * 100) / 12;
  let stateCents = 0;
  let cityCents = 0;
  let localCents = 0;
  let paNonresidentCents = 0;
  if (residence === "nyc") {
    const ny = (bracketTaxDollars(annualTaxable, NY_STATE_BRACKETS) * 100) / 12;
    const pa = shareCents * PA_RATE;
    // PA is paid first; NY credits it up to NY's own tax on the same
    // income. Reserve the bigger of the two — that's the real total.
    stateCents = Math.max(ny, pa);
    paNonresidentCents = Math.min(pa, stateCents);
    cityCents = (bracketTaxDollars(annualTaxable, NYC_CITY_BRACKETS) * 100) / 12;
  } else {
    stateCents = shareCents * PA_RATE;
    localCents = shareCents * BETHLEHEM_RATE;
  }
  const r = Math.round;
  const parts = {
    seCents: r(seCents),
    federalCents: r(federalCents),
    stateCents: r(stateCents),
    cityCents: r(cityCents),
    localCents: r(localCents),
    paNonresidentCents: r(paNonresidentCents),
  };
  return {
    ...parts,
    totalCents:
      parts.seCents + parts.federalCents + parts.stateCents + parts.cityCents + parts.localCents,
  };
}

/** The ladder is per residence; it uses the filing status of the
 *  partner who lives there (Danisel in PA, Pedro in NYC). */
function filingForResidence(residence: Residence): FilingStatus {
  const who = Object.keys(PARTNER_RESIDENCE).find((n) => PARTNER_RESIDENCE[n] === residence);
  return (who && PARTNER_FILING[who]) || "single";
}

function taxSaveForShareCents(shareCents: number, residence: Residence): number {
  return taxPartsForShareCents(shareCents, residence, filingForResidence(residence)).totalCents;
}

/** THE LADDER (Wilson 2026-08-26: "write somewhere the amount → tax
 *  rate so we always know what to put into savings"). Computed from
 *  the SAME formula at sample monthly-profit levels — it can never
 *  drift from the card's math. Rates are marginal-stacked: only the
 *  dollars past each rung pay the higher lanes. */
export function taxLadder(): {
  profitCents: number;
  ratePct: number;
  ratePctPA: number;
  ratePctNYC: number;
}[] {
  const samples = [
    100000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 100000000,
  ];
  return samples.map((profitCents) => {
    const share = profitCents / 2;
    const pa =
      Math.round((taxSaveForShareCents(share, "bethlehem_pa") / share) * 1000) /
      10;
    const nyc =
      Math.round((taxSaveForShareCents(share, "nyc") / share) * 1000) / 10;
    return { profitCents, ratePct: pa, ratePctPA: pa, ratePctNYC: nyc };
  });
}

/** Stripe's real fee shape: a percentage of each charge plus a fixed
 *  per-charge amount. Applied to the month's totals — identical to
 *  summing per charge, minus sub-cent rounding. */
export function webProcessingFee(
  grossWebCents: number,
  chargeCount: number,
  settings: Pick<BusinessSettings, "web_processing_rate" | "web_processing_fixed_cents">,
): number {
  if (grossWebCents <= 0) return 0;
  return (
    Math.round(grossWebCents * Number(settings.web_processing_rate)) +
    chargeCount * Math.max(0, Math.round(Number(settings.web_processing_fixed_cents ?? 0)))
  );
}

/** The one place the formula lives — the real month and the example
 *  both flow through here, so they can never disagree. */
export function computeBreakdown(inputs: {
  month: string;
  monthLabel: string;
  periodLabel?: string;
  grossWebCents: number;
  webChargeCount: number;
  grossStoreCents: number;
  /** Real commission (from RevenueCat take-home) when every row had
   *  it; otherwise omitted and the estimate rate applies. */
  storeCommissionCents?: number;
  storeCommissionActual: boolean;
  anthropicCents: number;
  replicateCents: number;
  refundedCents: number;
  /** Money that LEFT this month for sales counted earlier: refunds of
   *  prior months' charges (the whole amount — Stripe keeps its fee,
   *  Apple/Google claw back the net) plus the card fees Stripe kept on
   *  charges refunded inside this window. An expense line, so profit
   *  and every split absorb it; NOT a bill, so it doesn't inflate next
   *  month's reserve target. */
  refundClawbackCents?: number;
  /** Net receipts from the window's tail days → Marketing account. */
  retainedTailCents?: number;
  contributionsPerMemberCents: number;
  /** The savings floor: balance sitting there + this month's deposit. */
  lockedSavingsCents?: number;
  lockedSavingsDepositCents?: number;
  /** Estimated-tax payments sent this month, keyed by partner name as
   *  written on the settings row (matched case-insensitively). */
  taxPaymentsByPartner?: Record<string, TaxPaymentLine[]>;
  /** The day the "next due" reminders count from (YYYY-MM-DD). A
   *  live month passes today so Sep 3 still says "Sep 15"; a freeze
   *  leaves it out and the transfer day (the 27th) applies, which is
   *  what the sheet reads. */
  asOfYmd?: string;
  prior: PriorBalances;
  settings: BusinessSettings;
}): MonthBreakdown {
  const { settings, prior } = inputs;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const lockedSavingsCents = Math.max(0, Math.round(inputs.lockedSavingsCents ?? 0));
  const lockedSavingsDepositCents = Math.min(
    lockedSavingsCents,
    Math.max(0, Math.round(inputs.lockedSavingsDepositCents ?? 0)),
  );
  const grossCents = inputs.grossWebCents + inputs.grossStoreCents;
  const storeCommissionCents =
    inputs.storeCommissionCents ??
    Math.round(inputs.grossStoreCents * Number(settings.store_commission_rate));
  const webProcessingCents = webProcessingFee(
    inputs.grossWebCents,
    inputs.webChargeCount,
    settings,
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
  const refundClawbackCents = Math.max(0, Math.round(inputs.refundClawbackCents ?? 0));
  if (refundClawbackCents > 0) {
    expenses.push({
      name: "Refunds — earlier months clawed back + card fees Stripe kept",
      cents: refundClawbackCents,
      estimated: false,
    });
  }
  const totalExpensesCents = expenses.reduce((a, e) => a + e.cents, 0);
  const profitCents = netReceiptsCents - totalExpensesCents;

  // STEP 1 — TAX ENVELOPES (Wilson 2026-08-26: Pedro is in the Bronx —
  // NY State + NYC tax his half; PA + Bethlehem tax Danisel's). Each
  // envelope is computed on that partner's OWN half with THEIR state
  // stack, and comes out of THEIR half — so transfers can differ. The
  // BUSINESS holds the envelopes (standard partnership practice —
  // paid at quarterly estimated-tax time), so what reaches a partner's
  // bank is 100% spendable. Nothing is taxed twice — the LLC→bank move
  // is not a taxable event.
  const shareCents = profitCents > 0 ? profitCents / 2 : 0;
  const partnerNames = [
    settings.partner_a ?? "Pedro",
    settings.partner_b ?? "Danisel",
  ];
  const partnerCalc = partnerNames.map((name) => {
    const residence = PARTNER_RESIDENCE[name] ?? "bethlehem_pa";
    const filing = PARTNER_FILING[name] ?? "single";
    const schedule = PARTNER_TAX_SCHEDULE[name] ?? "quarterly";
    const parts =
      profitCents > 0 ? taxPartsForShareCents(shareCents, residence, filing) : ZERO_PARTS;
    return { name, residence, filing, schedule, parts, envelope: parts.totalCents };
  });
  // Taxes actually sent this month, in each name (tax_payments). Keys
  // are matched the way every other partner setting is.
  const taxPaymentsByPartner = partnerNames.map((name) => {
    const entries = Object.entries(inputs.taxPaymentsByPartner ?? {});
    const hit = entries.find(([k]) => k.trim().toLowerCase() === name.toLowerCase());
    const lines = (hit?.[1] ?? []).map((l) => ({
      paidOn: l.paidOn,
      government: l.government,
      amountCents: Math.max(0, Math.round(num(l.amountCents))),
      note: l.note ?? null,
    }));
    return { lines, paidCents: lines.reduce((a, l) => a + l.amountCents, 0) };
  });
  // Due dates count from the day being looked at — today for a live
  // month, the transfer day (the 27th) for the freeze and the sheet.
  const transferDayYmd = /^\d{4}-\d{2}$/.test(inputs.month)
    ? settlementWindow(inputs.month).end.toISOString().slice(0, 10)
    : "2026-09-27";
  const asOfYmd = /^\d{4}-\d{2}-\d{2}$/.test(inputs.asOfYmd ?? "") ? inputs.asOfYmd! : transferDayYmd;
  const taxReserveCents = partnerCalc[0].envelope + partnerCalc[1].envelope;
  const taxReserveRate =
    shareCents > 0
      ? taxReserveCents / (shareCents * 2)
      : Number(settings.tax_reserve_rate);

  // STEP 2 — THE OPERATING RESERVE (Wilson's holdback rule 2026-08-26,
  // made a balance 2026-09-02; "leave in money monthly before profit
  // based on usage and possible growth and OE" 2026-09-02). Target =
  // next month's bills + a cushion. BILLS = the fixed subs PLUS this
  // month's usage costs (Anthropic + Replicate) — next month will cost
  // at least what this month did, and Apple pays a month behind, so
  // the account must be able to carry a full month of running costs
  // before the sales money lands. CUSHION = the BIGGER of 50% of bills
  // (room for usage to grow half again) or 10% of profit (great months
  // bank real growth money). The account fills the reserve ONCE and
  // only tops it up when it's below target; it is never deducted again
  // every month. The members' 1st-of-month contributions land here
  // first, so profit has less to cover.
  // A refund clawback is a one-off, not next month's bill.
  const billsCents = totalExpensesCents - refundClawbackCents;
  const cushionCents = Math.max(
    Math.round(billsCents * 0.5),
    profitCents > 0 ? Math.round(profitCents * 0.1) : 0,
  );
  const reserveTargetCents = billsCents + cushionCents;
  const contributionsPerMemberCents = Math.max(0, inputs.contributionsPerMemberCents);
  const contributionsCents = contributionsPerMemberCents * partnerNames.length;
  // `?? 0` everywhere a carried balance is read: Math.max(0, undefined)
  // is NaN, and one NaN would print "$NaN" on the transfer sheet.
  const reserveCarriedCents = Math.max(0, prior.reserveCents ?? 0);
  const reserveBeforeCents = reserveCarriedCents + contributionsCents;

  // STEP 3 — THE MARKETING ACCOUNT at Navy Federal (Wilson's
  // compounding rule 2026-08-26; "from the 27th to the 1st that's a
  // transfer to a separate bank account" and "the marketing account
  // is where the money made from the 27th to the 1st" 2026-09-02):
  // money made in the window's tail moves out to the Marketing
  // account on the 27th — never distributed. Its TAXES are in step 1
  // (pass-through taxes all profit, moved or not).
  const retainedTailCents = Math.max(0, Math.round(inputs.retainedTailCents ?? 0));

  let reserveTopUpCents = 0;
  let reserveDrawCents = 0;
  let shortfallCents = 0;
  let growthTransferCents = 0;
  let transferCentsA = 0;
  let transferCentsB = 0;
  if (profitCents > 0) {
    let pool = Math.max(0, profitCents - taxReserveCents);
    reserveTopUpCents = Math.min(pool, Math.max(0, reserveTargetCents - reserveBeforeCents));
    pool -= reserveTopUpCents;
    growthTransferCents = Math.min(pool, retainedTailCents);
    pool -= growthTransferCents;
    // STEP 4 — FAIR SPLIT WITH UNEQUAL ENVELOPES: each partner's
    // entitlement = their half of profit − their half of the common
    // holds (reserve top-up + growth) − their OWN tax envelope.
    // Pedro's NY+NYC envelope is bigger than Danisel's PA one, so his
    // number is smaller — his taxes never eat into her half. The two
    // raw numbers always sum to the pool (≥ 0), so if one partner's
    // half can't cover their envelope in a tiny month, the other
    // partner's raw number absorbs the difference and both stay ≥ 0.
    const commonHalf = (reserveTopUpCents + growthTransferCents) / 2;
    let rawA = shareCents - commonHalf - partnerCalc[0].envelope;
    let rawB = shareCents - commonHalf - partnerCalc[1].envelope;
    if (rawA < 0) {
      rawB += rawA;
      rawA = 0;
    }
    if (rawB < 0) {
      rawA += rawB;
      rawB = 0;
    }
    // The pool is whole cents; the two raws can each be x.5 when the
    // profit or the common holds are odd. Flooring both would leave a
    // cent in the bank that no column owns — so A is floored and B
    // gets the remainder (the odd cent lands on the monthly partner).
    // transfers + envelopes + top-up + Marketing = profit, exactly.
    transferCentsA = Math.max(0, Math.min(pool, Math.floor(rawA)));
    transferCentsB = Math.max(0, pool - transferCentsA);
  } else if (profitCents < 0) {
    // A LOSS MONTH: the reserve exists for exactly this. Whatever it
    // can't cover is a shortfall the members covered out of pocket —
    // flagged, never hidden.
    const loss = -profitCents;
    reserveDrawCents = Math.min(loss, reserveBeforeCents);
    shortfallCents = loss - reserveDrawCents;
  }
  const reserveAfterCents = reserveBeforeCents + reserveTopUpCents - reserveDrawCents;
  const growthBalanceCents = Math.max(0, prior.growthCents ?? 0) + growthTransferCents;
  const distributableCents = transferCentsA + transferCentsB;
  // Legacy "each" fields (older mobile builds read these): the average
  // — totals stay exact, per-partner truth lives in `partners`.
  const transferPerPartnerCents = Math.floor(distributableCents / 2);
  const taxSavingsPerPartnerCents = Math.round(taxReserveCents / 2);
  const perPartnerCents = transferPerPartnerCents;

  const isDecember = inputs.month.endsWith("-12");
  // The savings floor is the capital of whoever put it in (Danisel,
  // per Wilson) — or split evenly when the setting names nobody.
  const savingsByPartner = savingsShares(
    lockedSavingsDepositCents,
    partnerNames,
    settings.locked_savings_by,
  );
  // A loss the reserve couldn't cover was paid by someone. When the
  // setting names them, it's their capital (owed back, like the
  // $175s); when it doesn't, it stays flagged and unassigned.
  const coveredByPartner = coveredShares(
    shortfallCents,
    partnerNames,
    settings.shortfall_paid_by,
  );
  const shortfallCoveredCents = coveredByPartner.reduce((a, c) => a + c, 0);
  const shortfallPaidBy =
    shortfallCoveredCents > 0
      ? partnerNames[partnerIndex(partnerNames, settings.shortfall_paid_by)]
      : null;
  const partners: PartnerBreakdown[] = partnerCalc.map((p, i) => {
    const transferCents = i === 0 ? transferCentsA : transferCentsB;
    const payout = PARTNER_PAYOUT[p.name] ?? "monthly";
    const priorP = prior.partners?.[p.name] ?? { potCents: 0, taxHeldCents: 0, capitalCents: 0 };
    const savingsDepositCents = savingsByPartner[i];
    const shortfallCoveredCents = coveredByPartner[i];
    // THE DECEMBER POT (Wilson 2026-08-26: Pedro draws once a year
    // with his accountant): entitlements pile up in the account and
    // leave all at once in December's settlement.
    const potBeforeCents = payout === "december" ? Math.max(0, priorP.potCents ?? 0) : 0;
    const drawCents =
      payout === "december"
        ? isDecember
          ? potBeforeCents + transferCents
          : 0
        : transferCents;
    const undrawnBalanceCents =
      payout === "december" ? potBeforeCents + transferCents - drawCents : 0;
    // TAXES HELD → PAID. The envelope joins what's held; what they sent
    // this month in their own name comes out. A negative balance means
    // the business advanced them more than it held — flagged, never
    // hidden, and the next envelopes fill it back.
    const taxHeldBeforeCents = num(priorP.taxHeldCents);
    const taxPaidCents = taxPaymentsByPartner[i].paidCents;
    const taxHeldCents = taxHeldBeforeCents + p.envelope - taxPaidCents;
    return {
      name: p.name,
      residence: RESIDENCE_LABEL[p.residence],
      profitShareCents: Math.round(shareCents),
      taxEnvelopeCents: p.envelope,
      taxParts: p.parts,
      taxRatePct:
        shareCents > 0 ? Math.round((p.envelope / shareCents) * 1000) / 10 : 0,
      transferCents,
      drawCents,
      payout,
      potBeforeCents,
      undrawnBalanceCents,
      taxHeldBeforeCents,
      taxPaidCents,
      taxPayments: taxPaymentsByPartner[i].lines,
      taxHeldCents,
      taxOverpaidCents: Math.max(0, -taxHeldCents),
      filingStatus: p.filing,
      taxSchedule: p.schedule,
      taxDueNote: taxDueNote(p.name, p.residence, p.schedule, asOfYmd, taxHeldCents),
      contributionCents: contributionsPerMemberCents,
      savingsDepositCents,
      shortfallCoveredCents,
      capitalCents:
        Math.max(0, priorP.capitalCents ?? 0) +
        contributionsPerMemberCents +
        savingsDepositCents +
        shortfallCoveredCents,
      taxNote: residenceTaxNote(p.name, p.residence, p.filing, p.schedule),
    };
  });

  const taxHeldTotalCents = partners.reduce((a, p) => a + p.taxHeldCents, 0);
  const taxPaidTotalCents = partners.reduce((a, p) => a + p.taxPaidCents, 0);
  const potsAfter = partners.reduce((a, p) => a + p.undrawnBalanceCents, 0);
  const paidOutCents =
    partners.reduce((a, p) => a + p.drawCents, 0) + growthTransferCents;

  // THE VERDICT on the $175s (Wilson 2026-09-02: "until we make enough
  // profit to sustain everything"): sustaining = this month covered
  // its own bills AND the reserve is full. Until then, say what's
  // still missing.
  const selfSustaining = profitCents > 0 && reserveAfterCents >= reserveTargetCents;
  const fmt = (c: number) =>
    (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const each = fmt(contributionsPerMemberCents);
  let contributionsVerdict: string;
  if (selfSustaining) {
    contributionsVerdict =
      contributionsCents > 0
        ? `This month paid for itself and the reserve is full (${fmt(reserveAfterCents)} of ${fmt(reserveTargetCents)}) — the ${each} contributions can stop.`
        : `This month paid for itself and the reserve is full (${fmt(reserveAfterCents)} of ${fmt(reserveTargetCents)}) — no contributions needed.`;
  } else if (profitCents === 0) {
    contributionsVerdict = "Broke even — nothing to split, nothing lost.";
  } else if (profitCents < 0) {
    // Say exactly who carried the loss: the $175s, the reserve, or the
    // members' pockets — and, before the $175s begin, when they begin.
    const short = fmt(-profitCents);
    const start = settings.member_contributions_start_month;
    const configured = Math.max(0, Math.round(Number(settings.member_contribution_cents ?? 0)));
    const later =
      contributionsCents === 0 && start && inputs.month !== "0000-00" && inputs.month < start && configured > 0
        ? ` The ${fmt(configured)} each starts ${monthName(start)}.`
        : "";
    // "came out of pocket" names the payer when the books know who.
    const pocket = shortfallPaidBy
      ? `${shortfallPaidBy} covered ${fmt(shortfallCents)} out of pocket (booked as capital — the business owes it back)`
      : `${fmt(shortfallCents)} came out of pocket (nobody booked yet)`;
    if (contributionsCents > 0 && shortfallCents === 0) {
      contributionsVerdict = `Sales didn't cover the bills this month (short ${short}) — the ${each} each is what kept the account whole. Keep them coming.`;
    } else if (contributionsCents > 0) {
      contributionsVerdict = `Sales didn't cover the bills this month (short ${short}) — the ${each} each and the reserve covered ${fmt(reserveDrawCents)}; ${pocket}. Keep them coming.`;
    } else if (reserveDrawCents > 0 && shortfallCents === 0) {
      contributionsVerdict = `Sales didn't cover the bills this month (short ${short}) — the reserve covered it (${fmt(reserveAfterCents)} left).${later}`;
    } else if (reserveDrawCents > 0) {
      contributionsVerdict = `Sales didn't cover the bills this month (short ${short}) — the reserve covered ${fmt(reserveDrawCents)} and ran out; ${pocket}.${later}`;
    } else {
      contributionsVerdict = `Sales didn't cover the bills this month (short ${short}) — no reserve yet, so ${pocket}.${later}`;
    }
  } else {
    contributionsVerdict = `Profitable, but the reserve is still filling (${fmt(reserveAfterCents)} of ${fmt(reserveTargetCents)}) — ${contributionsCents > 0 ? `keep the ${each} each going for now.` : "no contributions coming in; profit is filling it."}`;
  }

  const out: MonthBreakdown = {
    month: inputs.month,
    monthLabel: inputs.monthLabel,
    periodLabel:
      inputs.periodLabel ?? "counting the 27th → the 26th · final on the 27th",
    frozen: false,
    settledAt: null,
    settledBy: null,
    settlementNote: null,
    grossWebCents: inputs.grossWebCents,
    grossStoreCents: inputs.grossStoreCents,
    grossCents,
    storeCommissionCents,
    storeCommissionActual: inputs.storeCommissionActual,
    webProcessingCents,
    webChargeCount: inputs.webChargeCount,
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
    profitShareCents: Math.round(shareCents),
    partnerA: partnerNames[0],
    partnerB: partnerNames[1],
    keepInAccountCents: taxReserveCents + reserveTopUpCents,
    billsCents,
    cushionCents,
    refundedCents: inputs.refundedCents,
    reserveTargetCents,
    reserveCarriedCents,
    reserveBeforeCents,
    reserveTopUpCents,
    reserveDrawCents,
    reserveAfterCents,
    shortfallCents,
    shortfallCoveredCents,
    shortfallPaidBy,
    retainedTailCents,
    growthTransferCents,
    growthBalanceCents,
    contributionsPerMemberCents,
    contributionsCents,
    selfSustaining,
    contributionsVerdict,
    lockedSavingsCents,
    lockedSavingsDepositCents,
    taxHeldTotalCents,
    taxPaidTotalCents,
    // The operating account only — the savings floor is its own
    // account and its own line. Taxes held is AFTER what was sent.
    accountShouldHoldCents: reserveAfterCents + taxHeldTotalCents + potsAfter,
    paidOutCents,
    taxLadder: taxLadder(),
    partners,
    summary: "",
    upcoming: [],
  };
  return { ...out, summary: plainSummary(out), upcoming: upcomingLines(out, settings) };
}

/** The month, the way Wilson asked to read it first: what came in,
 *  what stays, what each partner gets. First-grader English, whole
 *  dollars are fine here — the exact cents sit in the rows below. */
export function plainSummary(b: MonthBreakdown): string {
  const usd = (c: number) =>
    (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const pedro = b.partners.find((p) => p.payout === "december");
  const monthly = b.partners.filter((p) => p.payout !== "december");
  const isDecember = b.month.endsWith("-12");
  const lines: string[] = [];
  if (b.grossCents === 0 && b.profitCents === 0) {
    return "Nothing came in this month, and nothing went out.";
  }
  if (b.profitCents > 0) {
    lines.push(
      `This month the business made ${usd(b.profitCents)} after fees and bills (${usd(b.grossCents)} came in).`,
    );
    const stays: string[] = [];
    if (b.taxReserveCents > 0) stays.push(`${usd(b.taxReserveCents)} for taxes`);
    if (b.reserveTopUpCents > 0) stays.push(`${usd(b.reserveTopUpCents)} to fill the bills reserve`);
    if (stays.length) lines.push(`${usd(b.taxReserveCents + b.reserveTopUpCents)} stays in the account — ${stays.join(" and ")}.`);
    if (b.growthTransferCents > 0) lines.push(`${usd(b.growthTransferCents)} goes to the Marketing account (the money made after the 27th).`);
    for (const p of monthly) {
      lines.push(p.transferCents > 0 ? `${p.name} can take ${usd(p.transferCents)}.` : `Nothing left for ${p.name} this month — taxes and the reserve took her share.`);
    }
    if (pedro) {
      if (isDecember) lines.push(`It's December: ${pedro.name} takes his whole pot, ${usd(pedro.drawCents)}.`);
      else lines.push(`${pedro.name}'s December pot is now ${usd(pedro.undrawnBalanceCents)} (${usd(pedro.transferCents)} added this month).`);
    }
  } else if (b.profitCents < 0) {
    lines.push(`This month the business lost ${usd(-b.profitCents)} — ${usd(b.grossCents)} came in, but fees and bills were more.`);
    if (b.reserveDrawCents > 0) lines.push(`The reserve covered ${usd(b.reserveDrawCents)}.`);
    if (b.shortfallCents > 0) {
      lines.push(
        b.shortfallPaidBy
          ? `${b.shortfallPaidBy} covered ${usd(b.shortfallCents)} out of pocket.`
          : `${usd(b.shortfallCents)} still has to come from a partner's pocket.`,
      );
    }
    lines.push(
      pedro && isDecember && pedro.drawCents > 0
        ? `Nothing to split — but it's December, so ${pedro.name} still takes his pot, ${usd(pedro.drawCents)}.`
        : "Nothing goes to the partners this month.",
    );
  } else {
    lines.push(`Broke even this month — ${usd(b.grossCents)} came in and it all went to fees and bills. Nothing to split.`);
  }
  if (b.contributionsCents > 0) lines.push(`The partners put in ${usd(b.contributionsCents)} on the 1st; it sits in the reserve.`);
  if (b.taxPaidTotalCents > 0) lines.push(`${usd(b.taxPaidTotalCents)} in taxes was sent this month in their own names.`);
  lines.push(`After the 27th the account should hold ${usd(b.accountShouldHoldCents)}.`);
  return lines.join(" ");
}

/** What's coming after this month, one line each. */
export function upcomingLines(b: MonthBreakdown, settings: BusinessSettings): string[] {
  const usd = (c: number) =>
    (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const next = /^\d{4}-\d{2}$/.test(b.month) ? nextMonth(b.month) : b.month;
  const nextLabel = /^\d{4}-\d{2}$/.test(next)
    ? new Date(Date.UTC(Number(next.slice(0, 4)), Number(next.slice(5, 7)) - 1, 1)).toLocaleString("en-US", { month: "long", timeZone: "UTC" })
    : "next month";
  const lines: string[] = [];
  const each = contributionForMonth(settings, next);
  if (each > 0) lines.push(`On the 1st: ${b.partners.map((p) => p.name).join(" and ")} each put in ${usd(each)}.`);
  lines.push("On the 1st: type in what Navy Federal shows in the Marketing account.");
  lines.push(`${nextLabel}'s bills: about ${usd(b.billsCents)} (the reserve target is ${usd(b.reserveTargetCents)}${b.reserveAfterCents >= b.reserveTargetCents ? " — already there" : `, ${usd(b.reserveAfterCents)} in it now`}).`);
  for (const p of b.partners) if (p.taxDueNote) lines.push(p.taxDueNote);
  lines.push("On the 27th: transfer day — the sheet arrives by email and this month goes final.");
  return lines;
}

export async function loadSettings(supabase: SupabaseClient): Promise<BusinessSettings> {
  const { data, error } = await supabase
    .from("business_settings")
    .select(SETTINGS_COLUMNS)
    .eq("id", true)
    .maybeSingle();
  // A failed read must never fall back to the defaults (no fixed
  // costs) and get frozen as FINAL — supabase-js returns errors, it
  // doesn't throw them, so throw here.
  if (error) throw new Error(`business_settings: ${error.message}`);
  return { ...DEFAULT_SETTINGS, ...(data ?? {}) } as BusinessSettings;
}

/** Example with the LIVE settings (rates + fixed costs) applied. */
export async function fetchExampleBreakdown(
  supabase: SupabaseClient,
): Promise<MonthBreakdown> {
  return exampleMonthBreakdown(await loadSettings(supabase));
}

/** SETTLEMENT WINDOW (Wilson 2026-08-26, final): month M counts the
 *  27th of the PREVIOUS month through the 26th of M, and goes FINAL
 *  on M's 27th — transfer day. Sales on the 27th-31st belong to the
 *  NEXT month's window, so settled numbers can never move after the
 *  transfer. Boundary pinned at midnight EST (05:00 UTC) year-round
 *  for determinism; the one-hour summer skew is deliberate. */
export function settlementWindow(month: string): {
  start: Date;
  end: Date;
  tailEnd: Date;
  periodLabel: string;
  monthLabel: string;
} {
  const [yStr, mStr] = month.split("-");
  const y = Number.parseInt(yStr, 10);
  const m = Number.parseInt(mStr, 10); // 1-12
  const start = new Date(Date.UTC(y, m - 2, 27, 5, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, 27, 5, 0, 0));
  // The tail: window start (prev 27th) → the 1st of the settlement
  // month. Revenue in here is the Marketing-account money.
  const tailEnd = new Date(Date.UTC(y, m - 1, 1, 5, 0, 0));
  const fmtDay = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });
  const lastDay = new Date(end.getTime() - 24 * 3600 * 1000);
  return {
    start,
    end,
    tailEnd,
    periodLabel: `counting ${fmtDay(start)} → ${fmtDay(lastDay)} · final on the 27th`,
    monthLabel: new Date(Date.UTC(y, m - 1, 1, 12)).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }),
  };
}

/** Has month M's transfer day arrived? */
export function isSettleable(month: string, now = new Date()): boolean {
  return month >= LAUNCH_MONTH && now.getTime() >= settlementWindow(month).end.getTime();
}

type SettlementRow = {
  breakdown: MonthBreakdown;
  settled_at: string;
  settled_by: "cron" | "lazy" | "admin";
  note: string | null;
  reserve_balance_cents: number;
  growth_balance_cents: number;
  partner_balances: PriorBalances["partners"];
};

function fromFrozen(row: SettlementRow): MonthBreakdown {
  const b: MonthBreakdown = {
    ...row.breakdown,
    // Rows frozen before the savings floor existed (August 2026) have
    // no such fields — read them as zero, never undefined.
    lockedSavingsCents: row.breakdown.lockedSavingsCents ?? 0,
    lockedSavingsDepositCents: row.breakdown.lockedSavingsDepositCents ?? 0,
    shortfallCoveredCents: row.breakdown.shortfallCoveredCents ?? 0,
    shortfallPaidBy: row.breakdown.shortfallPaidBy ?? null,
    taxPaidTotalCents: row.breakdown.taxPaidTotalCents ?? 0,
    partners: row.breakdown.partners.map((p) => ({
      ...p,
      savingsDepositCents: p.savingsDepositCents ?? 0,
      shortfallCoveredCents: p.shortfallCoveredCents ?? 0,
      // Rows frozen before tax payments existed: nothing was paid, so
      // "before" is held minus this month's envelope.
      taxHeldBeforeCents: p.taxHeldBeforeCents ?? (p.taxHeldCents ?? 0) - (p.taxEnvelopeCents ?? 0),
      taxPaidCents: p.taxPaidCents ?? 0,
      taxPayments: p.taxPayments ?? [],
      taxHeldCents: p.taxHeldCents ?? 0,
      taxOverpaidCents: p.taxOverpaidCents ?? 0,
      filingStatus: p.filingStatus ?? PARTNER_FILING[p.name] ?? "single",
      taxSchedule: p.taxSchedule ?? PARTNER_TAX_SCHEDULE[p.name] ?? "quarterly",
      taxDueNote: p.taxDueNote ?? "",
    })),
    frozen: true,
    settledAt: row.settled_at,
    settledBy: row.settled_by,
    settlementNote: row.note,
    // The ladder is static — refresh it so a frozen row never shows a
    // stale table if the engine's samples ever change.
    taxLadder: taxLadder(),
  };
  // Rows frozen before the summary existed: write it from the frozen
  // numbers — the same words the live month would have had.
  return {
    ...b,
    summary: b.summary || plainSummary(b),
    upcoming: b.upcoming ?? upcomingLines(b, DEFAULT_SETTINGS),
  };
}

function balancesAfter(b: MonthBreakdown): PriorBalances {
  return {
    reserveCents: b.reserveAfterCents,
    growthCents: b.growthBalanceCents,
    settledAt: b.frozen ? b.settledAt : null,
    partners: Object.fromEntries(
      b.partners.map((p) => [
        p.name,
        {
          potCents: p.undrawnBalanceCents,
          taxHeldCents: p.taxHeldCents,
          capitalCents: p.capitalCents,
        },
      ]),
    ),
  };
}

/**
 * The month's numbers — frozen row if the month is settled, else a
 * live computation on top of the previous month's balances. Once a
 * month's transfer day has passed, the first read writes it to the
 * ledger (the 27th cron normally gets there first; a page view is the
 * fallback), and every read after returns the same frozen row.
 */
export async function fetchMonthBreakdown(
  supabase: SupabaseClient,
  month: string, // "YYYY-MM"
  opts: { settledBy?: "cron" | "lazy" | "admin" } = {},
): Promise<MonthBreakdown> {
  const frozen = await supabase
    .from("settlements")
    .select(
      "breakdown, settled_at, settled_by, note, reserve_balance_cents, growth_balance_cents, partner_balances",
    )
    .eq("month", month)
    .maybeSingle();
  if (frozen.error) throw new Error(`settlements read (${month}): ${frozen.error.message}`);
  if (frozen.data) return fromFrozen(frozen.data as SettlementRow);

  // Balances carry forward from the previous month (which settles
  // itself on the way if its transfer day has passed).
  const prior =
    month > LAUNCH_MONTH
      ? balancesAfter(await fetchMonthBreakdown(supabase, prevMonth(month), opts))
      : ZERO_PRIOR;

  const live = await computeLiveMonth(supabase, month, prior);
  if (!isSettleable(month)) return live;

  // FREEZE IT. on-conflict-do-nothing + re-read so two simultaneous
  // reads on transfer day can't write two different truths.
  const after = balancesAfter(live);
  const note =
    month < LEDGER_SHIPPED_MONTH
      ? `Settled retroactively on ${new Date().toISOString().slice(0, 10)} when the ledger was built (2026-09-02); rates and fixed costs are the ones in place that day. August's bills were paid on Danisel's personal card (no LLC bank account yet), so the shortfall is booked as her capital.`
      : null;
  const window = settlementWindow(month);
  const upsert = await supabase.from("settlements").upsert(
    {
      month,
      settled_by: opts.settledBy ?? "lazy",
      window_start: window.start.toISOString(),
      window_end: window.end.toISOString(),
      breakdown: live,
      reserve_balance_cents: after.reserveCents,
      growth_balance_cents: after.growthCents,
      partner_balances: after.partners,
      note,
    },
    { onConflict: "month", ignoreDuplicates: true },
  );
  // A freeze that didn't happen must surface as an error, never as a
  // live month quietly handed back as if it were final.
  if (upsert.error) throw new Error(`settlements write (${month}): ${upsert.error.message}`);
  const written = await supabase
    .from("settlements")
    .select(
      "breakdown, settled_at, settled_by, note, reserve_balance_cents, growth_balance_cents, partner_balances",
    )
    .eq("month", month)
    .maybeSingle();
  if (written.error) throw new Error(`settlements re-read (${month}): ${written.error.message}`);
  if (!written.data) throw new Error(`settlements (${month}): written but not readable`);
  return fromFrozen(written.data as SettlementRow);
}

/** Every row a query matches, read in pages and checked against the
 *  exact count — PostgREST caps one select at db-max-rows (1000), which
 *  would silently drop spend rows and overstate profit. A read that
 *  fails or comes up short throws: a month built on a partial read
 *  must never be frozen as FINAL. */
const PAGE = 1000;
async function readAll<T>(
  label: string,
  page: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
    count: number | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  let expected: number | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error, count } = await page(from, from + PAGE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    if (expected === null) expected = count ?? null;
    for (const r of data ?? []) rows.push(r);
    if (!data || data.length < PAGE) break;
  }
  if (expected !== null && rows.length !== expected) {
    throw new Error(`${label}: read ${rows.length} rows, expected ${expected}`);
  }
  return rows;
}

type PaymentRow = {
  amount_cents: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  refunded_at: string | null;
};
type StoreRow = {
  amount_cents: number;
  net_cents: number | null;
  refunded_at: string | null;
  purchased_at: string;
  recorded_at: string | null;
};
type TaxRow = {
  id: string;
  partner: string;
  paid_on: string;
  amount_cents: number;
  government: TaxPaymentLine["government"];
  note: string | null;
  created_at: string;
};

/** The raw-data pull for one month — every row the window touches,
 *  plus two sweeps the window itself can't see:
 *  - LATE ARRIVALS: rows dated inside an earlier, already-frozen
 *    window but recorded after that month was written (a store
 *    webhook that landed after 05:05 on the 27th, a checkout paid
 *    after the freeze). They were never counted; they count here.
 *  - CLAWBACKS: refunds issued this window for charges counted in an
 *    earlier month. That money left the bank; it's an expense here. */
async function computeLiveMonth(
  supabase: SupabaseClient,
  month: string,
  prior: PriorBalances,
): Promise<MonthBreakdown> {
  const { start, end, tailEnd, periodLabel, monthLabel } = settlementWindow(month);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const priorSettledAt = prior.settledAt ?? null;

  const PAYMENT_COLS = "amount_cents, status, paid_at, created_at, refunded_at";
  const STORE_COLS = "amount_cents, net_cents, refunded_at, purchased_at, recorded_at";
  const TAX_COLS = "id, partner, paid_on, amount_cents, government, note, created_at";
  // paid_on is a DATE; the window's 05:00 UTC edges are the 27th, so
  // the date strings line up exactly.
  const startDate = startIso.slice(0, 10);
  const endDate = endIso.slice(0, 10);
  const [settings, payments, storeRows, spendRows, oracleCount, latePayments, lateStore, webClawbacks, storeClawbacks, taxRows, lateTaxRows] =
    await Promise.all([
      loadSettings(supabase),
      readAll<PaymentRow>("payments", (from, to) =>
        supabase
          .from("payments")
          .select(PAYMENT_COLS, { count: "exact" })
          .gte("created_at", startIso)
          .lt("created_at", endIso)
          .order("created_at", { ascending: true })
          .range(from, to),
      ),
      readAll<StoreRow>("store_purchases", (from, to) =>
        supabase
          .from("store_purchases")
          .select(STORE_COLS, { count: "exact" })
          .gte("purchased_at", startIso)
          .lt("purchased_at", endIso)
          .order("purchased_at", { ascending: true })
          .range(from, to),
      ),
      readAll<{ cents: number | null; exact_cents: number | string | null }>("chat_spend_events", (from, to) =>
        supabase
          .from("chat_spend_events")
          .select("cents, exact_cents", { count: "exact" })
          .gte("created_at", startIso)
          .lt("created_at", endIso)
          .order("created_at", { ascending: true })
          .range(from, to),
      ),
      supabase
        .from("oracles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startIso)
        .lt("created_at", endIso),
      // Late arrivals — only meaningful once the previous month is
      // frozen (before that, the previous month still sees them).
      priorSettledAt
        ? readAll<PaymentRow>("payments (late)", (from, to) =>
            supabase
              .from("payments")
              .select(PAYMENT_COLS, { count: "exact" })
              .eq("status", "paid")
              .lt("created_at", startIso)
              .gte("paid_at", priorSettledAt)
              .order("created_at", { ascending: true })
              .range(from, to),
          )
        : Promise.resolve([] as PaymentRow[]),
      priorSettledAt
        ? readAll<StoreRow>("store_purchases (late)", (from, to) =>
            supabase
              .from("store_purchases")
              .select(STORE_COLS, { count: "exact" })
              .is("refunded_at", null)
              .lt("purchased_at", startIso)
              .gte("recorded_at", priorSettledAt)
              .order("purchased_at", { ascending: true })
              .range(from, to),
          )
        : Promise.resolve([] as StoreRow[]),
      // Clawbacks — refunds this window of charges from earlier windows.
      readAll<PaymentRow>("payments (clawbacks)", (from, to) =>
        supabase
          .from("payments")
          .select(PAYMENT_COLS, { count: "exact" })
          .eq("status", "refunded")
          .lt("created_at", startIso)
          .gte("refunded_at", startIso)
          .lt("refunded_at", endIso)
          .order("created_at", { ascending: true })
          .range(from, to),
      ),
      readAll<StoreRow>("store_purchases (clawbacks)", (from, to) =>
        supabase
          .from("store_purchases")
          .select(STORE_COLS, { count: "exact" })
          .lt("purchased_at", startIso)
          .gte("refunded_at", startIso)
          .lt("refunded_at", endIso)
          .order("purchased_at", { ascending: true })
          .range(from, to),
      ),
      // Taxes sent this window, in each name — drains the envelopes.
      readAll<TaxRow>("tax_payments", (from, to) =>
        supabase
          .from("tax_payments")
          .select(TAX_COLS, { count: "exact" })
          .gte("paid_on", startDate)
          .lt("paid_on", endDate)
          .order("paid_on", { ascending: true })
          .range(from, to),
      ),
      // …and ones dated inside an earlier, already-frozen window but
      // recorded after it was written — never counted, so they count here.
      priorSettledAt
        ? readAll<TaxRow>("tax_payments (late)", (from, to) =>
            supabase
              .from("tax_payments")
              .select(TAX_COLS, { count: "exact" })
              .lt("paid_on", startDate)
              .gte("created_at", priorSettledAt)
              .order("paid_on", { ascending: true })
              .range(from, to),
          )
        : Promise.resolve([] as TaxRow[]),
    ]);
  if (oracleCount.error) throw new Error(`oracles count: ${oracleCount.error.message}`);

  // Group the tax payments by partner as named on the settings row. A
  // row naming nobody we know is money that would vanish from the
  // ledger — refuse to build (and so never freeze) the month on it.
  const taxNames = [settings.partner_a ?? "Pedro", settings.partner_b ?? "Danisel"];
  const taxPaymentsByPartner: Record<string, TaxPaymentLine[]> = Object.fromEntries(
    taxNames.map((n) => [n, [] as TaxPaymentLine[]]),
  );
  for (const r of [...taxRows, ...lateTaxRows]) {
    const i = partnerIndex(taxNames, r.partner);
    if (i < 0) throw new Error(`tax_payments: row ${r.id} names "${r.partner}", who is not a partner`);
    taxPaymentsByPartner[taxNames[i]].push({
      paidOn: r.paid_on,
      government: r.government,
      amountCents: r.amount_cents,
      note: r.note,
    });
  }

  // A charge Stripe never billed for ($0 renewal on a 100% coupon)
  // carries no 30¢ fee — it is not a charge for fee purposes.
  const paidWeb = [...payments.filter((p) => p.status === "paid"), ...latePayments].filter(
    (p) => p.amount_cents > 0,
  );
  const refundedWebRows = payments.filter((p) => p.status === "refunded");
  const refundedWeb = refundedWebRows.reduce((a, p) => a + p.amount_cents, 0);
  const grossWebCents = paidWeb.reduce((a, p) => a + p.amount_cents, 0);
  const webChargeCount = paidWeb.length;

  const storeEarned = [...storeRows.filter((r) => !r.refunded_at), ...lateStore];
  const refundedStore = storeRows
    .filter((r) => r.refunded_at)
    .reduce((a, r) => a + r.amount_cents, 0);
  const grossStoreCents = storeEarned.reduce((a, r) => a + r.amount_cents, 0);
  // Store cut: RevenueCat's real take-home when EVERY row has it;
  // otherwise the estimate rate on the whole month (no mixing).
  const storeCommissionActual =
    storeEarned.length > 0 && storeEarned.every((r) => typeof r.net_cents === "number");
  const storeCommissionCents = storeCommissionActual
    ? storeEarned.reduce((a, r) => a + (r.amount_cents - (r.net_cents as number)), 0)
    : undefined;
  const storeRate = storeCommissionActual
    ? storeCommissionCents! / Math.max(1, grossStoreCents)
    : Number(settings.store_commission_rate);

  // What left the bank for sales counted earlier: a Stripe refund
  // returns the whole charge (Stripe keeps its fee); a store refund
  // claws back the net. Plus the fees Stripe kept on this window's
  // own refunds (those charges are already out of gross and fees).
  const storeNetOf = (r: StoreRow) =>
    typeof r.net_cents === "number"
      ? r.net_cents
      : Math.round(r.amount_cents * (1 - Number(settings.store_commission_rate)));
  const refundClawbackCents =
    webClawbacks.reduce((a, p) => a + p.amount_cents, 0) +
    storeClawbacks.reduce((a, r) => a + storeNetOf(r), 0) +
    webProcessingFee(refundedWeb, refundedWebRows.filter((p) => p.amount_cents > 0).length, settings);

  // Real Anthropic spend for the month, straight from the ledger —
  // exact fractions of a cent when recorded, the ceil'd cents before.
  const anthropicCents = Math.round(
    spendRows.reduce(
      (a, r) => a + (typeof r.exact_cents === "number" ? r.exact_cents : Number(r.exact_cents ?? r.cents ?? 0)),
      0,
    ),
  );
  // Replicate: ~4¢ per generated face; identities created this month
  // is the honest proxy until per-call logging exists.
  const replicateCents = (oracleCount.count ?? 0) * 4;

  // Tail-net: what the prev-27th → 1st days brought in, after the
  // platform cuts — the amount that moves to the Marketing account.
  // Compare as instants, not strings — Postgres hands back "+00:00",
  // JS builds "Z"; the same moment must sort the same way. Late
  // arrivals are dated before this window, so they're tail money too
  // (they never reached the Marketing account when they were earned).
  // Window membership and tail membership use the SAME timestamp.
  const tailEndMs = tailEnd.getTime();
  const before = (iso: string | null | undefined) =>
    typeof iso === "string" && new Date(iso).getTime() < tailEndMs;
  const tailWebRows = paidWeb.filter((p) => before(p.created_at));
  const tailWeb = tailWebRows.reduce((a, p) => a + p.amount_cents, 0);
  const tailStoreRows = storeEarned.filter((r) => before(r.purchased_at));
  const tailStore = tailStoreRows.reduce((a, r) => a + r.amount_cents, 0);
  const tailStoreNet = storeCommissionActual
    ? tailStoreRows.reduce((a, r) => a + (r.net_cents as number), 0)
    : Math.round(tailStore * (1 - storeRate));
  const retainedTailCents =
    tailWeb - webProcessingFee(tailWeb, tailWebRows.length, settings) + tailStoreNet;

  // ONE formula (computeBreakdown) — the real month and the example
  // can never disagree.
  const savings = lockedSavingsForMonth(settings, month);
  return computeBreakdown({
    month,
    monthLabel,
    periodLabel,
    grossWebCents,
    webChargeCount,
    grossStoreCents,
    storeCommissionCents,
    storeCommissionActual,
    anthropicCents,
    replicateCents,
    refundedCents: refundedWeb + refundedStore,
    refundClawbackCents,
    retainedTailCents,
    contributionsPerMemberCents: contributionForMonth(settings, month),
    lockedSavingsCents: savings.balanceCents,
    lockedSavingsDepositCents: savings.depositCents,
    taxPaymentsByPartner,
    // "Next due" counts from today, kept inside this month's window:
    // a month viewed early reads from its first day, a month being
    // frozen on its 27th reads from the 27th.
    asOfYmd: [startIso.slice(0, 10), new Date().toISOString().slice(0, 10), endIso.slice(0, 10)].sort()[1],
    prior,
    settings,
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
