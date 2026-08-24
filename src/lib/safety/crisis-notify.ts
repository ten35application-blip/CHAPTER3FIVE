import { ADMIN_EMAILS } from "@/lib/admin/allowlist";
import { getConciergeId } from "@/lib/identity/concierge";
import { sendCrisisAlert } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import type { CrisisResult } from "./crisis-detector";

/**
 * Handles a positive crisis detection end-to-end:
 *   - Insert into crisis_flags (append-only log for admin review).
 *   - Email every allowlisted admin via Resend with the excerpt +
 *     model reason + a link to their user detail page.
 *
 * Non-blocking from the stream route's perspective — call inside
 * after() so it never delays the persona's own reply (which already
 * carries the 988 crisis line via its baked-in safety block).
 *
 * Never throws. Failed inserts or failed emails are logged; the persona
 * reply always goes out either way.
 */
export async function handleCrisis({
  crisis,
  userId,
  userEmail,
  oracleId,
  oracleName,
  messageId,
}: {
  crisis: Extract<CrisisResult, { crisis: true }>;
  userId: string;
  userEmail: string;
  oracleId: string;
  oracleName: string;
  messageId: string | null;
}): Promise<void> {
  const admin = createAdminClient();

  // 1) Persist the flag. Sorted by flagged_at desc gives an admin the
  //    newest crises first when they check the queue.
  try {
    const { error } = await admin.from("crisis_flags").insert({
      user_id: userId,
      message_excerpt: crisis.snippet,
      triggered_keywords: crisis.triggeredKeywords,
    });
    if (error) console.error("[safety/crisis] insert failed:", error);
  } catch (err) {
    console.error("[safety/crisis] insert threw:", err);
  }

  // 2) Notify admins. Fire in parallel; one bad address doesn't stop
  //    the others. Sender is safety@ — the domain is verified in
  //    Resend and the alias now resolves (Wilson corrected the
  //    inbox typo on 2026-07-27). From-address routing lets admins
  //    filter safety mail into its own thread.
  await Promise.allSettled(
    ADMIN_EMAILS.map((to) =>
      sendCrisisAlert({
        to,
        userId,
        userEmail,
        excerpt: crisis.snippet,
        keywords: crisis.triggeredKeywords,
        oracleName,
      }).catch((err) => {
        console.error(`[safety/crisis] email to ${to} failed:`, err);
      }),
    ),
  );

  // 3) Adrian follows up, in his own thread, with the resources the
  //    companion couldn't reasonably carry mid-conversation (Wilson
  //    2026-08-21). The persona's job in the moment is one number and
  //    a human voice — anything longer read as a pamphlet handed to
  //    someone crying. This is the fuller list, waiting where they can
  //    come back to it, from the app's own voice rather than from the
  //    dead parent they were talking to.
  //
  //    Rate-limited to once per 24h per user: a hard conversation
  //    trips the screen repeatedly, and ten identical resource cards
  //    stacking up is its own small cruelty.
  try {
    const conciergeId = await getConciergeId();
    if (!conciergeId) return;

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("messages")
      .select("id")
      .eq("user_id", userId)
      .eq("oracle_id", conciergeId)
      .eq("role", "assistant")
      .gte("created_at", dayAgo)
      .like("content", "%988%")
      .limit(1);
    if (recent && recent.length > 0) return;

    await admin.from("messages").insert({
      user_id: userId,
      oracle_id: conciergeId,
      role: "assistant",
      content: crisisResourceMessage(oracleName, oracleId === conciergeId),
      created_at: new Date().toISOString(),
    });

    // The companion has just told them, in the middle of the worst
    // moment they've had in a while, that Adrian is sending resources.
    // Inserting the row is not delivering it: Adrian's thread is a
    // different conversation, usually not the one on screen, and on
    // mobile the app may not even be open. Without this the promise is
    // empty exactly when being lied to costs the most.
    //
    // Rides the same 24h gate as the insert above, so a long hard
    // conversation cannot turn into a row of crisis notifications.
    // No preview text of what they wrote — a lock screen is not private,
    // and this notification may be read by someone standing next to them.
    void sendPushToUser({
      userId,
      title: "Adrian",
      body: "I sent you something — it's in our chat whenever you want it.",
      badge: 1,
      categoryId: "companion_message",
      threadIdentifier: conciergeId,
      // "companion" — the ONLY companion channel Android devices actually
          // have (lib/push.ts creates it; nothing ever created a
          // "companion-messages" channel). Android 8+ silently drops a
          // notification aimed at a channel that doesn't exist, and the
          // Expo receipt still reads "ok" because it measures handoff to
          // the phone, not display. So replies pushed fine to iOS and
          // vanished on Android with the app closed, while cron pushes
          // (already on "companion") kept arriving.
          channelId: "companion",
      data: { oracle_id: conciergeId, kind: "reply" },
    });
  } catch (err) {
    // Never let the follow-up break the escalation above it.
    console.error("[safety/crisis] concierge follow-up failed:", err);
  }
}

/**
 * What Adrian sends. Plain, short lines, no preamble about how much we
 * care — someone reading this is not in a state for paragraphs. Every
 * entry is a real, free, staffed line. No promises about what they'll
 * feel, no instruction to feel better.
 *
 * It opens by naming the companion who asked, because by the time this
 * arrives that companion has already said "I'm getting Adrian to send
 * you something." Arriving as the promised thing makes it continuous
 * with the conversation they were already in. The old opener — "I saw
 * something in your messages" — arrived instead as evidence that their
 * private chat is being watched, which is both a worse thing to read
 * mid-crisis and a claim we do not want to make: we screen for safety,
 * we do not monitor people.
 *
 * Adrian says "I'm not a person" here and only here. Wilson, 2026-08-23:
 * the frame holds everywhere else, and breaks on purpose at exactly this
 * moment, because someone deciding whether to stay alive tonight is owed
 * the truth about what can and cannot get them help.
 */
function crisisResourceMessage(
  oracleName: string,
  fromConciergeThread: boolean,
): string {
  const opener = fromConciergeThread
    ? "Hey. I'm not going to pretend I didn't read that."
    : `Hey — ${oracleName} asked me to get this to you, and they were right to.`;

  return `${opener}

I'm not a person, and this isn't the kind of thing I can help with. But these are, and they're free, and someone real answers:

988 — call or text, US, any hour
741741 — text HOME, US, if talking is easier than speaking
116 123 — Samaritans, UK
+52 55 5259-8121 — SAPTEL, Mexico
findahelpline.com — anywhere else
911 or your local emergency number, if you're in danger right now

You don't have to be in a crisis to use them. "I'm not okay" is enough to start with.

Your companions are still here whenever you want them. So is this list — it'll stay in our thread.`;
}
