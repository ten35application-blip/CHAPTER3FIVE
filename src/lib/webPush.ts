/**
 * Web Push (VAPID) sender for browser/PWA notifications.
 *
 * Distinct from src/lib/push.ts, which sends Expo Push to mobile app
 * tokens. This module targets the profiles.push_subscription blob
 * created by ServiceWorkerRegistration.pushManager.subscribe() on the
 * dashboard's opt-in banner.
 *
 * Requires VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY + VAPID_CONTACT env
 * vars. When any are missing this module is a no-op — the outreach
 * worker still sends its message, it just won't wake a browser tab.
 * Generate the keypair once with `npx web-push generate-vapid-keys`
 * and paste both into Vercel; VAPID_CONTACT is a mailto: link
 * (App Store guidance).
 */
import webpush from "web-push";
import { createAdminClient } from "./supabase/admin";

let configured = false;
function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT ?? "mailto:noreply@chapter3five.app";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(contact, pub, priv);
  configured = true;
  return true;
}

/**
 * The browser-side subscribe() call returns a PushSubscription — we
 * store the same shape on profiles.push_subscription.
 */
export type StoredPushSubscription = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export type WebPushPayload = {
  title: string;
  body: string;
  /** Absolute or root-relative URL the notification click opens. */
  url?: string;
  /** Optional tag so multiple pings collapse into one. */
  tag?: string;
};

/**
 * Send a push to a single user. Best-effort — returns whether the
 * dispatch went through. On 404/410 (subscription gone) we clear the
 * stored blob so the next outreach doesn't waste a call.
 */
export async function sendWebPushToUser(opts: {
  userId: string;
  payload: WebPushPayload;
}): Promise<{ sent: boolean; reason?: string }> {
  if (!configure()) {
    return { sent: false, reason: "vapid_not_configured" };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("push_subscription")
    .eq("id", opts.userId)
    .maybeSingle();

  const sub = profile?.push_subscription as
    | StoredPushSubscription
    | null
    | undefined;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { sent: false, reason: "no_subscription" };
  }

  try {
    await webpush.sendNotification(sub, JSON.stringify(opts.payload), {
      TTL: 60 * 60 * 6, // 6h — after that the ping is stale
    });
    return { sent: true };
  } catch (err: unknown) {
    const status =
      typeof err === "object" && err !== null && "statusCode" in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;
    if (status === 404 || status === 410) {
      // Dead subscription — clear it so we stop trying.
      await admin
        .from("profiles")
        .update({ push_subscription: null })
        .eq("id", opts.userId);
      return { sent: false, reason: "subscription_expired" };
    }
    console.error("[webPush] send failed:", err);
    return { sent: false, reason: "send_failed" };
  }
}
