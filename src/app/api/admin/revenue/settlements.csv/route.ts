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
  const { partnerA, partnerB } = first;

  const generated = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "America/New_York",
  }).format(new Date());

  const preamble = [
    cell("CHAPTER3FIVE LLC — Monthly Settlement Ledger"),
    cell(
      `Ownership: ${partnerA} 50% / ${partnerB} 50% — equal partners; each is taxed only on their own half (separate filings)`,
    ),
    cell(
      "Each month counts the previous 27th through the 26th; figures go FINAL on the 27th (transfer day) and never move after",
    ),
    cell(
      "Money made from the 27th to the 1st is never distributed — it stays in the account, compounding for emergencies, hiring, and future endeavors (its taxes are still reserved)",
    ),
    cell(
      `Tax envelopes are held by the business and paid quarterly to the IRS / PA / local in each partner's own name — transfers to partners are fully spendable`,
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
    `Transferred to ${partnerA} (27th)`,
    `Transferred to ${partnerB} (27th)`,
    "Total transferred out",
    "Each partner's profit share (50%)",
    "Effective tax rate",
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
        usd(b.taxSavingsPerPartnerCents),
        usd(b.taxSavingsPerPartnerCents),
        usd(b.keepInAccountCents),
        usd(b.transferPerPartnerCents),
        usd(b.transferPerPartnerCents),
        usd(b.transferPerPartnerCents * 2),
        usd(b.profitShareCents),
        `${(b.taxReserveRate * 100).toFixed(1)}%`,
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
