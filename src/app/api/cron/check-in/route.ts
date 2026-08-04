import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { normalizeLanguage } from "@/lib/i18n/language";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAnthropicSpend } from "@/lib/spendGovernor";
import { openerVarietyBlock } from "@/lib/identity/opener";
import { sendPushToUser } from "@/lib/push";
import { moderateText } from "@/lib/moderation";
import { startCronBudget } from "@/lib/cron/budget";

export const runtime = "nodejs";
// Literal, not the shared constant: Next reads segment config
// statically, so an imported value fails the build with
// "Invalid segment configuration export detected". Keep in sync
// with CRON_MAX_DURATION in lib/cron/budget.ts.
export const maxDuration = 300;

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
  const budget = startCronBudget(startedAt);
  let skippedForTime = 0;

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
    // Stop on our own terms rather than being killed mid-loop. See
    // lib/cron/budget.ts — a truncated run used to write no heartbeat
    // at all, so nobody could tell it had been cut short.
    if (budget.exhausted()) {
      skippedForTime++;
      continue;
    }
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

      const language = normalizeLanguage(oracle.preferred_language);
      const oracleName = oracle.name ?? "your identity";
      const stylePart = oracle.texting_style
        ? `Texting style: ${oracle.texting_style}.`
        : "";

      const severityHint =
        row.severity === "critical" || row.severity === "temporary"
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

      const variety = openerVarietyBlock(row.oracle_id);
      const systemPrompt = `You are ${oracleName}. Earlier, the person you're talking to said something that made you step out of the conversation. The cooldown has passed and you're reaching back out — not to litigate what happened, but because that's what a real friend does.

WRITE THE OPENING LINE OF THIS COMEBACK. Short — one or two lines. In your own voice. Not a lecture. Not "I forgive you." Not heavy. Genuinely curious about how they are.

${severityHint}${memorialNote}

Bad shapes (do NOT):
- ANY recap of what they said
- Any apology from you
- "I want to talk about what happened" (too therapist)
- "Please be respectful" (lecture)
- More than two sentences

${stylePart}

Respond in ${language === "es" ? "Spanish" : "English"}. Just the line. No quotes around it.${reasonNote}
${variety}`;

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

      void recordAnthropicSpend({
        userId: row.user_id,
        model: ANTHROPIC_MODEL,
        usage: resp.usage as unknown as Parameters<
          typeof recordAnthropicSpend
        >[0]["usage"],
        route: "cron_check_in",
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
      // Moderate before it lands — same reasoning as the anniversaries
      // cron. A comeback message to someone the persona previously
      // blocked is a delicate moment; sending it unscanned contradicts
      // the Settings promise and is the one path where the persona
      // reopens a conversation it walked away from.
      const checkInMod = await moderateText(reply);
      if (!checkInMod.ok) {
        console.error(
          `[cron/check-in] reply flagged for ${row.user_id} — dropping`,
          checkInMod.categories,
        );
        continue;
      }

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

      // The automated block detector's "temporary" tier also flips
      // oracles.blocked_at, which is what the stream route's 403 gate
      // reads — without clearing it here, a 7-day cooldown never lifts
      // and this check-in lands in a thread the user can't reply to.
      // Scoped to 'temporary' so a manually-set permanent block on the
      // oracle is never cleared by an unrelated legacy chat_blocks row.
      if (row.severity === "temporary") {
        await admin
          .from("oracles")
          .update({ blocked_at: null, block_reason: null })
          .eq("id", row.oracle_id);
      }

      // Best-effort push so they see it on mobile too. Companion
      // category + oracle-scoped thread = iOS renders a Reply text
      // action on the lock screen (looks like iMessage) and stacks
      // multiple messages from the same companion into one group.
      sendPushToUser({
        userId: row.user_id,
        title: oracleName,
        body: reply.length > 140 ? reply.slice(0, 140) + "…" : reply,
        data: { oracle_id: row.oracle_id, kind: "companion_message" },
        categoryId: "companion_message",
        threadIdentifier: row.oracle_id,
        channelId: "companion",
      }).catch(() => {});

      sent++;
    } catch (err) {
      failures.push(
        `${row.id}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  // THIS INSERT HAS BEEN FAILING SINCE IT WAS WRITTEN (found 2026-08-04).
  // It set `metadata`, and cron_runs has no metadata column — the table
  // is (id, job, ran_at, status, processed, error, duration_ms). Every
  // other cron writes `processed`; this one alone invented a column.
  //
  // postgrest-js does not throw on a rejected insert, it resolves with
  // {error}, and nothing here read it. So the write failed silently on
  // every single run: check-in is the ONLY job with zero rows in
  // cron_runs, while the other seven have a week of history. The job
  // itself worked the whole time — it was the record of it that didn't.
  //
  // Which means the cron-health readout has been showing check-in as
  // never-run since the day it shipped, and would have shown exactly the
  // same thing if it had genuinely been dead.
  const { error: heartbeatErr } = await admin.from("cron_runs").insert({
    job: "check-in",
    status: failures.length > 0 ? "partial" : "ok",
    error: failures.length > 0 ? failures.join("; ").slice(0, 800) : null,
    duration_ms: Date.now() - startedAt,
    processed: sent,
  });
  if (heartbeatErr) {
    // Checked now, so the next schema drift is loud instead of silent.
    console.error("[cron/check-in] heartbeat insert failed:", heartbeatErr);
  }

  return NextResponse.json({
    skippedForTime,
    processed: rows?.length ?? 0,
    sent,
    failures: failures.length,
  });
}
