import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LAUNCH_MONTH,
  fetchMonthBreakdown,
  normalizeMonthParam,
  prevMonth,
} from "@/lib/admin/monthBreakdown";
import { fetchMarketingReports } from "@/lib/admin/marketingReports";

/**
 * THE ACCOUNTANT'S LEDGER (Wilson 2026-08-26: "a ledger we can give to
 * the accountant — the 50/50 split, how much is held in, how much was
 * pulled out on the 27th"). One row per month from launch through the
 * current settlement month, every column an accountant asks for:
 * sales by channel, platform fees, each operating expense itemized,
 * profit, member contributions (capital), each partner's tax envelope
 * broken out per government, the reserve, the Marketing-account
 * (Navy Federal) transfer beside what the bank actually showed on the
 * 1st, and each partner's 27th transfer / December accrual.
 * Frozen months read from the ledger; the same numbers as the
 * printable Settlement Statement — both read the ONE formula. Built
 * here once so the download button and the /settlements.csv route
 * can never disagree.
 */

/** Quote a cell so commas inside labels never break columns. */
function cell(v: string): string {
  return v.includes(",") || v.includes('"')
    ? `"${v.replaceAll('"', '""')}"`
    : v;
}

export async function buildSettlementsCsv(supabase: SupabaseClient): Promise<string> {
  // Walk backward from the current settlement month to launch.
  const currentMonth = normalizeMonthParam(null);
  const months: string[] = [];
  let m = currentMonth;
  while (m >= LAUNCH_MONTH && months.length < 120) {
    months.push(m);
    m = prevMonth(m);
  }
  months.reverse();

  const breakdowns = [];
  for (const month of months) {
    breakdowns.push(await fetchMonthBreakdown(supabase, month));
  }
  // What Navy Federal showed in the Marketing account on the 1st after
  // each month's transfer day — Wilson's monthly report, by month.
  const reports = await fetchMarketingReports(supabase);

  const usd = (c: number) => (c / 100).toFixed(2);
  const first = breakdowns[0];
  // Expense names come from the settings in force each month; take
  // the union so a renamed or added bill still gets its own column.
  const expenseNames = [
    ...new Set(breakdowns.flatMap((b) => b.expenses.map((e) => e.name))),
  ];
  const [pA, pB] = first.partners;
  const partnerA = pA.name;
  const partnerB = pB.name;

  const generated = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date());

  const payoutLine = (p: typeof pA) =>
    p.payout === "december"
      ? "one December draw a year (share accrues in the account)"
      : "their transfer on the 27th";

  const preamble = [
    cell("CHAPTER3FIVE LLC — Monthly Settlement Ledger"),
    cell(
      `Ownership: ${partnerA} 50% (${pA.residence}) / ${partnerB} 50% (${pB.residence}) — equal partners; each is taxed only on their own half, under their own state's rules (separate filings)`,
    ),
    cell(
      `The New York member: PA taxes the share first (nonresident 3.07%) and New York credits every PA dollar (Form IT-112-R) — taxed once, never twice; NYC's city tax stacks with no credit. The "state" column is the full NY State amount; the "PA first" column is the part of it paid to PA`,
    ),
    cell(
      `Payout elections: ${pA.name} takes ${payoutLine(pA)}; ${pB.name} takes ${payoutLine(pB)}. Deferring a draw never defers taxes — each pays their own estimates on their own schedule`,
    ),
    cell(
      "Each month counts the previous 27th through the 26th; figures go FINAL on the 27th (transfer day), are written to the ledger, and never move after",
    ),
    cell(
      "Money made from the 27th to the 1st is never distributed — it moves to the Marketing account at Navy Federal on the 27th (its taxes are still reserved with the rest of profit). On the 1st the balance the bank shows is reported and printed beside the formula's figure",
    ),
    cell(
      "The operating reserve (next month's bills + cushion) is a target balance the account keeps: filled once, topped up only when below target, drawn down by a loss month. Bills = fixed subscriptions + this month's usage costs (Anthropic, Replicate), so the target scales with use; cushion = the larger of 50% of bills or 10% of profit — room for usage to grow",
    ),
    cell(
      "Member contributions on the 1st are capital, not income: not taxed, not split; they fill the reserve until profit does, and the business owes them back. A loss the reserve cannot cover is paid out of pocket by the named member and booked as their capital the same way",
    ),
    cell(
      "The savings floor is the bank's minimum, put in by a member as capital (see that partner's capital column): it stays in the savings account — never reserve, never marketing, never spent",
    ),
    cell(
      `Tax envelopes are held by the business and paid in each partner's own name on their own schedule (Danisel four times a year: IRS + PA Apr 15 / Jun 15 / Sep 15 / Jan 15, Bethlehem via Keystone Apr 15 / Jul 15 / Oct 15 / Jan 15; Pedro once in December) — payments sent drain the held amount in the month they went out; transfers to partners are fully spendable`,
    ),
    cell(
      `Generated ${generated} · amounts in USD · (est.) = estimated rate, tuned as real statements land · not tax advice`,
    ),
    "",
  ];

  const taxCols = (name: string) => [
    `${name}: self-employment (IRS)`,
    `${name}: federal income (IRS)`,
    `${name}: state income`,
    `${name}: city / local`,
    `${name}: of state, paid to PA first`,
    `${name}: tax envelope (held)`,
  ];

  const header = [
    "Month",
    "Counting window",
    "Status",
    "Web sales",
    "Web charges",
    "Store sales",
    "Total sales",
    "Store fees",
    "Store fees basis",
    "Card fees (2.9% + 30¢)",
    "Net receipts",
    ...expenseNames,
    "Total expenses",
    "Net profit",
    "Member contributions (capital, not income)",
    ...taxCols(partnerA),
    ...taxCols(partnerB),
    "Reserve: carried in",
    "Reserve: top-up from profit",
    "Reserve: drawn (loss month)",
    "Reserve: after",
    "Reserve: target",
    "Shortfall (loss beyond the reserve)",
    "Shortfall covered out of pocket by a member (capital)",
    "Shortfall covered by",
    "Earned from the 27th to the 1st (net of fees)",
    "Marketing account (Navy Federal): transfer (27th→1st money, after taxes and the reserve)",
    "Marketing account (Navy Federal): balance per the formula",
    "Marketing account (Navy Federal): balance the bank showed on the 1st",
    "Marketing account (Navy Federal): reported on",
    "Marketing account (Navy Federal): bank minus formula",
    `${partnerA}: entitlement (50% share after own taxes + common holds)`,
    `${partnerB}: entitlement (50% share after own taxes + common holds)`,
    `${partnerA}: cash out this month`,
    `${partnerB}: cash out this month`,
    "Paid out of the account (27th, incl. marketing transfer)",
    "December pots (cumulative, undrawn)",
    "Each partner's profit share (50%)",
    `${partnerA}'s tax rate (${pA.residence})`,
    `${partnerB}'s tax rate (${pB.residence})`,
    "Savings floor put in this month (capital)",
    "Savings account holds (bank minimum, stays there)",
    `${partnerA}: capital put in (cumulative)`,
    `${partnerB}: capital put in (cumulative)`,
    `${partnerA}: taxes sent this month (in own name)`,
    `${partnerB}: taxes sent this month (in own name)`,
    "Taxes sent this month (both)",
    `${partnerA}: taxes held after payments`,
    `${partnerB}: taxes held after payments`,
    "Taxes held after payments (both)",
    "Operating account should hold after transfer day",
    "Contributions verdict",
    "Refunds (info)",
  ]
    .map(cell)
    .join(",");

  const rows: string[] = [...preamble, header];
  for (const b of breakdowns) {
    const window = b.periodLabel.split(" · ")[0].replace("counting ", "");
    const status = b.frozen
      ? `FINAL (ledger ${b.settledAt?.slice(0, 10) ?? ""})`
      : "In progress — final on the 27th";
    const expenseByName = new Map(b.expenses.map((e) => [e.name, e.cents]));
    const reported = reports.get(b.month) ?? null;
    const taxCells = (p: (typeof b.partners)[number]) => [
      usd(p.taxParts?.seCents ?? 0),
      usd(p.taxParts?.federalCents ?? 0),
      usd(p.taxParts?.stateCents ?? 0),
      usd((p.taxParts?.cityCents ?? 0) + (p.taxParts?.localCents ?? 0)),
      usd(p.taxParts?.paNonresidentCents ?? 0),
      usd(p.taxEnvelopeCents),
    ];
    rows.push(
      [
        b.monthLabel,
        window,
        status,
        usd(b.grossWebCents),
        String(b.webChargeCount ?? 0),
        usd(b.grossStoreCents),
        usd(b.grossCents),
        usd(b.storeCommissionCents),
        b.storeCommissionActual ? "RevenueCat actual" : "estimated rate",
        usd(b.webProcessingCents),
        usd(b.netReceiptsCents),
        ...expenseNames.map((n) => usd(expenseByName.get(n) ?? 0)),
        usd(b.totalExpensesCents),
        usd(b.profitCents),
        usd(b.contributionsCents ?? 0),
        ...taxCells(b.partners[0]),
        ...taxCells(b.partners[1]),
        usd(b.reserveCarriedCents ?? 0),
        usd(b.reserveTopUpCents ?? 0),
        usd(b.reserveDrawCents ?? 0),
        usd(b.reserveAfterCents ?? 0),
        usd(b.reserveTargetCents ?? 0),
        usd(b.shortfallCents ?? 0),
        usd(b.shortfallCoveredCents ?? 0),
        b.shortfallPaidBy ?? "",
        usd(b.retainedTailCents ?? 0),
        usd(b.growthTransferCents ?? 0),
        usd(b.growthBalanceCents ?? 0),
        reported ? usd(reported.balanceCents) : "",
        reported?.reportedOn ?? "",
        reported ? usd(reported.balanceCents - (b.growthBalanceCents ?? 0)) : "",
        usd(b.partners[0].transferCents),
        usd(b.partners[1].transferCents),
        usd(b.partners[0].drawCents ?? 0),
        usd(b.partners[1].drawCents ?? 0),
        usd(b.paidOutCents ?? 0),
        usd(b.partners.reduce((a, p) => a + (p.undrawnBalanceCents ?? 0), 0)),
        usd(b.profitShareCents),
        `${b.partners[0].taxRatePct}%`,
        `${b.partners[1].taxRatePct}%`,
        usd(b.lockedSavingsDepositCents ?? 0),
        usd(b.lockedSavingsCents ?? 0),
        usd(b.partners[0].capitalCents ?? 0),
        usd(b.partners[1].capitalCents ?? 0),
        usd(b.partners[0].taxPaidCents ?? 0),
        usd(b.partners[1].taxPaidCents ?? 0),
        usd(b.taxPaidTotalCents ?? 0),
        usd(b.partners[0].taxHeldCents ?? 0),
        usd(b.partners[1].taxHeldCents ?? 0),
        usd(b.taxHeldTotalCents ?? 0),
        usd(b.accountShouldHoldCents ?? 0),
        b.contributionsVerdict ?? "",
        usd(b.refundedCents),
      ]
        .map(cell)
        .join(","),
    );
  }

  return rows.join("\n") + "\n";
}
