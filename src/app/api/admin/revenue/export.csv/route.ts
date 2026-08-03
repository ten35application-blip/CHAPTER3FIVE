import { requireAdminApi } from "@/lib/api/adminAuth";
import { safeSelect, type PaymentRow } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/revenue/export.csv — Bearer-authed twin of the web
 * exportPaymentsCsv server action. Same query (every payment on
 * record, oldest first) and same CSV columns; the API version can set
 * real download headers, so no client Blob dance is needed — mobile
 * just saves the response body.
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const supabase = gate.admin;

  const payments = await safeSelect<PaymentRow>(
    supabase,
    "payments",
    "id, user_id, amount_cents, currency, purpose, status, created_at, paid_at",
    (q) => q.order("created_at", { ascending: true }),
  );

  const header =
    "id,user_id,amount_usd,currency,purpose,status,created_at,paid_at";
  const lines = payments.map((p) =>
    [
      p.id,
      p.user_id,
      (p.amount_cents / 100).toFixed(2),
      p.currency,
      // purpose/status are constrained enum-ish values, but quote anyway.
      `"${p.purpose.replaceAll('"', '""')}"`,
      p.status,
      p.created_at,
      p.paid_at ?? "",
    ].join(","),
  );

  const filename = `chapter3five-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response([header, ...lines].join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
