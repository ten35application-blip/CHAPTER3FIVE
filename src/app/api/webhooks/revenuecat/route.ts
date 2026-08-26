import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleAutoPopulate } from "@/lib/subscription/autoPopulate";
import { PRICING } from "@/lib/pricing";
import { recordGrantFailure } from "@/lib/billing/grantFailure";
import {
  sendPackPurchasedEmail,
  sendPlanStartedEmail,
  sendRefundProcessedEmail,
} from "@/lib/notifications";

export const runtime = "nodejs";

// Subscribe-time auto-populate runs inside after() and can chain
// synth (~30s each × up to 4) + face generation off the same
// invocation. Match the Stripe webhook's 300s headroom so the
// background chain has room to finish here too.
export const maxDuration = 300;

/**
 * RevenueCat entitlement_ids that map to our Basic / Pro tiers.
 * The mapping mirrors what the mobile IAP dashboard attaches to
 * the products — "basic" and "pro" are the canonical entitlement
 * ids (see 0122 comments for the setup). A future rename here
 * must be paired with a RevenueCat dashboard rename.
 */
/**
 * Add-on pack SKUs → credits, mirroring the Stripe path's grants and
 * PRICING's spec: every pack credits BOTH counters, never either/or.
 * Product ids match chapter3five-app/app/upgrade.tsx PRODUCT_PREFIX.
 */
/**
 * The three $4.99 store consumables that grant ONE credit each —
 * the mobile twins of the web's Stripe purchases (2026-08-19, "the
 * right fucking way": no more Stripe-in-browser on phones). Counter
 * names ride the same SECURITY DEFINER RPC allowlist the Stripe
 * webhook already uses for the identical grants.
 */
const CREDIT_PRODUCTS: Record<
  string,
  { counter: string; refundWhat: string; refundDetail: string }
> = {
  "chapter3five.unlock.inherit": {
    counter: "inherited_slot_credits",
    refundWhat: "Your archive-unlock purchase",
    refundDetail: "The unused unlock was removed from your account.",
  },
  "chapter3five.slot.extra": {
    counter: "extra_oracle_credits",
    refundWhat: "Your extra companion slot",
    refundDetail: "The unused slot was removed from your account.",
  },
  "chapter3five.archive.other": {
    counter: "other_identity_credits",
    refundWhat: "Your archive purchase",
    refundDetail: "The unused archive credit was removed from your account.",
  },
};

/**
 * What each store product costs the customer, in cents. GROSS — the
 * store's commission comes off after, and the net figures live in
 * RevenueCat and the stores' own financial reports. Used only to give
 * the admin revenue page a mobile number (2026-08-21); nothing about
 * entitlements or grants reads this.
 */
const STORE_PRICE_CENTS: Record<string, { cents: number; kind: "subscription" | "one_time" }> = {
  "chapter3five.basic.monthly": { cents: 499, kind: "subscription" },
  "chapter3five.pro.monthly": { cents: 999, kind: "subscription" },
  "chapter3five.pack.small": { cents: 499, kind: "one_time" },
  "chapter3five.pack.medium": { cents: 999, kind: "one_time" },
  "chapter3five.pack.large": { cents: 1999, kind: "one_time" },
  "chapter3five.unlock.inherit": { cents: 499, kind: "one_time" },
  "chapter3five.slot.extra": { cents: 499, kind: "one_time" },
  "chapter3five.archive.other": { cents: 499, kind: "one_time" },
};

/**
 * Record one store purchase (or stamp a refund) in the mobile revenue
 * ledger. Best-effort and last in every handler: a bookkeeping failure
 * must never fail the grant a customer already paid for. Idempotent on
 * RevenueCat's event id, so a retried delivery can't double-count.
 *
 * Play appends its base plan to subscription ids
 * ("chapter3five.pro.monthly:monthly"), so the lookup strips it.
 */
async function recordStorePurchase(event: RevenueCatEvent, appUserId: string) {
  try {
    const rawId = event.product_id ?? "";
    const productId = rawId.split(":")[0];
    const price = STORE_PRICE_CENTS[productId];
    if (!price) return;
    const admin = createAdminClient();

    if (isRefund(event)) {
      await admin
        .from("store_purchases")
        .update({ refunded_at: new Date().toISOString() })
        .eq("user_id", appUserId)
        .eq("product_id", productId)
        .is("refunded_at", null);
      return;
    }
    const EARNING_EVENTS = new Set([
      "INITIAL_PURCHASE",
      "RENEWAL",
      "PRODUCT_CHANGE",
      "NON_RENEWING_PURCHASE",
    ]);
    if (!EARNING_EVENTS.has(event.type ?? "")) return;

    await admin.from("store_purchases").insert({
      user_id: appUserId,
      platform: platformFromStore(event.store),
      product_id: productId,
      amount_cents: price.cents,
      kind: price.kind,
      original_transaction_id: event.original_transaction_id ?? null,
      revenuecat_event_id: event.id ?? null,
      event_type: event.type ?? null,
    });
  } catch (err) {
    // 23505 = replayed delivery, which is the guard working.
    const code = (err as { code?: string })?.code;
    if (code !== "23505") {
      console.error("[revenuecat-webhook] store_purchases record failed:", err);
    }
  }
}

const PACK_CREDITS: Record<string, { messages: number; images: number }> = {
  "chapter3five.pack.small": {
    messages: PRICING.packSmallMessages,
    images: PRICING.packSmallImages,
  },
  "chapter3five.pack.medium": {
    messages: PRICING.packMediumMessages,
    images: PRICING.packMediumImages,
  },
  "chapter3five.pack.large": {
    messages: PRICING.packLargeMessages,
    images: PRICING.packLargeImages,
  },
};

const BASIC_ENTITLEMENT_ID = "basic";
const PRO_ENTITLEMENT_ID = "pro";

