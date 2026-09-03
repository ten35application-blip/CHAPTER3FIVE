import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import {
  fetchExampleBreakdown,
  fetchMonthBreakdown,
  normalizeMonthParam,
  prevMonth,
} from "@/lib/admin/monthBreakdown";
import { fetchMarketingReport } from "@/lib/admin/marketingReports";
import { fetchTaxPayments } from "@/lib/admin/taxPayments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/revenue/breakdown?month=YYYY-MM — the month's money,
 * answered the way the owners ask it: what stays for taxes, what
 * stays for bills, what Danisel and Pedro can each transfer out.
 * Defaults to the current month. All amounts cents; labels and the
 * estimate/actual flags ride along so both clients render one truth.
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  const url = new URL(request.url);
  const month = normalizeMonthParam(url.searchParams.get("month"));
  const breakdown = await fetchMonthBreakdown(gate.admin, month);
  // Empty month → teach the formula with a clearly-labeled EXAMPLE
  // built from the LIVE rates and fixed costs, so the first real
  // month reads exactly like the rehearsal did.
  const example =
    breakdown.grossCents === 0
      ? await fetchExampleBreakdown(gate.admin)
      : null;
  // The Marketing account as the bank showed it on the 1st: this
  // month's (after its transfer day) and last month's (what the live
  // month card nudges for on the 1st).
  // Tax payments ever recorded (with ids, so a live one can be
  // deleted from the app); the month's counted ones sit inside
  // breakdown.partners[].taxPayments.
  const [marketingReport, marketingReportPrev, taxPayments] = await Promise.all([
    fetchMarketingReport(gate.admin, month),
    fetchMarketingReport(gate.admin, prevMonth(month)),
    fetchTaxPayments(gate.admin, { limit: 50 }),
  ]);
  return NextResponse.json({
    ...breakdown,
    example,
    marketingReport,
    marketingReportPrev,
    taxPayments,
  });
}
