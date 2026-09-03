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
  // Same builder as /api/admin/revenue/settlements.csv — one ledger,
  // whichever way it's downloaded.
  const { buildSettlementsCsv } = await import("@/lib/admin/settlementsCsv");
  return {
    filename: "chapter3five-settlement-ledger.csv",
    csv: await buildSettlementsCsv(supabase),
  };
}

/** The Marketing account (Navy Federal) as the bank showed it on the
 *  1st (Wilson 2026-09-02) — one report per settlement month, sitting
 *  beside what the formula says should be there. */
export async function saveMarketingReportAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const month = String(formData.get("month") ?? "");
  const raw = String(formData.get("balance") ?? "");
  const { parseDollarsToCents, saveMarketingReport } = await import(
    "@/lib/admin/marketingReports"
  );
  const balanceCents = parseDollarsToCents(raw);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || balanceCents === null) {
    // A malformed submit just re-renders; the form's own validation
    // stops this before it reaches here.
    return;
  }
  await saveMarketingReport(createAdminClient(), {
    month,
    balanceCents,
    reportedBy: user.email ?? null,
  });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/admin/revenue");
  revalidatePath("/admin/revenue/statement");
}

/** An estimated-tax payment sent in a member's name (Wilson
 *  2026-09-02: Danisel four times a year, Pedro once in December).
 *  Drains that member's held envelope in the month it was sent. */
export async function recordTaxPaymentAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const supabase = createAdminClient();
  const { parseDollarsToCents } = await import("@/lib/admin/marketingReports");
  const { recordTaxPayment } = await import("@/lib/admin/taxPayments");
  const { loadSettings } = await import("@/lib/admin/monthBreakdown");
  const amountCents = parseDollarsToCents(String(formData.get("amount") ?? ""));
  // A malformed submit just re-renders; the form's own validation
  // stops this before it reaches here.
  if (amountCents === null) return;
  const settings = await loadSettings(supabase);
  try {
    await recordTaxPayment(supabase, {
      partner: String(formData.get("partner") ?? ""),
      paidOn: String(formData.get("paidOn") ?? ""),
      amountCents,
      government: String(formData.get("government") ?? ""),
      note: String(formData.get("note") ?? ""),
      recordedBy: user.email ?? null,
      partnerNames: [settings.partner_a, settings.partner_b],
    });
  } catch (err) {
    console.error("[tax-payment] record failed:", err);
    return;
  }
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/admin/revenue");
  revalidatePath("/admin/revenue/statement");
}

/** Remove a payment typed wrong — only while its month is still live. */
export async function deleteTaxPaymentAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const { deleteTaxPayment } = await import("@/lib/admin/taxPayments");
  try {
    await deleteTaxPayment(createAdminClient(), String(formData.get("id") ?? ""));
  } catch (err) {
    console.error("[tax-payment] delete failed:", err);
    return;
  }
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/admin/revenue");
  revalidatePath("/admin/revenue/statement");
}
