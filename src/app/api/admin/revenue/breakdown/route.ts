import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import {
  fetchMonthBreakdown,
  normalizeMonthParam,
} from "@/lib/admin/monthBreakdown";

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
  return NextResponse.json(breakdown);
}
