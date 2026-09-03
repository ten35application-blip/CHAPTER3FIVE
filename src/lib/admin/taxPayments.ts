import type { SupabaseClient } from "@supabase/supabase-js";
import { LAUNCH_MONTH, nextMonth, settlementWindow } from "./monthBreakdown";
import { MAX_BALANCE_CENTS } from "./marketingReports";

/**
 * TAXES ACTUALLY PAID (Wilson 2026-09-02: "Taxes in Bethlehem have to be
 * paid 4 times a year, Pedro pays his in December once").
 *
 * The formula holds a tax envelope for each member out of every profit
 * month. That held money leaves the operating account when the member
 * sends an estimated payment in their own name — Danisel four times a
 * year, Pedro once in December. Every payment is recorded here; the
 * month whose window holds `paidOn` subtracts it from that member's
 * held envelope (computeBreakdown), so "the account should hold" stays
 * true to the bank. This file is the only writer of that table — the
 * web form and the mobile API both come through here. Reading for the
 * month itself happens in monthBreakdown.ts beside the other pulls.
 */

export const TAX_GOVERNMENTS = ["federal", "state", "city", "local"] as const;
export type TaxGovernment = (typeof TAX_GOVERNMENTS)[number];

/** Plain names for the four places a payment can go. */
export const TAX_GOVERNMENT_LABEL: Record<TaxGovernment, string> = {
  federal: "IRS (federal income + self-employment)",
  state: "State (PA or NY)",
  city: "New York City",
  local: "Bethlehem (Keystone Collections)",
};

export type TaxPayment = {
  id: string;
  partner: string;
  /** YYYY-MM-DD, the day the payment went out. */
  paidOn: string;
  amountCents: number;
  government: TaxGovernment;
  note: string | null;
  recordedBy: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  partner: string;
  paid_on: string;
  amount_cents: number;
  government: TaxGovernment;
  note: string | null;
  recorded_by: string | null;
  created_at: string;
};

const COLUMNS = "id, partner, paid_on, amount_cents, government, note, recorded_by, created_at";

function fromRow(r: Row): TaxPayment {
  return {
    id: r.id,
    partner: r.partner,
    paidOn: r.paid_on,
    amountCents: r.amount_cents,
    government: r.government,
    note: r.note,
    recordedBy: r.recorded_by,
    createdAt: r.created_at,
  };
}

/** Every payment ever recorded, newest first — the history list. */
export async function fetchTaxPayments(
  supabase: SupabaseClient,
  opts: { limit?: number } = {},
): Promise<TaxPayment[]> {
  const { data, error } = await supabase
    .from("tax_payments")
    .select(COLUMNS)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(500, opts.limit ?? 200)));
  if (error) throw new Error(`tax_payments: ${error.message}`);
  return ((data ?? []) as Row[]).map(fromRow);
}

/** Today's date in Bethlehem, YYYY-MM-DD. */
export function todayInNewYork(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isRealDate(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** The first day the ledger counts (the launch month's window start). */
function launchWindowStartDate(): string {
  return settlementWindow(LAUNCH_MONTH).start.toISOString().slice(0, 10);
}

export type TaxPaymentInput = {
  partner: string;
  paidOn: string;
  amountCents: number;
  government: string;
  note?: string | null;
  recordedBy: string | null;
  /** The two names on the settings row — a payment must be one of them. */
  partnerNames: string[];
};

/** Validates the way the API does, then inserts. Throws a plain-English
 *  message on bad input so the form can show it. */
export async function recordTaxPayment(
  supabase: SupabaseClient,
  input: TaxPaymentInput,
  now = new Date(),
): Promise<TaxPayment> {
  const wanted = (input.partner ?? "").trim().toLowerCase();
  const partner = input.partnerNames.find((n) => n.trim().toLowerCase() === wanted);
  if (!partner) {
    throw new Error(`partner must be one of: ${input.partnerNames.join(", ")}`);
  }
  if (!isRealDate(input.paidOn)) throw new Error("paid on must be a real date, YYYY-MM-DD");
  const today = todayInNewYork(now);
  if (input.paidOn > today) throw new Error("paid on can't be in the future");
  if (input.paidOn < launchWindowStartDate()) {
    throw new Error(`paid on can't be before the ledger started (${launchWindowStartDate()})`);
  }
  if (
    !Number.isInteger(input.amountCents) ||
    input.amountCents <= 0 ||
    input.amountCents > MAX_BALANCE_CENTS
  ) {
    throw new Error("amount must be more than zero");
  }
  if (!(TAX_GOVERNMENTS as readonly string[]).includes(input.government)) {
    throw new Error(`government must be one of: ${TAX_GOVERNMENTS.join(", ")}`);
  }
  const note = (input.note ?? "").trim();
  if (note.length > 500) throw new Error("note is too long (500 characters max)");

  const { data, error } = await supabase
    .from("tax_payments")
    .insert({
      partner,
      paid_on: input.paidOn,
      amount_cents: input.amountCents,
      government: input.government,
      note: note || null,
      recorded_by: input.recordedBy,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data as Row);
}

/** Removes a payment that was typed wrong — only while the month it
 *  counts in is still live. Once a month is frozen its figures are the
 *  record; a payment already inside one can't be deleted here (record
 *  the correction in the open month instead). */
export async function deleteTaxPayment(supabase: SupabaseClient, id: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("bad id");
  const { data: row, error } = await supabase
    .from("tax_payments")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`tax_payments: ${error.message}`);
  if (!row) throw new Error("that payment is already gone");

  const { data: latest, error: sErr } = await supabase
    .from("settlements")
    .select("month, settled_at")
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (sErr) throw new Error(`settlements: ${sErr.message}`);
  if (latest) {
    const liveStart = settlementWindow(nextMonth(latest.month as string)).start.toISOString().slice(0, 10);
    const r = row as Row;
    // Dated inside a frozen window AND recorded before that freeze → it
    // was counted (directly, or swept in late). Frozen figures stay.
    if (r.paid_on < liveStart && r.created_at < (latest.settled_at as string)) {
      throw new Error(
        `that payment is already inside a frozen month (${latest.month} is final) — it can't be deleted; record a correction instead`,
      );
    }
  }
  const { error: dErr } = await supabase.from("tax_payments").delete().eq("id", id);
  if (dErr) throw new Error(dErr.message);
}
