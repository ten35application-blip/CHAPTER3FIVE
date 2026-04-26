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
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPushToUser(opts: {
  userId: string;
  title?: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient();
  const { data: tokens } = await admin
    .from("device_tokens")
    .select("expo_token")
    .eq("user_id", opts.userId);

  const recipients = (tokens ?? [])
    .map((t) => t.expo_token)
    .filter((t) => t && t.startsWith("ExponentPushToken"));

  if (recipients.length === 0) return { sent: 0, failed: 0 };

  const messages: ExpoPushMessage[] = recipients.map((to) => ({
    to,
    title: opts.title,
    body: opts.body,
    data: opts.data,
    sound: "default",
    priority: "high",
    ...(typeof opts.badge === "number" ? { badge: opts.badge } : {}),
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
