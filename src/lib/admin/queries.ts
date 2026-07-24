import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Read helpers for the /admin dashboard. Everything here runs through the
 * service-role client (bypasses RLS — reads across ALL users), so these
 * must only ever be called from admin-gated server code.
 *
 * Every query is "safe": a missing table (relation does not exist) or any
 * other read error degrades to zero/empty instead of crashing the
 * dashboard. Stripe billing is not wired yet, so empty money tables are
 * the expected steady state for now.
 */

// ---------------------------------------------------------------------------
// Date helpers — all boundaries computed in server local time.
// ---------------------------------------------------------------------------

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Rolling 7-day window start ("this week" on the dashboard). */
export function daysAgo(n: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  return d;
}

export function startOfMonth(): Date {
  const d = startOfToday();
  d.setDate(1);
  return d;
}

export function startOfYear(): Date {
  const d = startOfToday();
  d.setMonth(0, 1);
  return d;
}

// ---------------------------------------------------------------------------
// Safe counting
// ---------------------------------------------------------------------------

/**
 * The PostgREST builder's chained-generics don't survive being passed
 * through a helper, so filters are applied via a loosely-typed callback.
 * Every call site is a two-line lambda — easy to eyeball.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryBuilder = any;

/**
 * Count rows in a table, tolerating a table that does not exist yet.
 * Returns 0 on any error — the admin dashboard must never 500 because a
 * migration hasn't been run.
 */
export async function safeCount(
  supabase: SupabaseClient,
  table: string,
  filter?: (q: QueryBuilder) => QueryBuilder,
): Promise<number> {
  try {
    let query: QueryBuilder = supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    if (filter) query = filter(query);
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

/** Select rows, tolerating missing tables. Returns [] on any error. */
export async function safeSelect<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  build?: (q: QueryBuilder) => QueryBuilder,
): Promise<T[]> {
  try {
    let query: QueryBuilder = supabase.from(table).select(columns);
    if (build) query = build(query);
    const { data, error } = await query;
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Auth users — the GoTrue admin API is the only way to read emails (the
// auth schema isn't exposed through PostgREST). listUsers is paged; we
// fetch up to MAX_ADMIN_USERS and work in memory. Fine at current scale;
// once the app clears a few thousand users this should move to a
// service-role SQL view over auth.users.
// ---------------------------------------------------------------------------

const MAX_ADMIN_USERS = 5000;
const PER_PAGE = 1000;

export async function listAllUsers(supabase: SupabaseClient): Promise<User[]> {
  const all: User[] = [];
  try {
    for (let page = 1; all.length < MAX_ADMIN_USERS; page++) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: PER_PAGE,
      });
      if (error || !data?.users?.length) break;
      all.push(...data.users);
      if (data.users.length < PER_PAGE) break;
    }
  } catch {
    // Degrade to whatever we managed to fetch.
  }
  return all;
}

/** user_id → email map, for stitching emails onto service-role rows. */
export async function getEmailMap(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const users = await listAllUsers(supabase);
  return new Map(users.map((u) => [u.id, u.email ?? "(no email)"]));
}

// ---------------------------------------------------------------------------
// Money — reads the one-time `payments` table (0009). There is no
// subscriptions table yet (Stripe billing is a future task), so MRR
// intentionally reports "not wired" until one exists.
// ---------------------------------------------------------------------------

export type PaymentRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  purpose: string;
  status: string;
  created_at: string;
  paid_at: string | null;
};

export async function fetchPaidPayments(
  supabase: SupabaseClient,
): Promise<PaymentRow[]> {
  return safeSelect<PaymentRow>(
    supabase,
    "payments",
    "id, user_id, amount_cents, currency, purpose, status, created_at, paid_at",
    (q) => q.in("status", ["paid", "refunded"]).order("created_at", { ascending: false }),
  );
}

/** Effective revenue timestamp for a payment. */
export function paymentDate(p: PaymentRow): Date {
  return new Date(p.paid_at ?? p.created_at);
}

export function sumCents(payments: PaymentRow[], since?: Date): number {
  return payments
    .filter((p) => p.status === "paid")
    .filter((p) => !since || paymentDate(p) >= since)
    .reduce((acc, p) => acc + p.amount_cents, 0);
}

export function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export { createAdminClient };
