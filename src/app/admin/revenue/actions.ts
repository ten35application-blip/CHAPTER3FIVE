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


/** The month-by-month settlement ledger (Wilson 2026-08-26): every
 *  month since launch on one row each — in, kept, costs, profit,
 *  reserve, per-partner transfers/savings/spendable. Same shared
 *  formula as the Revenue cards. */
export async function exportSettlementsCsv(): Promise<{
  filename: string;
  csv: string;
}> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { fetchMonthBreakdown, prevMonth, normalizeMonthParam } =
    await import("@/lib/admin/monthBreakdown");

  const months: string[] = [];
  let m = normalizeMonthParam(null);
  while (m >= "2026-08" && months.length < 120) {
    months.push(m);
    m = prevMonth(m);
  }
  months.reverse();

  const usd = (c: number) => (c / 100).toFixed(2);
  const rows = [
    "Month,Customers paid,Store cut (est),Stripe cut (est),Reached the bank,Fixed bills,Anthropic (actual),Replicate (est),Total costs,Profit,Tax reserve,Pedro transfer,Danisel transfer,Each to tax savings,Each spendable,Stays for bills,Refunded",
  ];
  for (const month of months) {
    const b = await fetchMonthBreakdown(supabase, month);
    const fixedCents = b.expenses
      .filter(
        (e) =>
          !e.name.startsWith("Anthropic") && !e.name.startsWith("Replicate"),
      )
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
  return {
    filename: "chapter3five-months-settled.csv",
    csv: rows.join("\n") + "\n",
  };
}
