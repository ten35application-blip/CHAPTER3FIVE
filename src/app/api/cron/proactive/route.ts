import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { questions } from "@/content/questions";
import { sendPushToUser } from "@/lib/push";

/**
 * Daily proactive outreach via chat — your identity sometimes texts you
 * first. Picks eligible users (opted in, recently active, not pinged in the
 * last week), composes a short in-character message for each, and inserts
 * it into the messages table marked initiated_by_oracle=true.
 *
 * Authenticated by Vercel Cron via CRON_SECRET.
 */

const ONE_DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * ONE_DAY;
const THIRTY_DAYS = 30 * ONE_DAY;
const BATCH = 25; // small per-day cap; avoids burning Anthropic spend if it ever runs away.

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const now = Date.now();
  const sevenAgo = new Date(now - SEVEN_DAYS).toISOString();
  const thirtyAgo = new Date(now - THIRTY_DAYS).toISOString();

  // Eligibility: opted in, onboarding done, active in last 30 days, not
  // proactive'd in the last 7 days.
  const { data: candidates, error } = await admin
    .from("profiles")
    .select(
      "id, oracle_name, preferred_language, texting_style, personality_type, emotional_flavor, active_oracle_id, last_proactive_at, last_active_at",
    )
    .eq("outreach_enabled", true)
    .eq("onboarding_completed", true)
    .gte("last_active_at", thirtyAgo)
    .is("deceased_at", null)
    .is("deleted_at", null)
    .or(`last_proactive_at.is.null,last_proactive_at.lt.${sevenAgo}`)
    .limit(BATCH);

  if (error) {
    await admin.from("cron_runs").insert({
      job: "proactive",
      status: "error",
      error: error.message,
      duration_ms: Date.now() - now,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    await admin.from("cron_runs").insert({
      job: "proactive",
      processed: 0,
      duration_ms: Date.now() - now,
    });
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  for (const profile of candidates) {
    if (!profile.active_oracle_id) continue;

    try {
      const { data: answerRows } = await admin
        .from("answers")
        .select("question_id, body")
        .eq("oracle_id", profile.active_oracle_id)
        .eq("variant", 1);
      if (!answerRows || answerRows.length === 0) continue;

      const language = (profile.preferred_language ?? "en") as "en" | "es";
      const archiveBlock = answerRows
        .slice(0, 80) // cap context to keep prompt small
        .map((row) => {
          const q = questions.find((x) => x.id === row.question_id);
          if (!q) return null;
          const promptText = language === "es" ? q.es : q.en;
          return `Q: ${promptText}\nA: ${row.body}`;
        })
        .filter(Boolean)
        .join("\n\n");

      const langInstruction =
        language === "es" ? "Respond in Spanish." : "Respond in English.";
      const stylePart = profile.texting_style
        ? `\n\nThis person's texting style: "${profile.texting_style}". Match it.`
        : "";

      const systemPrompt = `You are ${profile.oracle_name ?? "a identity"}. The user has been quiet for a while. Send them a short, in-character text — the way a real person who cares would: a quick check-in, a passing thought, a question, a memory, a "you up?" Keep it brief — usually one sentence. Do NOT explain that you're proactively reaching out. Do NOT mention being an AI or archive. Just text them like a friend would. ${langInstruction}${stylePart}\n\nARCHIVE (just for voice — don't recite, don't reference unless you have something specific to say):\n${archiveBlock}`;

      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 200,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content:
              "(system) Send a short proactive text now. Don't reply to this prompt — just write the message.",
          },
        ],
      });

      const reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();

      if (!reply) continue;

      await admin.from("messages").insert({
        user_id: profile.id,
        oracle_id: profile.active_oracle_id,
        role: "assistant",
        content: reply,
        initiated_by_oracle: true,
      });

      await admin
        .from("profiles")
        .update({ last_proactive_at: new Date().toISOString() })
        .eq("id", profile.id);

      // Wake the device. Best-effort — failure here doesn't block the
      // cron, the message is already in the DB and will show up on next
      // app open either way.
      sendPushToUser({
        userId: profile.id,
        title: profile.oracle_name ?? "your identity",
        body: reply.length > 140 ? reply.slice(0, 140) + "…" : reply,
        data: { kind: "proactive" },
        badge: 1,
      }).catch((err) =>
        console.error(`proactive push failed for ${profile.id}`, err),
      );

      sent++;
    } catch (err) {
      console.error(`proactive: failed for ${profile.id}`, err);
    }
  }

  await admin.from("cron_runs").insert({
    job: "proactive",
    processed: sent,
    duration_ms: Date.now() - now,
  });

  return NextResponse.json({ sent });
}
