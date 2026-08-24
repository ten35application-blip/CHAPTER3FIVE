import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { normalizeLanguage } from "@/lib/i18n/language";
import { isOracleMuted } from "@/lib/muted";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateText } from "@/lib/moderation";
import { recordAnthropicSpend } from "@/lib/spendGovernor";
import { sendPushToUser } from "@/lib/push";
import { screenForCrisisKeywords } from "@/lib/safety/crisis-detector";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Keeps the promises. Every 15 minutes: find scheduled_pings that have
 * come due, compose the promised message in the persona's own voice,
 * deliver it, mark it sent.
 *
 * Two behaviors that make this feel like a person and not a cron:
 *
 *  - QUIET HOURS: a due time that falls between 10pm and 8am in the
 *    user's timezone waits for morning. The detector already clamps,
 *    but a promise made at 9:58pm for "in 20 minutes" can still land
 *    past the line — waiting beats buzzing someone at 10:40pm.
 *  - LATE WITH GRACE: delivered more than two hours past due, the
 *    persona acknowledges it naturally — "sorry, the morning got away
 *    from me" — which is Wilson's insight (2026-08-25): a kept-late
 *    promise with an apology is MORE human than a punctual one.
 *
 * A ping whose user has since muted or deleted the companion is
 * skipped permanently. A ping that fails composition stays pending —
 * the next run retries — but pings older than 48h past due are marked
 * skipped rather than retried forever: showing up two days late to
 * "text me in the morning" stops being charming.
 */

const HOUR = 3_600_000;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: due } = await admin
    .from("scheduled_pings")
    .select("id, user_id, oracle_id, due_at, context")
    .eq("status", "pending")
    .lte("due_at", now.toISOString())
    .order("due_at", { ascending: true })
    .limit(50);
  if (!due || due.length === 0) return NextResponse.json({ sent: 0 });

  let sent = 0;
  let skipped = 0;
  for (const ping of due) {
    try {
      const hoursLate = (now.getTime() - Date.parse(ping.due_at)) / HOUR;

      // Too stale to keep — two days past "this morning" is not a
      // late text, it's a haunting.
      if (hoursLate > 48) {
        await admin
          .from("scheduled_pings")
          .update({ status: "skipped" })
          .eq("id", ping.id);
        skipped++;
        continue;
      }

      const { data: profile } = await admin
        .from("profiles")
        .select("timezone, preferred_language, muted_conversations, deleted_at")
        .eq("id", ping.user_id)
        .maybeSingle();
      if (!profile || profile.deleted_at) {
        await admin
          .from("scheduled_pings")
          .update({ status: "skipped" })
          .eq("id", ping.id);
        skipped++;
        continue;
      }

      // Quiet hours in the user's local time — wait for morning.
      if (!withinWakingHours(now, profile.timezone as string | null)) continue;

      const { data: oracle } = await admin
        .from("oracles")
        .select("id, name, persona_prompt, deleted_at, blocked_at")
        .eq("id", ping.oracle_id)
        .maybeSingle();
      if (
        !oracle ||
        oracle.deleted_at ||
        oracle.blocked_at ||
        isOracleMuted(profile.muted_conversations, ping.oracle_id)
      ) {
        await admin
          .from("scheduled_pings")
          .update({ status: "skipped" })
          .eq("id", ping.id);
        skipped++;
        continue;
      }

      // The context sentence is Haiku's summary of user text —
      // second-order user-influenced content. Same posture as the
      // outreach cron: scrub markup-ish runs before it enters a system
      // prompt, and never build a warm scheduled ping around a crisis
      // moment (skip; the crisis path has its own machinery).
      const safeContext = String(ping.context ?? "")
        .replace(/\s+/g, " ")
        .replace(/[=_*#`"]{2,}/g, " ")
        .trim()
        .slice(0, 200);
      if (!safeContext || screenForCrisisKeywords(safeContext).length > 0) {
        await admin
          .from("scheduled_pings")
          .update({ status: "skipped" })
          .eq("id", ping.id);
        skipped++;
        continue;
      }

      const language = normalizeLanguage(profile.preferred_language);
      const langInstruction =
        language === "es" ? "Respond in Spanish." : "Respond in English.";
      const lateBlock =
        hoursLate > 2
          ? `You are LATE — you promised this ${Math.round(hoursLate)} hours ago. Open by owning it lightly, in your own voice, the way a person texts "sorry, the morning ran off without me" — one clause, no groveling, then the message itself.`
          : `You are on time. Do NOT mention that this was scheduled or promised mechanics — just be the person who said they'd text, texting.`;

      const systemPrompt = `${oracle.persona_prompt}\n\n---\n\nCONTEXT: Earlier, you agreed to reach out at a specific time. What you promised: "${safeContext}". That time is now. Write the ONE short message you'd send — warm, specific to what was promised, one or two sentences at most. ${lateBlock} Do NOT announce you're an AI. Match the character's texting rules exactly. ${langInstruction}`;

      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 200,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content:
              "(system) Send the message you promised now. Don't reply to this line.",
          },
        ],
      });
      void recordAnthropicSpend({
        userId: ping.user_id,
        model: ANTHROPIC_MODEL,
        usage: response.usage as unknown as Parameters<
          typeof recordAnthropicSpend
        >[0]["usage"],
        route: "promised-ping",
      });

      const reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      if (!reply) continue;

      const mod = await moderateText(reply);
      if (mod.flagged) {
        await admin
          .from("scheduled_pings")
          .update({ status: "skipped" })
          .eq("id", ping.id);
        skipped++;
        continue;
      }

      const { error: msgErr } = await admin.from("messages").insert({
        user_id: ping.user_id,
        oracle_id: ping.oracle_id,
        role: "assistant",
        content: reply,
        initiated_by_oracle: true,
        initiated_by: "promise",
      });
      if (msgErr) {
        console.error("[promised-pings] insert failed:", msgErr);
        continue; // stays pending; next run retries
      }

      await admin
        .from("scheduled_pings")
        .update({ status: "sent", sent_at: now.toISOString() })
        .eq("id", ping.id);

      await sendPushToUser({
        userId: ping.user_id,
        title: oracle.name ?? "chapter3five",
        body: reply.length > 180 ? `${reply.slice(0, 179)}…` : reply,
        badge: 1,
        categoryId: "companion_message",
        threadIdentifier: ping.oracle_id,
        channelId: "companion",
        data: { oracle_id: ping.oracle_id, kind: "reply" },
      });
      sent++;
    } catch (err) {
      console.error(`[promised-pings] ping ${ping.id} failed:`, err);
    }
  }

  await admin.from("cron_runs").insert({
    job: "promised-pings",
    processed: sent + skipped,
    duration_ms: Date.now() - now.getTime(),
  });
  return NextResponse.json({ sent, skipped });
}

function withinWakingHours(now: Date, tz: string | null): boolean {
  try {
    const hour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: tz ?? "America/New_York",
      }).format(now),
      10,
    );
    return Number.isFinite(hour) ? hour >= 8 && hour < 22 : true;
  } catch {
    return true;
  }
}
