import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import {
  daysAgo,
  fetchPaidPayments,
  getEmailMap,
  paymentDate,
  startOfMonth,
  sumCents,
} from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/revenue?days=30 — JSON twin of /admin/revenue.
 * Reads the one-time `payments` table; Stripe not being wired is the
 * expected steady state (fetchPaidPayments degrades to []), so an
 * empty money table returns hasAny:false — never a 500.
 *
 * Payload: top-line cents (all-time, MTD), daily buckets for the bar
 * chart (server-local calendar days, matching the web page), the
 * subscriptions/one-time/refunds breakdown, and the individual
 * payment rows so mobile can render a ledger. All amounts are cents —
 * formatting stays on the client.
 */
export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const supabase = gate.admin;

  const url = new URL(request.url);
  const days = Math.min(
    365,
    Math.max(1, Number.parseInt(url.searchParams.get("days") ?? "30", 10) || 30),
  );

  // Mobile revenue joins the page (2026-08-21). Until now this route
  // read only `payments`, which is Stripe-by-construction, so every
  // dollar from Apple and Google was invisible on the one screen that
  // exists to answer "how are we doing". Store amounts are GROSS —
  // commission comes off after — and the response labels them so.
  const [payments, emails, storeRows] = await Promise.all([
    fetchPaidPayments(supabase),
    getEmailMap(supabase),
    supabase
      .from("store_purchases")
      .select("amount_cents, kind, platform, purchased_at, refunded_at")
      .order("purchased_at", { ascending: false })
      .limit(5000)
      .then((r) => r.data ?? []),
  ]);
  type StoreRow = {
    amount_cents: number;
    kind: string;
    platform: string;
    purchased_at: string;
    refunded_at: string | null;
  };
  const store = storeRows as StoreRow[];
  const storeEarned = store.filter((r) => !r.refunded_at);
  const storeCents = (from?: Date) =>
    storeEarned
      .filter((r) => (from ? new Date(r.purchased_at) >= from : true))
      .reduce((a, r) => a + r.amount_cents, 0);

  const webMtd = sumCents(payments, startOfMonth());
  const webAllTime = sumCents(payments);
  const storeMtd = storeCents(startOfMonth());
  const storeAllTime = storeCents();
  const mtd = webMtd + storeMtd;
  const allTime = webAllTime + storeAllTime;

  // Daily buckets — bucket by SERVER-LOCAL calendar day (not
  // toISOString/UTC) so a late-evening payment doesn't slide into
  // tomorrow's bar. Same keying as the web chart.
  const localDayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const daily: { key: string; label: string; cents: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = daysAgo(i);
    daily.push({
      key: localDayKey(d),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      cents: 0,
    });
  }
  const byKey = new Map(daily.map((d) => [d.key, d]));
  const windowStart = daysAgo(days - 1);
  for (const p of payments) {
    if (p.status !== "paid") continue;
    const date = paymentDate(p);
    if (date < windowStart) continue;
    const bucket = byKey.get(localDayKey(date));
    if (bucket) bucket.cents += p.amount_cents;
  }
  for (const r of storeEarned) {
    const date = new Date(r.purchased_at);
    if (date < windowStart) continue;
    const bucket = byKey.get(localDayKey(date));
    if (bucket) bucket.cents += r.amount_cents;
  }

  // Breakdown: subscriptions vs one-time vs refunds.
  const subscriptionCents =
    payments
      .filter((p) => p.status === "paid" && p.purpose === "subscription")
      .reduce((a, p) => a + p.amount_cents, 0) +
    storeEarned
      .filter((r) => r.kind === "subscription")
      .reduce((a, r) => a + r.amount_cents, 0);
  const oneTimeCents =
    payments
      .filter((p) => p.status === "paid" && p.purpose !== "subscription")
      .reduce((a, p) => a + p.amount_cents, 0) +
    storeEarned
      .filter((r) => r.kind !== "subscription")
      .reduce((a, r) => a + r.amount_cents, 0);
  const refundedCents =
    payments
      .filter((p) => p.status === "refunded")
      .reduce((a, p) => a + p.amount_cents, 0) +
    store
      .filter((r) => r.refunded_at)
      .reduce((a, r) => a + r.amount_cents, 0);

  return NextResponse.json({
    hasAny: payments.length > 0 || store.length > 0,
    all_time_cents: allTime,
    mtd_cents: mtd,
    daily,
    // Per-rail split so the page can show where the money came from.
    // Store figures are GROSS of Apple/Google commission.
    by_channel: {
      web_all_time_cents: webAllTime,
      web_mtd_cents: webMtd,
      store_all_time_cents: storeAllTime,
      store_mtd_cents: storeMtd,
      store_ios_cents: storeEarned
        .filter((r) => r.platform === "ios")
        .reduce((a, r) => a + r.amount_cents, 0),
      store_android_cents: storeEarned
        .filter((r) => r.platform === "android")
        .reduce((a, r) => a + r.amount_cents, 0),
      store_is_gross: true,
    },
    breakdown: {
      subscription_cents: subscriptionCents,
      one_time_cents: oneTimeCents,
      refunded_cents: refundedCents,
      net_all_time_cents: subscriptionCents + oneTimeCents,
    },
    // Newest first (fetchPaidPayments orders created_at desc). Stitch
    // user_email onto each row so the mobile ledger renders the buyer
    // instead of a truncated user_id.
    rows: payments.map((p) => ({
      ...p,
      user_email: emails.get(p.user_id) ?? null,
    })),
  });
}
