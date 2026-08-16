import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleAutoPopulate } from "@/lib/subscription/autoPopulate";
import { PRICING } from "@/lib/pricing";
import { recordGrantFailure } from "@/lib/billing/grantFailure";

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
  environment?: string;
  // TRANSFER events only: the app user ids the store receipt moved
  // between. No product/entitlement fields accompany them.
  transferred_from?: string[] | null;
  transferred_to?: string[] | null;
  // BILLING_ISSUE only: how long the store keeps the subscription
  // alive while it retries the card.
  grace_period_expiration_at_ms?: number | null;
};

/**
 * Sentinel expiry for entitlements the store reports with no
 * expiration (NON_RENEWING lifetime purchases). Every server-side
 * tier gate reads profiles.pro_until, so "no expiry" must still land
 * there as a date or the customer pays and gates them as Free
 * (audit finding #10).
 */
const FAR_FUTURE_ISO = "2099-01-01T00:00:00.000Z";

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
  //
  // Handled here, ahead of the entitlement checks, because a pack is
  // not an entitlement and should never have been routed through them.
  const packCredits = PACK_CREDITS[event.product_id ?? ""];
  if (packCredits) {
    if (type !== "NON_RENEWING_PURCHASE" && type !== "INITIAL_PURCHASE") {
      // CANCELLATION/EXPIRATION on a consumable is a refund signal;
      // credits are not clawed back here (the Stripe path doesn't
      // either — see the revert block in stripe/webhook). Ack and move
      // on rather than re-granting on a replay of a terminal event.
      return NextResponse.json({ received: true, ignored: `${type}-pack` });
    }
    const adminPack = createAdminClient();
    // Idempotency: RevenueCat retries on any non-2xx, and this grant is
    // additive, so a replay would double-credit. The transaction id is
    // the stable per-purchase key.
    const txnId =
      event.original_transaction_id ?? event.id ?? `${appUserId}:${event.product_id}`;
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
    type === "EXPIRATION"
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

  // A store transaction belongs to exactly one account. If this event
  // arrives under a new user while an old account still mirrors the
  // same original_transaction_id, the upsert below would trip that
  // column's UNIQUE index → 23505 → permanent RevenueCat retry loop
  // (audit finding #1). Evict the stale owner first.
  if (event.original_transaction_id) {
    await admin
      .from("iap_entitlements")
      .delete()
      .eq("original_transaction_id", event.original_transaction_id)
      .neq("user_id", appUserId);
  }
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
      .select("pro_until, subscription_tier, stripe_subscription_id, subscription_status")
      .eq("id", appUserId)
      .maybeSingle<{
        pro_until: string | null;
        subscription_tier: string | null;
        stripe_subscription_id: string | null;
        subscription_status: string | null;
      }>();

    const stripeHoldsAccount =
      !!current?.stripe_subscription_id &&
      current.subscription_status !== "canceled";
    const wouldShorten =
      !!current?.pro_until &&
      new Date(profileUntil).getTime() < new Date(current.pro_until).getTime();
    // Audit finding #2: dates alone don't protect the TIER. A Stripe
    // Pro subscriber who also holds an Apple Basic sub had every Basic
    // RENEWAL (whose expiry lands later mid-cycle) overwrite
    // subscription_tier to "basic" — paying $10 and living under $5
    // caps. A cross-channel write may extend time, never lower rank.
    const wouldLowerTier =
      current?.subscription_tier === "pro" && tier === "basic";

    if ((wouldShorten || wouldLowerTier) && stripeHoldsAccount) {
      console.log(
        `[revenuecat-webhook] ${type} for ${appUserId} would ${wouldLowerTier ? "lower tier" : "shorten pro_until"} but Stripe subscription ${current?.stripe_subscription_id} is active — leaving entitlement alone`,
      );
      // iap_entitlements above still records the Apple-side truth.
      return NextResponse.json({ received: true, skipped: "stripe-holds-account" });
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
      // Don't 500 the whole request — the entitlement mirror succeeded,
      // the auto-populate will still try. Ops surface via the log.
    }
  }

  // Phase 3: kick off subscribe-time auto-populate when this event
  // grants (or refreshes) a basic/pro entitlement. Idempotent
  // helper — a RENEWAL for an already-populated user creates
  // nothing new.
  if (AUTO_POPULATE_TRIGGER_TYPES.has(type) && tier) {
    scheduleAutoPopulate(appUserId, tier);
  }

  return NextResponse.json({ received: true, type, entitlements: entitlementIds });
}
