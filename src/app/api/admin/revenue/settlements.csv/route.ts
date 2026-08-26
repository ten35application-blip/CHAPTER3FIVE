import { requireAdminApi } from "@/lib/api/adminAuth";
import {
  fetchMonthBreakdown,
  prevMonth,
  normalizeMonthParam,
} from "@/lib/admin/monthBreakdown";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/revenue/settlements.csv — THE ACCOUNTANT'S LEDGER
 * (Wilson 2026-08-26: "a ledger we can give to the accountant — the
 * 50/50 split, how much is held in, how much was pulled out on the
 * 27th"). One row per month from launch (2026-08) through the current
 * settlement month, every column an accountant asks for: sales by
 * channel, platform fees, each operating expense itemized, profit,
 * every held-back dollar named (bills / cushion / compounding tail /
 * each partner's tax envelope), and each partner's 27th transfer.
 * Same numbers as the printable Settlement Statement — both read the
 * ONE formula. Openable straight into Numbers/Sheets/Excel.
 */
const LAUNCH_MONTH = "2026-08";

/** Quote a cell so commas inside labels never break columns. */
function cell(v: string): string {
  return v.includes(",") || v.includes('"')
    ? `"${v.replaceAll('"', '""')}"`
    : v;
}

export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

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
    breakdowns.push(await fetchMonthBreakdown(gate.admin, month));
  }

  const usd = (c: number) => (c / 100).toFixed(2);
  const first = breakdowns[0];
  // Expense names come from live business_settings — identical across
  // rows in one export, so each expense gets its own column.
  const expenseNames = first.expenses.map((e) => e.name);
  const [pA, pB] = first.partners;
  const partnerA = pA.name;
  const partnerB = pB.name;

  const generated = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date());

  const preamble = [
    cell("CHAPTER3FIVE LLC — Monthly Settlement Ledger"),
    cell(
      `Ownership: ${partnerA} 50% (${pA.residence}) / ${partnerB} 50% (${pB.residence}) — equal partners; each is taxed only on their own half, under their own state's rules (separate filings)`,
    ),
    cell(
      `The New York member: PA taxes the share first (nonresident 3.07%) and New York credits every PA dollar (Form IT-112-R) — taxed once, never twice; NYC's city tax stacks with no credit`,
    ),
    cell(
      `Payout elections: ${pA.name} takes ${pA.payout === "december" ? "one December draw a year (share accrues in the account)" : "their transfer on the 27th"}; ${pB.name} takes ${pB.payout === "december" ? "one December draw a year (share accrues in the account)" : "their transfer on the 27th"}. Deferring a draw never defers taxes — envelopes go out quarterly`,
    ),
    cell(
      "Each month counts the previous 27th through the 26th; figures go FINAL on the 27th (transfer day) and never move after",
    ),
    cell(
      "Money made from the 27th to the 1st is never distributed — it stays in the account, compounding for emergencies, hiring, and future endeavors (its taxes are still reserved)",
    ),
    cell(
      `Tax envelopes are held by the business and paid quarterly to the IRS / each partner's own state and city in their own name — transfers to partners are fully spendable`,
    ),
    cell(
      `Generated ${generated} · amounts in USD · (est.) = estimated rate, tuned as real statements land · not tax advice`,
    ),
    "",
  ];

  const header = [
    "Month",
    "Counting window",
    "Status",
    "Web sales",
    "Store sales",
    "Total sales",
    "Store fees (est.)",
    "Card fees (est.)",
    "Net receipts",
    ...expenseNames,
    "Total expenses",
    "Net profit",
    "Held: next month's bills",
    "Held: growth cushion",
    "Held: compounding (27th→1st)",
    `Held: ${partnerA}'s tax envelope`,
    `Held: ${partnerB}'s tax envelope`,
    "Total kept in account",
    `${pA.payout === "december" ? "Accrued to" : "Transferred to"} ${partnerA} (${pA.payout === "december" ? "December draw" : "27th"})`,
    `${pB.payout === "december" ? "Accrued to" : "Transferred to"} ${partnerB} (${pB.payout === "december" ? "December draw" : "27th"})`,
    "Paid out of the account (27th)",
    "Waiting for December draws (cumulative)",
    "Each partner's profit share (50%)",
    `${partnerA}'s tax rate (${pA.residence})`,
    `${partnerB}'s tax rate (${pB.residence})`,
    "Refunds (info)",
  ]
    .map(cell)
    .join(",");

  const rows: string[] = [...preamble, header];
  for (const b of breakdowns) {
    const window = b.periodLabel.split(" · ")[0].replace("counting ", "");
    const status =
      b.month === currentMonth ? "In progress — final on the 27th" : "FINAL";
    const tailHeld = Math.min(b.retainedTailCents, Math.max(0, b.profitCents));
    rows.push(
      [
        b.monthLabel,
        window,
        status,
        usd(b.grossWebCents),
        usd(b.grossStoreCents),
        usd(b.grossCents),
        usd(b.storeCommissionCents),
        usd(b.webProcessingCents),
        usd(b.netReceiptsCents),
        ...b.expenses.map((e) => usd(e.cents)),
        usd(b.totalExpensesCents),
        usd(b.profitCents),
        usd(b.billsCents),
        usd(b.cushionCents),
        usd(tailHeld),
        usd(b.partners[0].taxEnvelopeCents),
        usd(b.partners[1].taxEnvelopeCents),
        usd(b.keepInAccountCents),
        usd(b.partners[0].transferCents),
        usd(b.partners[1].transferCents),
        usd(
          b.partners
            .filter((p) => p.payout !== "december")
            .reduce((a, p) => a + p.transferCents, 0),
        ),
        usd(
          b.partners
            .filter((p) => p.payout === "december")
            .reduce((a, p) => a + p.undrawnBalanceCents, 0),
        ),
        usd(b.profitShareCents),
        `${b.partners[0].taxRatePct}%`,
        `${b.partners[1].taxRatePct}%`,
        usd(b.refundedCents),
      ]
        .map(cell)
        .join(","),
    );
  }

  return new Response(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="chapter3five-settlement-ledger.csv"',
    },
  });
}