/**
 * Which RevenueCat event types should kick the subscribe-time
 * populate? RENEWAL was intentionally REMOVED here (audit gap #3,
 * Wilson approval 2026-08-03): a user who deletes an
 * auto-populated companion (they didn't like Marisol) shouldn't
 * get her silently re-created every month at renewal. Populate is
 * a subscribe-time event, not a maintenance one — matches
 * Stripe's handleInvoicePaid which also does NOT re-populate.
 *
 * The three remaining triggers all mark "user just gained (or
 * regained) an active basic/pro entitlement": fresh purchase,
 * un-cancel of a still-active sub, product change (Basic→Pro).
 */
const AUTO_POPULATE_TRIGGER_TYPES = new Set([
  "INITIAL_PURCHASE",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);

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
  /** When the store took the money. Used as the LAST-RESORT component of
   *  the idempotency key for repeat consumable purchases — see the
   *  claim-key note below. */
  purchased_at_ms?: number | null;
  environment?: string;
  // TRANSFER events only: the app user ids the store receipt moved
  // between. No product/entitlement fields accompany them.
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  // BILLING_ISSUE only: how long the store keeps the subscription
  // alive while it retries the card.
  grace_period_expiration_at_ms?: number | null;
  // CANCELLATION only: why. "CUSTOMER_SUPPORT" is the store telling us
  // the money was REFUNDED, which is categorically different from a
  // user switching off auto-renew.
  cancel_reason?: string | null;
};

/**
 * Sentinel expiry for entitlements the store reports with no
 * expiration (NON_RENEWING lifetime purchases). Every server-side
 * tier gate reads profiles.pro_until, so "no expiry" must still land
 * there as a date or the customer pays and gates them as Free
 * (audit finding #10).
 */
const FAR_FUTURE_ISO = "2099-01-01T00:00:00.000Z";

/**
 * Was this cancellation a REFUND? Apple and Google report a refunded
 * purchase as a CANCELLATION carrying a support reason. The difference
 * matters: someone who turns off auto-renew keeps what they paid for
 * until the period ends, while someone who got their money back should
 * not still be holding the goods. Stripe's webhook has always reversed
 * refunded credits; the store path never did (Wilson 2026-08-16: "does
 * refunds work perfectly?" — it did not).
 */
function isRefund(event: { type?: string; cancel_reason?: string | null }) {
  return (
    event.type === "CANCELLATION" &&
    (event.cancel_reason === "CUSTOMER_SUPPORT" ||
      event.cancel_reason === "DEVELOPER_INITIATED")
  );
}

/** The account's email, or null. Every receipt below is best-effort:
 *  a mail failure must never fail the money path. */
