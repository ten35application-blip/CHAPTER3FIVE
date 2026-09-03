import { requireAdminApi } from "@/lib/api/adminAuth";
import { buildSettlementsCsv } from "@/lib/admin/settlementsCsv";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/revenue/settlements.csv — THE ACCOUNTANT'S LEDGER.
 * One row per settlement month since launch; see
 * lib/admin/settlementsCsv.ts for the columns. Same numbers as the
 * printable Settlement Statement and the "Months CSV" button — all
 * read the ONE formula. Openable straight into Numbers/Sheets/Excel.
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const csv = await buildSettlementsCsv(gate.admin);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="chapter3five-settlement-ledger.csv"',
    },
  });
}
