import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * THE MARKETING ACCOUNT, RECONCILED (Wilson 2026-09-02: "every 1st of
 * the month I am going to report how much is in the Marketing account
 * that comes from the 27th to the 1st").
 *
 * The formula says what the Marketing account at Navy Federal SHOULD
 * hold after each transfer day (`growthBalanceCents`). On the 1st
 * Wilson types what the bank actually shows; the report is keyed by
 * the settlement month it follows and sits beside the prediction on
 * every surface. This file is the only reader/writer of that table —
 * the web form, the mobile API, and the CSV all come through here.
 */

export type MarketingReport = {
  /** The settlement month this balance follows. */
  month: string;
  balanceCents: number;
  /** YYYY-MM-DD, the day it was read off the bank. */
  reportedOn: string;
  reportedBy: string | null;
  note: string | null;
};

type Row = {
  month: string;
  balance_cents: number;
  reported_on: string;
  reported_by: string | null;
  note: string | null;
};

const COLUMNS = "month, balance_cents, reported_on, reported_by, note";

function fromRow(r: Row): MarketingReport {
  return {
    month: r.month,
    balanceCents: r.balance_cents,
    reportedOn: r.reported_on,
    reportedBy: r.reported_by,
    note: r.note,
  };
}

export async function fetchMarketingReport(
  supabase: SupabaseClient,
  month: string,
): Promise<MarketingReport | null> {
  const { data, error } = await supabase
    .from("marketing_balance_reports")
    .select(COLUMNS)
    .eq("month", month)
    .maybeSingle();
  // A failed read must not look like "never reported" — that line ends
  // up in the transfer-sheet email as a nag to type a number again.
  if (error) throw new Error(`marketing_balance_reports (${month}): ${error.message}`);
  return data ? fromRow(data as Row) : null;
}

/** Every report at once, keyed by month — for the ledger CSV. */
export async function fetchMarketingReports(
  supabase: SupabaseClient,
): Promise<Map<string, MarketingReport>> {
  const { data, error } = await supabase
    .from("marketing_balance_reports")
    .select(COLUMNS)
    .order("month", { ascending: true });
  if (error) throw new Error(`marketing_balance_reports: ${error.message}`);
  return new Map(((data ?? []) as Row[]).map((r) => [r.month, fromRow(r)]));
}

/** The column is a Postgres integer; anything past this isn't a bank
 *  balance, it's a typo — reject it before the database has to. */
export const MAX_BALANCE_CENTS = 2_147_483_647;

/** "1,234.56" / "$1234" / "1234.5" → cents; null when it isn't money
 *  (or is too large to be a real balance). */
export function parseDollarsToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d{1,10}(\.\d{0,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  return cents > MAX_BALANCE_CENTS ? null : cents;
}

export async function saveMarketingReport(
  supabase: SupabaseClient,
  input: { month: string; balanceCents: number; reportedBy: string | null; note?: string | null },
): Promise<MarketingReport> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month)) {
    throw new Error("month must be YYYY-MM");
  }
  if (
    !Number.isInteger(input.balanceCents) ||
    input.balanceCents < 0 ||
    input.balanceCents > MAX_BALANCE_CENTS
  ) {
    throw new Error("balance must be a whole number of cents, zero or more");
  }
  const { data, error } = await supabase
    .from("marketing_balance_reports")
    .upsert(
      {
        month: input.month,
        balance_cents: input.balanceCents,
        reported_on: new Date().toISOString().slice(0, 10),
        reported_by: input.reportedBy,
        note: input.note ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "month" },
    )
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data as Row);
}
