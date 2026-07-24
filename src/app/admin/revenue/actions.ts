"use server";

import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient, safeSelect, type PaymentRow } from "@/lib/admin/queries";

export type CsvExport = { filename: string; csv: string };

/**
 * CSV export of every payment on record. Returned as text to the client
 * button, which turns it into a Blob download — a server action can't
 * set Content-Type headers itself.
 */
export async function exportPaymentsCsv(): Promise<CsvExport> {
  await requireAdmin();

  const supabase = createAdminClient();
  const payments = await safeSelect<PaymentRow>(
    supabase,
    "payments",
    "id, user_id, amount_cents, currency, purpose, status, created_at, paid_at",
    (q) => q.order("created_at", { ascending: true }),
  );

  const header = "id,user_id,amount_usd,currency,purpose,status,created_at,paid_at";
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

  return {
    filename: `chapter3five-payments-${new Date().toISOString().slice(0, 10)}.csv`,
    csv: [header, ...lines].join("\n"),
  };
}
