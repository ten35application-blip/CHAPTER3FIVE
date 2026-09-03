import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { normalizeMonthParam } from "@/lib/admin/monthBreakdown";
import {
  MAX_BALANCE_CENTS,
  fetchMarketingReport,
  parseDollarsToCents,
  saveMarketingReport,
} from "@/lib/admin/marketingReports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Marketing account (Navy Federal), as the bank showed it on the
 * 1st — the mobile app's way to record it (the web form uses the
 * server action in /admin/revenue/actions.ts; both write through
 * src/lib/admin/marketingReports.ts).
 *
 * GET  ?month=YYYY-MM          → the report for that settlement month
 * POST { month, balance }      → upsert; `balance` is dollars ("1,234.56")
 *                                or `balanceCents` as an integer
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const url = new URL(request.url);
  const month = normalizeMonthParam(url.searchParams.get("month"));
  return NextResponse.json({ report: await fetchMarketingReport(gate.admin, month) });
}

export async function POST(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;

  let body: { month?: unknown; balance?: unknown; balanceCents?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }
  // Strict on a write: a bad month must fail, never fall back to "now".
  const month =
    typeof body.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.month)
      ? body.month
      : null;
  if (!month) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });

  const balanceCents =
    typeof body.balanceCents === "number" && Number.isInteger(body.balanceCents)
      ? body.balanceCents
      : typeof body.balance === "string"
        ? parseDollarsToCents(body.balance)
        : null;
  if (
    balanceCents === null ||
    !Number.isInteger(balanceCents) ||
    balanceCents < 0 ||
    balanceCents > MAX_BALANCE_CENTS
  ) {
    return NextResponse.json(
      { error: "balance must be a dollar amount like 1234.56" },
      { status: 400 },
    );
  }
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : null;

  try {
    const report = await saveMarketingReport(gate.admin, {
      month,
      balanceCents,
      reportedBy: gate.user.email ?? null,
      note,
    });
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    // The lib's own messages are safe to show; a database error is not.
    console.error("[marketing-report] save failed:", err);
    return NextResponse.json({ error: "Could not save the balance — try again." }, { status: 400 });
  }
}
