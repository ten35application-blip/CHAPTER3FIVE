/**
 * Expo Push API client. Sends notifications to all device tokens for a
 * user. Failure is best-effort — a missing/expired token shouldn't kill
 * the proactive cron.
 *
 * https://docs.expo.dev/push-notifications/sending-notifications/
 */
import { createAdminClient } from "./supabase/admin";

type ExpoPushMessage = {
  to: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  badge?: number;
  /** iOS notification category identifier -- used to attach action
   *  buttons (reply / dismiss). Registered client-side via
   *  Notifications.setNotificationCategoryAsync. */
  categoryId?: string;
  /** Android channel identifier -- must match a channel the client
   *  has registered. Defaults to "default" if omitted. */
  channelId?: string;
  /** iOS thread identifier -- lets notifications from the same
   *  companion stack together in Notification Center (like Messages
   *  groups by contact). Set to the oracle_id. */
  threadIdentifier?: string;
  /** Expo → FCM notification.image (Android large icon) / iOS attachment
   *  (needs the Notification Service Extension, build 1.5+). */
  richContent?: { image: string };
  /** iOS: let the Notification Service Extension rewrite the alert
   *  (communication notification with the sender's face). */
  mutableContent?: boolean;
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushToUser(opts: {
  userId: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  /** iOS notification category -- e.g. "companion_message" for a
   *  push that should show a Reply text action on the lock screen. */
  categoryId?: string;
  /** iOS thread grouping (typically oracle_id so all messages from
   *  the same companion stack). */
  threadIdentifier?: string;
  /** Android channel id -- must exist client-side. */
  channelId?: string;
}): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  const { data: tokens } = await admin
    .from("device_tokens")
    .select("expo_token")
    .eq("user_id", opts.userId);

  // HER FACE ON THE NOTIFICATION (2026-09-08). Every identity push already
  // names its oracle (threadIdentifier / data.oracle_id). Resolve the
  // avatar once here so no caller has to remember: Android shows it as
  // the large icon today; iOS shows it once the 1.5 extension exists
  // (mutable-content lets that extension turn the alert into a
  // communication notification with her face instead of the app icon).
  const oracleId =
    (typeof opts.data?.oracle_id === "string" && opts.data.oracle_id) ||
    (typeof opts.threadIdentifier === "string" && /^[0-9a-f-]{36}$/i.test(opts.threadIdentifier)
      ? opts.threadIdentifier
      : null);
  let sender: { name: string | null; avatar_url: string | null } | null = null;
  if (oracleId) {
    const { data: o } = await admin
      .from("oracles")
      .select("name, avatar_url")
      .eq("id", oracleId)
      .maybeSingle();
    sender = (o as { name: string | null; avatar_url: string | null } | null) ?? null;
  }
  const avatar = sender?.avatar_url && /^https:\/\//.test(sender.avatar_url) ? sender.avatar_url : null;

  const recipients = (tokens ?? [])
    .map((t) => t.expo_token)
    .filter((t) => t && t.startsWith("ExponentPushToken"));

  if (recipients.length === 0) return { sent: 0, failed: 0 };

  const messages: ExpoPushMessage[] = recipients.map((to) => ({
    to,
    title: opts.title,
    body: opts.body,
    data: {
      ...(opts.data ?? {}),
      ...(oracleId ? { oracle_id: oracleId } : {}),
      ...(sender?.name ? { sender_name: sender.name } : {}),
      ...(avatar ? { avatar_url: avatar } : {}),
    },
    sound: "default",
    priority: "high",
    ...(avatar ? { richContent: { image: avatar }, mutableContent: true } : {}),
    ...(typeof opts.badge === "number" ? { badge: opts.badge } : {}),
    ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
    ...(opts.threadIdentifier
      ? { threadIdentifier: opts.threadIdentifier }
      : {}),
    ...(opts.channelId ? { channelId: opts.channelId } : {}),
  }));

  let sent = 0;
  let failed = 0;
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });
    if (!res.ok) {
      failed = recipients.length;
    } else {
      const json = (await res.json()) as {
        data?: { status: string; details?: { error?: string } }[];
      };
      for (const ticket of json.data ?? []) {
        if (ticket.status === "ok") sent++;
        else failed++;
      }
      // Tickets with DeviceNotRegistered should be cleaned up so we stop
      // wasting calls on dead tokens.
      const dead = (json.data ?? [])
        .map((t, i) =>
          t.details?.error === "DeviceNotRegistered" ? recipients[i] : null,
        )
        .filter((x): x is string => Boolean(x));
      if (dead.length > 0) {
        await admin
          .from("device_tokens")
          .delete()
          .eq("user_id", opts.userId)
          .in("expo_token", dead);
      }
    }
  } catch (err) {
    console.error("expo push send failed:", err);
    failed = recipients.length;
  }

  return { sent, failed };
}
