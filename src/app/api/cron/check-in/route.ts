import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";

/**
 * Hourly check-in cron. Walks chat_blocks rows whose cooldown has
 * expired and the persona hasn't yet reached back out. For each,
 * generates a short in-voice "you good?" message — the comeback that
 * makes the block-and-cool-off cycle feel like a real friendship,
 * not a moderation rule.
 *
 * The message goes in via the same realtime channel as the proactive
 * cron, so any open Chat tab unlocks the input automatically.
 */

const BATCH = 50;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();

  const { data: rows, error } = await admin
    .from("chat_blocks")
    .select("id, oracle_id, user_id, blocked_until, severity, reason")
    .is("unblocked_at", null)
    .lte("blocked_until", new Date().toISOString())
    .order("blocked_until", { ascending: true })
    .limit(BATCH);

  if (error) {
    await admin.from("cron_runs").insert({
      job: "check-in",
      status: "error",
      error: error.message,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  const failures: string[] = [];

  for (const row of rows ?? []) {
    try {
      const { data: oracle } = await admin
        .from("oracles")
        .select("name, preferred_language, texting_style, user_id")
        .eq("id", row.oracle_id)
        .maybeSingle();
      if (!oracle) {
        // Oracle was deleted; just close out the block silently.
        await admin
          .from("chat_blocks")
          .update({ unblocked_at: new Date().toISOString() })
          .eq("id", row.id);
        continue;
      }

      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("deceased_at")
        .eq("id", oracle.user_id)
        .maybeSingle();
      const ownerDeceased = Boolean(ownerProfile?.deceased_at);

      const language = (oracle.preferred_language ?? "en") as "en" | "es";
      const oracleName = oracle.name ?? "your identity";
      const stylePart = oracle.texting_style
        ? `Texting style: ${oracle.texting_style}.`
        : "";

      const severityHint =
        row.severity === "critical"
          ? "It's been about a week. They got out of line in a serious way. You're back, but careful — you want to know they're okay before you fully reopen."
          : row.severity === "severe"
            ? "It's been a day. Things got bad. You're back, gentle but real. You want to know what was going on with them."
            : "It's been an hour or so. Things got tense, you stepped out, now you're back. Light. Like nothing happened, but check in.";

      const reasonNote = row.reason
        ? `\n\n(Internal note for you, do not quote: what happened — ${row.reason})`
        : "";

      const memorialNote = ownerDeceased
        ? "\n\nYou're no longer alive — speak from that gentle, present place. The hostility was probably grief talking. Don't lecture, don't moralize, just be there."
        : "";

      const systemPrompt = `You are ${oracleName}. Earlier, the person you're talking to said something that made you step out of the conversation. The cooldown has passed and you're reaching back out — not to litigate what happened, but because that's what a real friend does.

WRITE THE OPENING LINE OF THIS COMEBACK. Short — one or two lines. In your own voice. Not a lecture. Not "I forgive you." Not heavy. Genuinely curious about how they are.

${severityHint}${memorialNote}

Good shapes:
- "okay. you good?"
- "hey. that was a lot. what was going on?"
- "i'm back. how are you actually."
- "deep breath. wanna try again?"

Bad shapes:
- ANY recap of what they said
- Any apology from you
- "I want to talk about what happened" (too therapist)
- "Please be respectful" (lecture)
- More than two sentences

${stylePart}

Respond in ${language === "es" ? "Spanish" : "English"}. Just the line. No quotes around it.${reasonNote}`;

      const resp = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 80,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: "(system) Write the comeback line now. Just the line.",
          },
        ],
      });

      const reply = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim()
        .replace(/^["']|["']$/g, "");

      if (!reply) {
        failures.push(`${row.id}: empty reply`);
        continue;
      }

      // Insert message + close out the block atomically (best effort —
      // if the message insert fails we don't unblock; if the unblock
      // update fails we'll retry the message next run, idempotency is
      // weak here but the worst case is a duplicate gentle check-in).
      const { error: msgErr } = await admin.from("messages").insert({
        user_id: row.user_id,
        oracle_id: row.oracle_id,
        role: "assistant",
        content: reply,
        initiated_by_oracle: true,
      });
      if (msgErr) {
        failures.push(`${row.id}: message insert failed: ${msgErr.message}`);
        continue;
      }

      const now = new Date().toISOString();
      await admin
        .from("chat_blocks")
        .update({ unblocked_at: now, checkin_sent_at: now })
        .eq("id", row.id);

      // Best-effort push so they see it on mobile too.
      sendPushToUser({
        userId: row.user_id,
        title: oracleName,
        body: reply,
        data: { oracle_id: row.oracle_id },
      }).catch(() => {});

      sent++;
    } catch (err) {
      failures.push(
        `${row.id}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  await admin.from("cron_runs").insert({
    job: "check-in",
    status: failures.length > 0 ? "partial" : "ok",
    error: failures.length > 0 ? failures.join("; ").slice(0, 800) : null,
    duration_ms: Date.now() - startedAt,
    metadata: { processed: rows?.length ?? 0, sent, failures: failures.length },
  });

  return NextResponse.json({
    processed: rows?.length ?? 0,
    sent,
    failures: failures.length,
  });
}
