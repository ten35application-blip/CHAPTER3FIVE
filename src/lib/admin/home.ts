import type { SupabaseClient } from "@supabase/supabase-js";
import {
  daysAgo,
  fetchPaidPayments,
  getEmailMap,
  safeCount,
  safeSelect,
  startOfMonth,
  startOfToday,
  sumCents,
} from "@/lib/admin/queries";

/**
 * One data shape for the three-drawer admin (Wilson 2026-08-26) —
 * assembled HERE so the web page and the mobile app render the same
 * truth from the same queries and can never drift. Everything is
 * plain serializable data: the web page adds links, the app adds
 * navigation, neither re-derives a number.
 */

export type AdminHome = {
  revenue: {
    today: number;
    week: number;
    month: number;
    allTime: number;
    ledger: {
      when: string;
      email: string;
      item: string;
      platform: string;
      amountCents: number;
      refunded: boolean;
    }[];
    openFailures: { when: string; email: string; kind: string }[];
  };
  users: {
    total: number;
    newThisWeek: number;
    rows: {
      id: string;
      email: string;
      joined: string;
      plan: string;
      lastSeen: string | null;
    }[];
  };
  reports: {
    crisis: { id: string; userId: string | null; email: string; when: string }[];
    messages: { when: string; reporter: string; reason: string; status: string }[];
    identities: { when: string; reporter: string; reason: string; status: string }[];
    needingEyes: number;
  };
};

type StoreRow = {
  user_id: string | null;
  product_id: string | null;
  platform: string | null;
  amount_cents: number | null;
  purchased_at: string | null;
  refunded_at: string | null;
};
type ProfileRow = {
  id: string;
  created_at: string;
  subscription_tier: string | null;
  pro_until: string | null;
  last_active_at: string | null;
  deleted_at: string | null;
};
type ReportRow = {
  id: string;
  reason: string | null;
  status: string | null;
  created_at: string;
  reporter_user_id: string | null;
};
type CrisisRow = {
  id: string;
  user_id: string | null;
  flagged_at: string;
  resolved_at: string | null;
};
type FailRow = {
  id: string;
  kind: string | null;
  created_at: string;
  user_id: string | null;
  resolved_at: string | null;
};

export async function fetchAdminHome(
  supabase: SupabaseClient,
): Promise<AdminHome> {
  const monthStart = startOfMonth();
  const today = startOfToday();
  const week = daysAgo(7);

  const [
    payments,
    storeRows,
    profiles,
    totalUsers,
    msgReports,
    oracleReports,
    crisisFlags,
    grantFails,
  ] = await Promise.all([
    fetchPaidPayments(supabase),
    safeSelect<StoreRow>(
      supabase,
      "store_purchases",
      "user_id, product_id, platform, amount_cents, purchased_at, refunded_at",
      (q) => q.order("purchased_at", { ascending: false }).limit(200),
    ),
    safeSelect<ProfileRow>(
      supabase,
      "profiles",
      "id, created_at, subscription_tier, pro_until, last_active_at, deleted_at",
      (q) => q.order("created_at", { ascending: false }).limit(100),
    ),
    safeCount(supabase, "profiles"),
    safeSelect<ReportRow>(
      supabase,
      "message_reports",
      "id, reason, status, created_at, reporter_user_id",
      (q) => q.order("created_at", { ascending: false }).limit(50),
    ),
    safeSelect<ReportRow>(
      supabase,
      "oracle_reports",
      "id, reason, status, created_at, reporter_user_id",
      (q) => q.order("created_at", { ascending: false }).limit(50),
    ),
    safeSelect<CrisisRow>(
      supabase,
      "crisis_flags",
      "id, user_id, flagged_at, resolved_at",
      (q) => q.order("flagged_at", { ascending: false }).limit(50),
    ),
    safeSelect<FailRow>(
      supabase,
      "grant_failures",
      "id, kind, created_at, user_id, resolved_at",
      (q) => q.order("created_at", { ascending: false }).limit(50),
    ),
  ]);

  const emails = await getEmailMap(supabase);
  const emailOf = (id: string | null | undefined) =>
    (id && emails.get(id)) || "—";

  const liveStore = storeRows.filter((r) => !r.refunded_at);
  const storeSum = (since?: Date) =>
    liveStore
      .filter((r) => !since || new Date(r.purchased_at ?? 0) >= since)
      .reduce((s, r) => s + (r.amount_cents ?? 0), 0);

  const ledger = [
    ...storeRows.map((r) => ({
      when: r.purchased_at ?? "",
      email: emailOf(r.user_id),
      item: (r.product_id ?? "").replace("chapter3five.", ""),
      platform: r.platform === "ios" ? "" : "▶",
      amountCents: r.amount_cents ?? 0,
      refunded: !!r.refunded_at,
    })),
    ...payments.map((p) => ({
      when: (p.paid_at ?? p.created_at) as string,
      email: emailOf(p.user_id),
      item: p.purpose ?? "payment",
      platform: "web",
      amountCents: p.amount_cents ?? 0,
      refunded: p.status === "refunded",
    })),
  ]
    .sort((a, b) => (a.when < b.when ? 1 : -1))
    .slice(0, 60);

  const openFailures = grantFails
    .filter((f) => !f.resolved_at)
    .map((f) => ({
      when: f.created_at,
      email: emailOf(f.user_id),
      kind: f.kind ?? "unknown",
    }));

  const openCrisis = crisisFlags
    .filter((c) => !c.resolved_at)
    .map((c) => ({
      id: c.id,
      userId: c.user_id,
      email: emailOf(c.user_id),
      when: c.flagged_at,
    }));
  const mapReport = (r: ReportRow) => ({
    when: r.created_at,
    reporter: emailOf(r.reporter_user_id),
    reason: r.reason ?? "—",
    status: r.status ?? "—",
  });
  const pending = (rows: ReportRow[]) =>
    rows.filter((r) => r.status === "pending").length;

  return {
    revenue: {
      today: storeSum(today) + sumCents(payments, today),
      week: storeSum(week) + sumCents(payments, week),
      month: storeSum(monthStart) + sumCents(payments, monthStart),
      allTime: storeSum() + sumCents(payments),
      ledger,
      openFailures,
    },
    users: {
      total: totalUsers,
      newThisWeek: profiles.filter((p) => new Date(p.created_at) >= week)
        .length,
      rows: profiles.map((p) => ({
        id: p.id,
        email: emailOf(p.id),
        joined: p.created_at,
        plan: p.deleted_at
          ? "deleted"
          : (p.subscription_tier ??
            (p.pro_until && new Date(p.pro_until) > new Date()
              ? "pro"
              : "free")),
        lastSeen: p.last_active_at,
      })),
    },
    reports: {
      crisis: openCrisis,
      messages: msgReports.map(mapReport),
      identities: oracleReports.map(mapReport),
      needingEyes:
        pending(msgReports) + pending(oracleReports) + openCrisis.length,
    },
  };
}