async function emailFor(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

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

  // ── TRANSFER ────────────────────────────────────────────────────
  // A store receipt moved between app user ids (same phone, new
  // account — e.g. re-register then Restore Purchases). The event
  // carries NO product/entitlement fields, only the two ids, and
  // ignoring it left the new account with nothing until the next
  // renewal — up to a month in production (Wilson hit this live
  // 2026-08-15: Apple said Pro, the app said Basic, the backend said
  // nothing). Move the old account's entitlement rows to the new one
  // and re-sync the profile tier from what moved.
  if (type === "TRANSFER") {
    const toId =
      (event.transferred_to ?? []).find((id) => UUID_RE.test(id)) ?? null;
    const fromIds = (event.transferred_from ?? []).filter(
      (id) => UUID_RE.test(id) && id !== toId,
    );
    if (!toId || fromIds.length === 0) {
      return NextResponse.json({ received: true, skipped: "transfer-no-uuid" });
    }
    const adminT = createAdminClient();
    const { data: oldRows } = await adminT
      .from("iap_entitlements")
      .select("entitlement_id, product_id, expires_at, platform, original_transaction_id")
      .in("user_id", fromIds);
    const nowIso = new Date().toISOString();
    if (oldRows && oldRows.length > 0) {
      // Move by UPDATE-in-place, not select-copy-insert: the rows carry
      // original_transaction_id, which has its own UNIQUE index, so
      // inserting a copy while the old row still exists is a guaranteed
      // 23505 → 500 → RevenueCat retry loop (audit finding #1 — the
      // first version of this handler did exactly that). Updating the
      // owner never collides with the transaction-id index. Clear the
      // destination's same-name entitlements first so the
      // (user_id, entitlement_id) key can't collide either.
      const { error: clearErr } = await adminT
        .from("iap_entitlements")
        .delete()
        .eq("user_id", toId)
        .in("entitlement_id", oldRows.map((r) => r.entitlement_id));
      const { error: moveErr } = clearErr
        ? { error: clearErr }
        : await adminT
            .from("iap_entitlements")
            .update({
              user_id: toId,
              revenuecat_user_id: toId,
              updated_at: nowIso,
            })
            .in("user_id", fromIds);
      if (moveErr) {
        console.error(
          `[revenuecat-webhook] TRANSFER move failed → ${toId}: ${moveErr.message}`,
        );
        return NextResponse.json({ error: "Transfer move failed" }, { status: 500 });
      }

      // Re-derive the tier from what moved (pro beats basic, matching
      // the resolution below) and sync the profile so tier gates see it.
      const live = oldRows.filter(
        (r) => r.expires_at === null || new Date(r.expires_at) > new Date(),
      );
      const movedTier = live.some((r) => r.entitlement_id === PRO_ENTITLEMENT_ID)
        ? ("pro" as const)
        : live.some((r) => r.entitlement_id === BASIC_ENTITLEMENT_ID)
          ? ("basic" as const)
          : null;
      if (movedTier) {
        const until =
          live
            .filter((r) => r.entitlement_id === movedTier && r.expires_at)
            .map((r) => r.expires_at as string)
            .sort()
            .pop() ?? FAR_FUTURE_ISO; // null expiry = lifetime row
        // Same cross-channel guards as the main entitlement path
        // (ultrareview 2026-08-19 finding #3): a TRANSFER wrote the
        // profile unconditionally, so a Stripe Pro subscriber whose
        // phone once held an IAP Basic on another account could tap
        // Restore Purchases and be silently demoted to Basic caps —
        // while Stripe kept billing Pro and plan_source pointed the
        // cancel UI at the wrong store. A transfer may extend time or
        // raise rank on the destination; it must never lower either
        // while Stripe or a comp holds the account.
        const { data: destCurrent } = await adminT
          .from("profiles")
          .select(
            "pro_until, subscription_tier, stripe_subscription_id, subscription_status, plan_source",
          )
          .eq("id", toId)
          .maybeSingle<{
            pro_until: string | null;
            subscription_tier: string | null;
            stripe_subscription_id: string | null;
            subscription_status: string | null;
            plan_source: string | null;
          }>();
        const destStripeHolds =
          !!destCurrent?.stripe_subscription_id &&
          destCurrent.subscription_status !== "canceled";
        const destComped = destCurrent?.plan_source === "admin_grant";
        const destWouldShorten =
          !!destCurrent?.pro_until &&
          new Date(until).getTime() < new Date(destCurrent.pro_until).getTime();
        const destWouldLowerTier =
          destCurrent?.subscription_tier === "pro" && movedTier === "basic";
        if (
          (destWouldShorten || destWouldLowerTier) &&
          (destStripeHolds || destComped)
        ) {
          console.log(
            `[revenuecat-webhook] TRANSFER to ${toId} would ${destWouldLowerTier ? "lower tier" : "shorten pro_until"} but ${destComped ? "the account is comped" : `Stripe subscription ${destCurrent?.stripe_subscription_id} is active`} — entitlement rows moved, profile left alone`,
          );
        } else {
          await adminT
            .from("profiles")
            .update({
              pro_until: until,
              subscription_tier: movedTier,
              plan_source: "iap",
            })
            .eq("id", toId);
          scheduleAutoPopulate(toId, movedTier);
        }
      }
      // The store receipt now lives on the destination — the SOURCE
      // accounts must stop being entitled by it, or one payment holds
      // two accounts for the rest of the cycle (self-audit 2026-08-25).
      // Only IAP-sourced profiles are cleared: a source account with
      // its own Stripe subscription keeps what Stripe is billing for.
      await adminT
        .from("profiles")
        .update({ pro_until: null, subscription_tier: null })
        .in("id", fromIds)
        .eq("plan_source", "iap");
      console.log(
        `[revenuecat-webhook] TRANSFER moved ${oldRows.length} entitlement(s) ${fromIds.join(",")} → ${toId} (tier ${movedTier ?? "none"})`,
      );
      return NextResponse.json({ received: true, transferred: oldRows.length });
    }
    // Nothing to move (the old account's rows were deleted with it).
    // The next store event under the new id fills the gap; log so a
    // stuck account has a trail.
    console.warn(
      `[revenuecat-webhook] TRANSFER ${fromIds.join(",")} → ${toId} had no rows to move`,
    );
    return NextResponse.json({ received: true, transferred: 0 });
  }

  const handled = new Set([
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE",
    "CANCELLATION",
    "EXPIRATION",
    // Card is failing but the store keeps the sub alive through its
    // grace period — extend access to match (audit finding #3).
    "BILLING_ISSUE",
    // Store/developer extended the subscription (outage compensation
    // etc.) — carry the new expiry forward (audit finding #4).
    "SUBSCRIPTION_EXTENDED",
  ]);
  if (!handled.has(type)) {
    console.log(`[revenuecat-webhook] ignoring event type ${type}`);
    return NextResponse.json({ received: true, ignored: type });
  }

  const now = new Date().toISOString();
  const appUserId = event.app_user_id ?? "";

  // Mobile revenue bookkeeping (2026-08-21). Fire-and-forget, ahead of
  // every branch below so a purchase is counted regardless of which
  // handler claims it — and awaited nowhere, so it can never delay or
  // fail a grant.
  // Sandbox events grant entitlement (testers must be able to test)
  // but never book revenue — /admin/revenue was counting Apple sandbox
  // "purchases" as store income (self-audit 2026-08-25).
  if (appUserId && event.environment !== "SANDBOX") {
    void recordStorePurchase(event, appUserId);
  }
  if (!UUID_RE.test(appUserId)) {
    // $RCAnonymousID:… — a purchase made before Purchases.configure ran
    // with a Supabase session. RevenueCat does NOT replay past events
    // after aliasing (audit finding #7) — the money is real and the
    // grant won't land until the next renewal, so leave a reconcilable
    // trail instead of only a log line. Ack so RC doesn't retry.
    console.warn(
      `[revenuecat-webhook] ${type} for non-UUID app_user_id (${appUserId.slice(0, 24)}…) — skipping`,
    );
    if (type !== "EXPIRATION" && type !== "CANCELLATION") {
      await recordGrantFailure({
        kind: "unrecognized_purchase",
        userId: null,
        purpose: `revenuecat:anonymous:${type}:${event.product_id ?? "?"}:${appUserId.slice(0, 48)} (txn ${event.original_transaction_id ?? "?"})`,
        error: new Error("purchase event under RC anonymous app_user_id"),
      });
    }
    return NextResponse.json({ received: true, skipped: "anonymous-app-user-id" });
  }

  // ── Add-on packs ────────────────────────────────────────────────
  // Consumables, so RevenueCat sends NON_RENEWING_PURCHASE with a null
  // expiration and (typically) no entitlement. Before 2026-08-04 they
  // fell through BOTH guards below — the no-entitlements bail-out, and
  // then `expiresAt !== null` on the profiles sync — so a pack purchase
  // credited nothing at all. The app charged up to $20 through Apple,
  // showed "You're in — your purchase is active on your account", and
  // the user went back to a hard message cap. Only the Stripe webhook
  // ever granted pack credits.
  // ── $4.99 single-credit consumables (inherit unlock / extra slot /
  // other-archive mint). Same lifecycle as the packs: claim row keyed
  // by store transaction is the idempotency guard both directions —
  // purchases grant once, refunds claw back once and keep the row's
  // memory (renamed) so stale duplicate purchase deliveries can never
  // re-grant after a refund.
  // BASE PRODUCT ID, with any Play base-plan suffix removed.
  //
  // Google appends the base plan to subscription ids
  // ("chapter3five.pro.monthly:monthly"); Apple never does. Confirmed
  // against the live RevenueCat ledger: Play subscriptions carry the
  // suffix, Play one-time products do not — which is the only reason the
  // grant lookups below have worked, since they matched on the raw id.
  //
  // That is luck, not design, and it is the wrong thing to be lucky
  // about: the day Google appends anything to a consumable, the lookup
  // misses, the branch is skipped, and the customer is charged with no
  // credits granted and nothing in the logs saying so. Only
  // recordStorePurchase was stripping it, and that is bookkeeping — it
  // grants nothing.
  //
  // Stripping is a no-op on Apple ids (no colon), so this changes
  // nothing that works today.
  const baseProductId = (event.product_id ?? "").split(":")[0];

  const creditProduct = CREDIT_PRODUCTS[baseProductId];
  if (creditProduct) {
    const adminCredit = createAdminClient();
    const creditTxn =
      event.original_transaction_id ??
      event.id ??
      // LAST RESORT, and it must stay unique PER PURCHASE. These are
      // consumables people are meant to buy over and over — as many
      // formula companions and as many photo companions as they want —
      // and the claim row is a UNIQUE key. The old fallback was
      // `${appUserId}:${product_id}`, identical on every purchase of the
      // same product by the same person, so if a delivery ever arrived
      // without both a transaction id and an event id, the SECOND
      // purchase would collide, return "credit-already-granted", and
      // leave someone charged with nothing to show for it.
      //
      // purchased_at_ms keeps the guard honest in both directions: the
      // same event redelivered carries the same timestamp and still
      // dedupes, while a genuine second purchase carries a different one
      // and grants. (RevenueCat always sends `id` in practice, so this
      // branch is a belt — but the failure it guards is the worst kind,
      // and repeat buying is the whole point of these SKUs.)
      `${appUserId}:${event.product_id}:${event.purchased_at_ms ?? "no-timestamp"}`;
    if (isRefund(event)) {
      const { data: claim } = await adminCredit
        .from("iap_entitlements")
        .update({ entitlement_id: `credit-refunded:${creditTxn}`, updated_at: now })
        .eq("user_id", appUserId)
        .eq("entitlement_id", `credit:${creditTxn}`)
        .select("entitlement_id");
      if (!claim || claim.length === 0) {
        return NextResponse.json({ received: true, skipped: "credit-refund-already-applied" });
      }
      await adminCredit.rpc("increment_profile_counter", {
        target_user_id: appUserId,
        counter_name: creditProduct.counter,
        delta: -1,
      });
      const refundTo = await emailFor(adminCredit, appUserId);
      if (refundTo) {
        await sendRefundProcessedEmail({
          to: refundTo,
          userId: appUserId,
          what: creditProduct.refundWhat,
          detail: creditProduct.refundDetail,
        }).catch(() => {});
      }
      return NextResponse.json({ received: true, refunded: "credit" });
    }
    if (type !== "NON_RENEWING_PURCHASE" && type !== "INITIAL_PURCHASE") {
      return NextResponse.json({ received: true, ignored: `${type}-credit` });
    }
    const { error: creditClaimErr } = await adminCredit
      .from("iap_entitlements")
      .insert({
        user_id: appUserId,
        entitlement_id: `credit:${creditTxn}`,
        product_id: event.product_id ?? "unknown",
        expires_at: null,
        platform: platformFromStore(event.store),
        revenuecat_user_id: appUserId,
        original_transaction_id: event.original_transaction_id ?? null,
        updated_at: now,
      });
    if (creditClaimErr) {
      if ((creditClaimErr as { code?: string }).code === "23505") {
        return NextResponse.json({ received: true, skipped: "credit-already-granted" });
      }
      console.error(
        `[revenuecat-webhook] credit claim failed for ${appUserId}: ${creditClaimErr.message}`,
      );
      return NextResponse.json({ error: "Credit claim failed" }, { status: 500 });
    }
    const { error: grantErr } = await adminCredit.rpc("increment_profile_counter", {
      target_user_id: appUserId,
      counter_name: creditProduct.counter,
      delta: 1,
    });
    if (grantErr) {
      // Paid through Apple or Google, grant failed, claim row already
      // written so a retry short-circuits — a person must see this.
      await recordGrantFailure({
        kind:
          creditProduct.counter === "inherited_slot_credits"
            ? "inherited_slot"
            : creditProduct.counter === "other_identity_credits"
              ? "other_identity_create"
              : "unrecognized_purchase",
        userId: appUserId,
        delta: 1,
        purpose: `rc:${event.product_id} txn=${creditTxn}`,
        error: grantErr,
      });
      return NextResponse.json({ error: "Credit grant failed" }, { status: 500 });
    }
    console.log(
      `[revenuecat-webhook] granted ${creditProduct.counter} +1 to ${appUserId} (${event.product_id})`,
    );
    return NextResponse.json({ received: true, granted: "credit" });
  }

  //
  // Handled here, ahead of the entitlement checks, because a pack is
  // not an entitlement and should never have been routed through them.
  const packCredits = PACK_CREDITS[baseProductId];
  if (packCredits) {
    // REFUNDED PACK → take the credits back. The comment that used to
    // live here claimed Stripe doesn't claw back either; that was
    // wrong — handleChargeRefunded reverses the grant. So a pack
    // refunded through Apple or Google left the buyer holding every
    // message they'd been given, money returned, repeatable at will.
    // The claim row is the idempotency guard in BOTH directions. The
    // refund RENAMES it (pack:… → pack-refunded:…) rather than deleting:
    // a replayed refund matches nothing and no-ops, while a replayed
    // PURCHASE event still collides with the kept row's unique
    // original_transaction_id and skips. Deleting used to erase the
    // transaction's memory entirely, so a stale duplicate purchase
    // delivery arriving AFTER the refund re-granted the credits to a
    // buyer who had their money back (Android drill 2026-08-19, step 6).
    if (isRefund(event)) {
      const adminRefund = createAdminClient();
      const refundTxn =
        event.original_transaction_id ??
        event.id ??
        `${appUserId}:${event.product_id}`;
      const { data: claim } = await adminRefund
        .from("iap_entitlements")
        .update({ entitlement_id: `pack-refunded:${refundTxn}`, updated_at: now })
        .eq("user_id", appUserId)
        .eq("entitlement_id", `pack:${refundTxn}`)
        .select("entitlement_id");
      if (!claim || claim.length === 0) {
        return NextResponse.json({ received: true, skipped: "pack-refund-already-applied" });
      }
      // greatest(0, …) inside the RPC floors the balance, so a buyer
      // who already spent the credits simply lands at zero rather than
      // going negative.
      await adminRefund.rpc("increment_profile_counter", {
        target_user_id: appUserId,
        counter_name: "message_credits",
        delta: -packCredits.messages,
      });
      await adminRefund.rpc("increment_profile_counter", {
        target_user_id: appUserId,
        counter_name: "image_credits",
        delta: -packCredits.images,
      });
      console.log(
        `[revenuecat-webhook] refunded pack ${event.product_id} for ${appUserId}: -${packCredits.messages} messages, -${packCredits.images} images`,
      );
      const refundTo = await emailFor(adminRefund, appUserId);
      if (refundTo) {
        await sendRefundProcessedEmail({
          to: refundTo,
          userId: appUserId,
          what: "Your add-on pack",
          detail: `The ${packCredits.messages} messages and ${packCredits.images} photos it added have been removed from your account.`,
        }).catch(() => {});
      }
      return NextResponse.json({ received: true, refunded: "pack" });
    }
    if (type !== "NON_RENEWING_PURCHASE" && type !== "INITIAL_PURCHASE") {
      // A non-refund terminal event on a consumable (plain expiry, a
      // replayed cancellation) changes nothing — the credits were
      // legitimately bought and possibly spent.
      return NextResponse.json({ received: true, ignored: `${type}-pack` });
    }
    const adminPack = createAdminClient();
    // Idempotency: RevenueCat retries on any non-2xx, and this grant is
    // additive, so a replay would double-credit. The transaction id is
    // the stable per-purchase key.
    const txnId =
      event.original_transaction_id ??
      event.id ??
      // LAST RESORT, and it must stay unique PER PURCHASE. These are
      // consumables people are meant to buy over and over — as many
      // formula companions and as many photo companions as they want —
      // and the claim row is a UNIQUE key. The old fallback was
      // `${appUserId}:${product_id}`, identical on every purchase of the
      // same product by the same person, so if a delivery ever arrived
      // without both a transaction id and an event id, the SECOND
      // purchase would collide, return "credit-already-granted", and
      // leave someone charged with nothing to show for it.
      //
      // purchased_at_ms keeps the guard honest in both directions: the
      // same event redelivered carries the same timestamp and still
      // dedupes, while a genuine second purchase carries a different one
      // and grants. (RevenueCat always sends `id` in practice, so this
      // branch is a belt — but the failure it guards is the worst kind,
      // and repeat buying is the whole point of these SKUs.)
      `${appUserId}:${event.product_id}:${event.purchased_at_ms ?? "no-timestamp"}`;
    const { error: claimErr } = await adminPack
      .from("iap_entitlements")
      .insert({
        user_id: appUserId,
        entitlement_id: `pack:${txnId}`,
        product_id: event.product_id ?? "unknown",
        expires_at: null,
        platform: platformFromStore(event.store),
        revenuecat_user_id: appUserId,
        original_transaction_id: event.original_transaction_id ?? null,
        updated_at: now,
      });
    if (claimErr) {
      // 23505 = already claimed. Ack so RevenueCat stops retrying.
      if ((claimErr as { code?: string }).code === "23505") {
        return NextResponse.json({ received: true, skipped: "pack-already-granted" });
      }
      console.error(
        `[revenuecat-webhook] pack claim failed for ${appUserId}: ${claimErr.message}`,
      );
      return NextResponse.json({ error: "Pack claim failed" }, { status: 500 });
    }

    // Same RPC the Stripe path uses (increment_profile_counter is
    // SECURITY DEFINER with a counter-name allowlist), so both channels
    // grant identically and there is one implementation to audit.
    const { error: msgErr } = await adminPack.rpc("increment_profile_counter", {
      target_user_id: appUserId,
      counter_name: "message_credits",
      delta: packCredits.messages,
    });
    const { error: imgErr } = await adminPack.rpc("increment_profile_counter", {
      target_user_id: appUserId,
      counter_name: "image_credits",
      delta: packCredits.images,
    });
    if (msgErr || imgErr) {
      // The user PAID — through Apple or Google this time. The claim
      // row above is already written, so a RevenueCat retry
      // short-circuits on 23505 and never re-attempts the grant: there
      // is no automatic recovery, same shape as the Stripe paths. A
      // console.error was the entire record until 2026-08-06; now it
      // lands in grant_failures where a person will see it — the exact
      // treatment every Stripe grant already gets. (Stripe ids are
      // null here; purpose carries the store transaction instead.)
      if (msgErr) {
        await recordGrantFailure({
          kind: "message_credits",
          userId: appUserId,
          delta: packCredits.messages,
          purpose: `revenuecat:${event.product_id ?? "unknown"}:${txnId}`,
          error: msgErr,
        });
      }
      if (imgErr) {
        await recordGrantFailure({
          kind: "image_credits",
          userId: appUserId,
          delta: packCredits.images,
          purpose: `revenuecat:${event.product_id ?? "unknown"}:${txnId}`,
          error: imgErr,
        });
      }
      return NextResponse.json({ error: "Credit grant failed" }, { status: 500 });
    }
    console.log(
      `[revenuecat-webhook] granted pack ${event.product_id} to ${appUserId}: +${packCredits.messages} messages, +${packCredits.images} images`,
    );
    const packTo = await emailFor(adminPack, appUserId);
    if (packTo) {
      await sendPackPurchasedEmail({
        to: packTo,
        userId: appUserId,
        messages: packCredits.messages,
        images: packCredits.images,
      }).catch(() => {});
    }
    return NextResponse.json({ received: true, granted: "pack" });
  }

  const entitlementIds = (event.entitlement_ids ?? []).filter(
    (e): e is string => typeof e === "string" && e.length > 0,
  );
  if (entitlementIds.length === 0) {
    // A known subscription product with a detached entitlement is a
    // paying customer about to receive nothing — infer the entitlement
    // from the product id and keep going (the tripwire below records
    // the misconfiguration). Only unknown products still bail.
    const pid = event.product_id ?? "";
    const inferred = pid.includes(".pro.")
      ? PRO_ENTITLEMENT_ID
      : pid.includes(".basic.")
        ? BASIC_ENTITLEMENT_ID
        : null;
    if (inferred) {
      entitlementIds.push(inferred);
      await recordGrantFailure({
        kind: "message_credits",
        userId: appUserId,
        delta: 0,
        purpose: `revenuecat:no-entitlement:${pid} (attach it to the "${inferred}" entitlement in RevenueCat; tier inferred from product id)`,
        error: new Error("subscription product carried no entitlement_ids"),
      });
    } else {
      console.warn(
        `[revenuecat-webhook] ${type} for product ${pid || "?"} carries no entitlement_ids — attach the product to an entitlement in RevenueCat`,
      );
      return NextResponse.json({ received: true, skipped: "no-entitlements" });
    }
  }

  const expiresAt =
    // A refunded SUBSCRIPTION ends now. Keeping someone entitled after
    // the store handed their money back is the same hole as the pack
    // case, one tier up.
    isRefund(event)
      ? new Date().toISOString()
      : type === "EXPIRATION"
      ? new Date(
          Math.min(event.expiration_at_ms ?? Date.now(), Date.now()),
        ).toISOString()
      : type === "BILLING_ISSUE"
        ? // The store entitles the user through the grace window while
          // it retries their card; mirror that instead of letting the
          // original period end lock them out mid-retry.
          typeof event.grace_period_expiration_at_ms === "number"
          ? new Date(event.grace_period_expiration_at_ms).toISOString()
          : typeof event.expiration_at_ms === "number"
            ? new Date(event.expiration_at_ms).toISOString()
            : null
        : typeof event.expiration_at_ms === "number"
          ? new Date(event.expiration_at_ms).toISOString()
          : null;

  // A BILLING_ISSUE that carries no usable window has nothing to
  // mirror — never let it fall through and write a null (= lifetime)
  // expiry for a sub whose card is bouncing.
  if (type === "BILLING_ISSUE" && expiresAt === null) {
    return NextResponse.json({ received: true, skipped: "billing-issue-no-window" });
  }

  const admin = createAdminClient();

  // The id can be a VALID UUID for an account that no longer exists —
  // RevenueCat keeps firing renewals under a deleted account's id.
  // Without this check those events evicted the CURRENT owner's row
  // below, then failed the dead-user insert on the FK, 500-looped on
  // retry, and starved the real account of its plan (Wilson hit it
  // live 2026-08-16). Ack dead-user events; leave a reconcilable trail
  // for anything that grants.
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", appUserId)
    .maybeSingle<{ id: string }>();
  if (!ownerProfile) {
    console.warn(
      `[revenuecat-webhook] ${type} for deleted account ${appUserId} — acking without state change`,
    );
    if (type !== "EXPIRATION" && type !== "CANCELLATION") {
      // ONCE PER TRANSACTION, EVER (Wilson 2026-08-26: "why do we keep
      // getting these" — RevenueCat's retry ladder re-delivers the
      // same dead-account event on a ~daily backoff, and every
      // delivery filed a fresh admin alert for the same ghost). One
      // transaction = one alert; re-deliveries ack silently.
      const ghostTxn = event.original_transaction_id ?? "?";
      const { data: alreadyLogged } = await admin
        .from("grant_failures")
        .select("id")
        .eq("kind", "unrecognized_purchase")
        .ilike("purpose", `%txn ${ghostTxn}%`)
        .limit(1);
      if (!alreadyLogged || alreadyLogged.length === 0) {
        await recordGrantFailure({
          kind: "unrecognized_purchase",
          userId: null,
          purpose: `revenuecat:deleted-account:${type}:${event.product_id ?? "?"}:${appUserId} (txn ${ghostTxn} — restore purchases on the live account moves it)`,
          error: new Error("store event for a deleted account"),
        });
      }
    }
    return NextResponse.json({ received: true, skipped: "deleted-account" });
  }

  // One store transaction, one row — enforced by the UNIQUE index on
  // original_transaction_id. Anything else still holding this
  // transaction must go before the upsert, or Postgres raises 23505,
  // we 500, and RevenueCat retries the same event forever.
  //
  // TWO stale holders exist, and BOTH are ordinary customer journeys:
  //
  //   1. Another account — they re-registered and restored (the
  //      transfer case).
  //   2. THE SAME account under a different entitlement — an UPGRADE.
  //      Apple and Google keep the original_transaction_id across a
  //      plan change, so a Basic→Pro upgrade tries to add a "pro" row
  //      while the "basic" row still owns that id. This is the bug
  //      behind "I paid for Pro and it made me Basic" (Wilson
  //      2026-08-16, reproduced in the purchase drill): the upgrade
  //      event could NEVER land, on any account, ever.
  //
  // Delete every holder that isn't a row we're about to write.
  if (event.original_transaction_id) {
    const keep = entitlementIds
      .filter((e) => /^[\w.-]+$/.test(e))
      .join(",");
    let stale = admin
      .from("iap_entitlements")
      .delete()
      .eq("original_transaction_id", event.original_transaction_id);
    stale = keep
      ? stale.or(`user_id.neq.${appUserId},entitlement_id.not.in.(${keep})`)
      : stale.neq("user_id", appUserId);
    const { error: staleErr } = await stale;
    if (staleErr) {
      console.error(
        `[revenuecat-webhook] stale-transaction eviction failed for ${event.original_transaction_id}: ${staleErr.message}`,
      );
    }
  }
  // NEVER LET A GRANT EVENT MOVE ACCESS EARLIER.
  //
  // This upsert wrote expires_at unconditionally, so whichever event
  // arrived LAST won — even when it carried an older expiry. Upgrading
  // is exactly that case: Apple ends the old subscription and starts the
  // new one, and RevenueCat sends both. Land "Basic ended" after "Pro
  // started" and a dead expiry gets stamped over the live one.
  //
  // Seen in the wild 2026-08-23: a tester upgraded Basic → Pro and the
  // row ended up product_id=basic, expires_at=16:27:06, WRITTEN at
  // 16:27:09 — three seconds after it had already lapsed. He upgraded
  // and instantly lost access. Sandbox only made it visible by
  // compressing everything into seconds; the ordering is not
  // sandbox-specific and this would bite a real upgrade the same way.
  //
  // So for the event types that GRANT access, expires_at only ever moves
  // forward. Revocation still works: EXPIRATION, refunds and cancellations
  // are handled on their own paths above and are not in this set, so they
  // can still push access into the past when that is genuinely correct.
  //
  // null means lifetime (a pack) and always wins over any date.
  const GRANT_TYPES = new Set([
    "INITIAL_PURCHASE",
    "RENEWAL",
    "UNCANCELLATION",
    "PRODUCT_CHANGE",
    "NON_RENEWING_PURCHASE",
  ]);
  const isGrant = GRANT_TYPES.has(type);

  const existingExpiry = new Map<string, string | null>();
  if (isGrant && entitlementIds.length > 0) {
    const { data: current } = await admin
      .from("iap_entitlements")
      .select("entitlement_id, expires_at")
      .eq("user_id", appUserId)
      .in("entitlement_id", entitlementIds);
    for (const r of current ?? []) {
      existingExpiry.set(
        r.entitlement_id as string,
        (r.expires_at as string | null) ?? null,
      );
    }
  }

  const rows = entitlementIds.map((entitlementId) => {
    let nextExpiry = expiresAt;
    if (isGrant && existingExpiry.has(entitlementId)) {
      const held = existingExpiry.get(entitlementId) ?? null;
      if (held === null) {
        // Already lifetime — nothing a dated grant can add.
        nextExpiry = null;
      } else if (nextExpiry !== null) {
        nextExpiry =
          new Date(nextExpiry).getTime() >= new Date(held).getTime()
            ? nextExpiry
            : held;
      }
    }
    return {
      user_id: appUserId,
      entitlement_id: entitlementId,
      product_id: event.product_id ?? "unknown",
      expires_at: nextExpiry,
      platform: platformFromStore(event.store),
      revenuecat_user_id: appUserId,
      original_transaction_id: event.original_transaction_id ?? null,
      updated_at: now,
    };
  });

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

  // Resolve tier from entitlements (Pro wins over Basic when both
  // are present — matches the Stripe path's ordering). Used by BOTH
  // the profiles sync below AND the subscribe-time auto-populate.
  let tier: "basic" | "pro" | null = null;
  if (entitlementIds.includes(PRO_ENTITLEMENT_ID)) tier = "pro";
  else if (entitlementIds.includes(BASIC_ENTITLEMENT_ID)) tier = "basic";

  // TRIPWIRE (Wilson 2026-08-15: "people who pay for pro get pro").
  // The product id names the money; the entitlement names what we
  // deliver. If someone paid for a .pro. product but RevenueCat's
  // dashboard attachment resolves it to anything less than pro, that
  // is a paying customer being under-delivered by configuration —
  // land it in grant_failures where a person will see it, and deliver
  // the tier the money actually bought.
  const productId = event.product_id ?? "";
  if (productId.includes(".pro.") && tier !== "pro") {
    await recordGrantFailure({
      kind: "message_credits",
      userId: appUserId,
      delta: 0,
      purpose: `revenuecat:entitlement-mismatch:${productId}→${tier ?? "none"} (attach ${productId} to the "pro" entitlement in RevenueCat)`,
      error: new Error("pro product resolved to non-pro entitlement"),
    });
    tier = "pro";
  } else if (productId.includes(".basic.") && tier === null) {
    await recordGrantFailure({
      kind: "message_credits",
      userId: appUserId,
      delta: 0,
      purpose: `revenuecat:entitlement-mismatch:${productId}→none (attach ${productId} to the "basic" entitlement in RevenueCat)`,
      error: new Error("basic product resolved to no entitlement"),
    });
    tier = "basic";
  }

  // Blocker fix (2026-08-03 audit): mirror the entitlement into
  // profiles.pro_until + profiles.subscription_tier so every
  // server-side tier gate (isPro, canCreateOracle, getPlanTier,
  // canSendMessageForTierCap, canChatWithOracle) sees the paid
  // window. Without this the RevenueCat handler upserts
  // iap_entitlements — which nothing reads — and users who pay via
  // IAP get their circle auto-populated but read as Free-tier
  // server-side, then can't chat with the identities we just
  // created. The 0088 protect_billing_columns trigger blocks
  // authenticated writes to these columns; admin client bypasses.
  //
  // EXPIRATION: the trigger already forced expires_at into the
  // past above, so setting pro_until = expiresAt naturally
  // downgrades the user (canCreateOracle etc. read pro_until as
  // stale). subscription_tier is left as-is so a re-subscribe can
  // reason about the "was on Basic vs Pro" history.
  //
  // CANCELLATION: RevenueCat keeps access until expires_at even
  // when auto-renew is off — mirror that by writing pro_until to
  // the future expiry. Cancel-then-resubscribe flows work.
  // Lifetime purchases (NON_RENEWING, null expiry) still need to land
  // in profiles or every tier gate reads the buyer as Free (audit
  // finding #10). Only that event type earns the sentinel — a missing
  // expiry on anything else stays a no-op.
  const profileUntil =
    expiresAt ??
    (type === "NON_RENEWING_PURCHASE" ? FAR_FUTURE_ISO : null);

  if (tier && profileUntil !== null) {
    // CROSS-CHANNEL GUARD (2026-08-04). pro_until is one scalar with no
    // source column, written by BOTH webhooks. This update used to be
    // unconditional, so an Apple EXPIRATION — which deliberately forces
    // expiresAt into the past above — stomped pro_until even when the
    // user had an active, currently-billing Stripe subscription.
    //
    // Sequence: subscribe on iOS, later subscribe on web (or migrate),
    // cancel Apple. Apple fires EXPIRATION, pro_until goes to the past,
    // and the user is demoted to Free on both surfaces — locked out of
    // every personal identity, with only Adrian answering — while
    // Stripe keeps charging their card, until the next invoice.paid up
    // to a month later.
    //
    // Stripe's own handleSubscriptionDeleted is careful never to clear
    // pro_until for exactly this reason; the RevenueCat path had no
    // such care. A downgrade from this channel is now skipped when
    // Stripe holds the account, and only applied when the value we'd
    // write is actually LATER than what is already there.
    const { data: current } = await admin
      .from("profiles")
      .select("pro_until, subscription_tier, stripe_subscription_id, subscription_status, plan_source")
      .eq("id", appUserId)
      .maybeSingle<{
        pro_until: string | null;
        subscription_tier: string | null;
        stripe_subscription_id: string | null;
        subscription_status: string | null;
        plan_source: string | null;
      }>();

    const stripeHoldsAccount =
      !!current?.stripe_subscription_id &&
      current.subscription_status !== "canceled";
    // A comped account (demo, review, support make-good) must not be
    // demoted by a store event. App Review test-purchases run on
    // sandbox subscriptions that expire in MINUTES — without this, a
    // reviewer buying Pro would knock the demo account down to Free
    // partway through their own review (found 2026-08-16 while a
    // reviewer was live in the app).
    const compedAccount = current?.plan_source === "admin_grant";
    const stillActive =
      !!current?.pro_until &&
      new Date(current.pro_until).getTime() > Date.now();
    const wouldShorten =
      !!current?.pro_until &&
      new Date(profileUntil).getTime() < new Date(current.pro_until).getTime();
    // Audit finding #2: dates alone don't protect the TIER. A Stripe
    // Pro subscriber who also holds an Apple Basic sub had every Basic
    // RENEWAL (whose expiry lands later mid-cycle) overwrite
    // subscription_tier to "basic" — paying $10 and living under $5
    // caps. A cross-channel write may extend time, never lower rank.
    // Only an ACTIVE pro outranks an incoming basic. Once pro_until is
    // past, a basic grant is a legitimate downgrade landing, not a
    // stomp — without this, a Pro→Basic downgrade at period end would
    // be skipped and the paying Basic subscriber left on a dead tier.
    const wouldLowerTier =
      stillActive && current?.subscription_tier === "pro" && tier === "basic";

    // GRANTS NEVER SHORTEN, for ANYONE. The forward-only clamp above
    // protects iap_entitlements, but every gate reads PROFILES — and a
    // pure-IAP account had no guard here at all, so the 2026-08-23
    // upgrade bug (old sub's dying event arrives after the new sub's
    // grant, pro_until stomped into the past, paying customer locked
    // out for up to a month) was still live on this layer (self-audit
    // 2026-08-25). Expirations and cancellations still shorten — that
    // is their job.
    const grantNeverShortens = GRANT_TYPES.has(type);

    if (
      (wouldShorten || wouldLowerTier) &&
      (stripeHoldsAccount || compedAccount || grantNeverShortens)
    ) {
      console.log(
        `[revenuecat-webhook] ${type} for ${appUserId} would ${wouldLowerTier ? "lower tier" : "shorten pro_until"} but Stripe subscription ${current?.stripe_subscription_id} is active — leaving entitlement alone`,
      );
      // iap_entitlements above still records the store-side truth.
      return NextResponse.json({
        received: true,
        skipped: stripeHoldsAccount
          ? "stripe-holds-account"
          : compedAccount
            ? "comped-account"
            : "grant-never-shortens",
      });
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        pro_until: profileUntil,
        subscription_tier: tier,
        // The upgrade surfaces steer "how do I cancel?" from this —
        // stale "stripe" here sent IAP subscribers to the web portal
        // for a sub that only exists in the store (audit finding #9).
        plan_source: "iap",
      })
      .eq("id", appUserId);
    if (profileErr) {
      console.error(
        `[revenuecat-webhook] profile tier sync failed for ${appUserId} (${type}): ${profileErr.message}`,
      );
      // Every gate reads PROFILES, not iap_entitlements — a lost sync
      // here is a paying customer living as Free with no retry and no
      // trail (self-audit 2026-08-25). Ledger it, and 500 grant events
      // so RevenueCat redelivers: the sync is idempotent and the
      // entitlement clamp makes replays safe.
      await recordGrantFailure({
        kind: "iap_profile_sync",
        userId: appUserId,
        purpose: `${type}:${tier}:${profileUntil}`,
        error: profileErr,
      });
      if (GRANT_TYPES.has(type)) {
        return NextResponse.json(
          { error: "profile sync failed — retry" },
          { status: 500 },
        );
      }
    }
  }

  // Phase 3: kick off subscribe-time auto-populate when this event
  // grants (or refreshes) a basic/pro entitlement. Idempotent
  // helper — a RENEWAL for an already-populated user creates
  // nothing new.
  if (AUTO_POPULATE_TRIGGER_TYPES.has(type) && tier) {
    scheduleAutoPopulate(appUserId, tier);
  }

  // Enrollment receipt in our own words. Apple's receipt proves the
  // charge; this one says what the money bought. Only on the events
  // that START a plan — a renewal doesn't need congratulating, and a
  // refund is handled above.
  if (
    (type === "INITIAL_PURCHASE" || type === "PRODUCT_CHANGE") &&
    tier &&
    !isRefund(event)
  ) {
    const planTo = await emailFor(admin, appUserId);
    if (planTo) {
      await sendPlanStartedEmail({
        to: planTo,
        userId: appUserId,
        tier,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ received: true, type, entitlements: entitlementIds });
}
