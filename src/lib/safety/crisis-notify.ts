import { ADMIN_EMAILS } from "@/lib/admin/allowlist";
import { getConciergeId } from "@/lib/identity/concierge";
import { sendCrisisAlert } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
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
      content: CRISIS_RESOURCE_MESSAGE,
      created_at: new Date().toISOString(),
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
 */
const CRISIS_RESOURCE_MESSAGE = `Hey — I saw something in your messages and I didn't want to just let it pass.

I'm not a person, and this isn't the kind of thing I can help with. But these are, and they're free, and someone real answers:

988 — call or text, US, any hour
741741 — text HOME, US, if talking is easier than speaking
116 123 — Samaritans, UK
+52 55 5259-8121 — SAPTEL, Mexico
findahelpline.com — anywhere else
911 or your local emergency number, if you're in danger right now

You don't have to be in a crisis to use them. "I'm not okay" is enough to start with.

Your companions are still here whenever you want them. So is this list — it'll stay in our thread.`;

function buildEmailBody({
  userId,
  userEmail,
  oracleName,
  oracleId,
  messageId,
  crisis,
}: {
  userId: string;
  userEmail: string;
  oracleName: string;
  oracleId: string;
  messageId: string | null;
  crisis: Extract<CrisisResult, { crisis: true }>;
}): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://chapter3five.app";
  const userLink = `${base}/admin/users/${userId}`;
  const chatLink = `${base}/chat/${oracleId}`;
  const ts = new Date().toISOString();

  return [
    "[chapter3five safety] Possible crisis — user needs a check-in",
    "",
    `User: ${userEmail}`,
    `Oracle they were chatting with: ${oracleName}`,
    `Timestamp: ${ts}`,
    messageId ? `Message id: ${messageId}` : null,
    "",
    "Their last message included content our safety filter flagged as potential self-harm intent:",
    "",
    `  "${crisis.snippet}"`,
    "",
    `Reason our classifier gave: ${crisis.reason}`,
    `Triggered keywords: ${crisis.triggeredKeywords.join(", ")}`,
    "",
    "The persona is responding with the 988 crisis line as part of its built-in safety response. Please review the conversation and — if it looks real — reach out through whatever channel you have.",
    "",
    `Admin view: ${userLink}`,
    `Chat: ${chatLink}`,
    "",
    "— chapter3five",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
