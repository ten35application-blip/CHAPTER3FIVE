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
 * GET /api/admin/revenue/settlements.csv — the ledger of settled
 * months, one row per month from launch month (2026-08) through the
 * current settlement month: what came in, what the stores and Stripe
 * kept, every operating cost, profit, the tax reserve, and the
 * per-partner transfer/savings/spendable lines. Wilson's "track
 * month by month, see how much we took out and left in" file —
 * openable straight into Numbers/Sheets/Excel.
 */
const LAUNCH_MONTH = "2026-08";

export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  // Walk backward from the current settlement month to launch.
  const months: string[] = [];
  let m = normalizeMonthParam(null);
  while (m >= LAUNCH_MONTH && months.length < 120) {
    months.push(m);
    m = prevMonth(m);
  }
  months.reverse();

  const usd = (c: number) => (c / 100).toFixed(2);
  const header = [
    "Month",
    "Customers paid",
    "Store cut (est)",
    "Stripe cut (est)",
    "Reached the bank",
    "Fixed bills",
    "Anthropic (actual)",
    "Replicate (est)",
    "Total costs",
    "Profit",
    "Tax reserve",
    "Pedro transfer",
    "Danisel transfer",
    "Each to tax savings",
    "Each spendable",
    "Stays for bills",
    "Refunded",
  ].join(",");

  const rows: string[] = [header];
  for (const month of months) {
    const b = await fetchMonthBreakdown(gate.admin, month);
    const fixedCents = b.expenses
      .filter((e) => !e.name.startsWith("Anthropic") && !e.name.startsWith("Replicate"))
      .reduce((a, e) => a + e.cents, 0);
    const anthropic =
      b.expenses.find((e) => e.name.startsWith("Anthropic"))?.cents ?? 0;
    const replicate =
      b.expenses.find((e) => e.name.startsWith("Replicate"))?.cents ?? 0;
    rows.push(
      [
        b.monthLabel.replaceAll(",", ""),
        usd(b.grossCents),
        usd(b.storeCommissionCents),
        usd(b.webProcessingCents),
        usd(b.netReceiptsCents),
        usd(fixedCents),
        usd(anthropic),
        usd(replicate),
        usd(b.totalExpensesCents),
        usd(b.profitCents),
        usd(b.taxReserveCents),
        usd(b.transferPerPartnerCents),
        usd(b.transferPerPartnerCents),
        usd(b.taxSavingsPerPartnerCents),
        usd(b.perPartnerCents),
        usd(b.keepInAccountCents),
        usd(b.refundedCents),
      ].join(","),
    );
  }

  return new Response(rows.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="chapter3five-months-settled.csv"',
    },
  });
}
