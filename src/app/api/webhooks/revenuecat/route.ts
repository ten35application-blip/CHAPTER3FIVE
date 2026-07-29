import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * RevenueCat webhook receiver → iap_entitlements mirror (0122).
 *
 * RevenueCat validates App Store / Play receipts and fires one event
 * per subscription lifecycle change. We mirror the result into
 * public.iap_entitlements so server code can call is_entitled()
 * without a RevenueCat round-trip. The mobile client passes the
 * Supabase user id as app_user_id at Purchases.configure() time,
 * which is what keys the upsert here.
 *
 * Handled:
 *   INITIAL_PURCHASE / RENEWAL / UNCANCELLATION → upsert active row
 *   PRODUCT_CHANGE                → upsert (new product_id, new expiry)
 *   NON_RENEWING_PURCHASE         → upsert with expires_at NULL (lifetime)
 *   CANCELLATION                  → keep access until expiration_at_ms
 *                                   (auto-renew off ≠ access off)
 *   EXPIRATION                    → expires_at forced into the past
 *                                   (row kept for history/audit)
 *   TEST                          → 200 ack (dashboard "send test event")
 *   everything else               → 200 ack, logged, no state change
 *
 * Auth: RevenueCat sends the literal Authorization header value
 * configured in its dashboard. We require REVENUECAT_WEBHOOK_SECRET
 * and accept either the raw secret or "Bearer <secret>". Fable audit
 * H1: a missing secret is a hard 500, never an open door.
 */

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  entitlement_ids?: string[] | null;
  product_id?: string;
  expiration_at_ms?: number | null;
  store?: string;
  original_transaction_id?: string | null;
  id?: string;
  environment?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function platformFromStore(store: string | undefined): "ios" | "android" | "web" {
  switch (store) {
    case "APP_STORE":
    case "MAC_APP_STORE":
      return "ios";
    case "PLAY_STORE":
    case "AMAZON":
      return "android";
    default:
      return "web";
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!secret) {
    console.error(
      "[revenuecat-webhook] REVENUECAT_WEBHOOK_SECRET is not set — refusing to accept unsigned webhooks. Set it in the environment and in the RevenueCat dashboard (Integrations → Webhooks → Authorization header).",
    );
    return NextResponse.json(
      { error: "Webhook not configured" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, secret) && !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: RevenueCatEvent;
  try {
    const body = (await request.json()) as { event?: RevenueCatEvent };
    event = body.event ?? {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = event.type ?? "UNKNOWN";
  if (type === "TEST") {
    return NextResponse.json({ received: true, test: true });
  }

  const handled = new Set([
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE",
    "CANCELLATION",
    "EXPIRATION",
  ]);
  if (!handled.has(type)) {
    console.log(`[revenuecat-webhook] ignoring event type ${type}`);
    return NextResponse.json({ received: true, ignored: type });
  }

  const appUserId = event.app_user_id ?? "";
  if (!UUID_RE.test(appUserId)) {
    // $RCAnonymousID:… — a purchase made before Purchases.configure ran
    // with a Supabase session. RevenueCat will re-fire under the real
    // id after logIn/aliasing; ack so it doesn't retry this one forever.
    console.warn(
      `[revenuecat-webhook] ${type} for non-UUID app_user_id (${appUserId.slice(0, 24)}…) — skipping`,
    );
    return NextResponse.json({ received: true, skipped: "anonymous-app-user-id" });
  }

  const entitlementIds = (event.entitlement_ids ?? []).filter(
    (e): e is string => typeof e === "string" && e.length > 0,
  );
  if (entitlementIds.length === 0) {
    console.warn(
      `[revenuecat-webhook] ${type} for product ${event.product_id ?? "?"} carries no entitlement_ids — attach the product to an entitlement in RevenueCat`,
    );
    return NextResponse.json({ received: true, skipped: "no-entitlements" });
  }

  const expiresAt =
    type === "EXPIRATION"
      ? new Date(
          Math.min(event.expiration_at_ms ?? Date.now(), Date.now()),
        ).toISOString()
      : typeof event.expiration_at_ms === "number"
        ? new Date(event.expiration_at_ms).toISOString()
        : null;

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const rows = entitlementIds.map((entitlementId) => ({
    user_id: appUserId,
    entitlement_id: entitlementId,
    product_id: event.product_id ?? "unknown",
    expires_at: expiresAt,
    platform: platformFromStore(event.store),
    revenuecat_user_id: appUserId,
    original_transaction_id: event.original_transaction_id ?? null,
    updated_at: now,
  }));

  const { error } = await admin
    .from("iap_entitlements")
    .upsert(rows, { onConflict: "user_id,entitlement_id" });

  if (error) {
    console.error(
      `[revenuecat-webhook] upsert failed for event ${event.id ?? "?"} (${type}): ${error.message}`,
    );
    // 500 → RevenueCat retries with backoff; a transient DB hiccup
    // must not silently drop an entitlement grant.
    return NextResponse.json({ error: "Upsert failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true, type, entitlements: entitlementIds });
}
