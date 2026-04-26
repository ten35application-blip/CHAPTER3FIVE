import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { questions } from "@/content/questions";

export const runtime = "nodejs";

/**
 * Daily question nudge cron — runs at 14:00 UTC (~10am US East,
 * ~7am US West, ~3pm Europe).
 *
 * For each real-mode user who:
 *   - has finished initial onboarding (active oracle exists)
 *   - hasn't completed all 355 questions yet
 *   - has outreach_enabled = true
 *   - hasn't received a daily-question push in the last 22 hours
 *   - isn't soft-deleted, deceased, or in randomize/import mode
 *
 * pick one of their unanswered questions and send a push notification
 * with the question text. Tapping the notification deep-links into
 * /answers#q<id> on web (mobile follows the same URL via the linking
 * config). Combined with voice + Whisper, "answer one today" is a
 * 30-second commitment.
 */

const ONE_DAY = 24 * 60 * 60 * 1000;
const TWENTY_TWO_HOURS = 22 * 60 * 60 * 1000;
const BATCH = 200;
const TARGET_TOTAL = questions.length; // 355

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  const cutoff = new Date(startedAt - TWENTY_TWO_HOURS).toISOString();

  // Eligibility: real mode, opted-in, not deleted/deceased, hasn't
  // received a daily-question ping in the last 22h, has at least one
  // unanswered question.
  const { data: candidates, error } = await admin
    .from("profiles")
    .select(
      "id, oracle_name, preferred_language, active_oracle_id, mode, last_daily_question_at",
    )
    .eq("mode", "real")
    .eq("outreach_enabled", true)
    .is("deceased_at", null)
    .is("deleted_at", null)
    .not("active_oracle_id", "is", null)
    .or(`last_daily_question_at.is.null,last_daily_question_at.lt.${cutoff}`)
    .limit(BATCH);

  if (error) {
    await admin.from("cron_runs").insert({
      job: "daily_question",
      status: "error",
      error: error.message,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let sent = 0;
  let skippedComplete = 0;
  const errors: string[] = [];

  for (const p of candidates ?? []) {
    if (!p.active_oracle_id) continue;

    try {
      // Get the IDs of questions this user has already answered (text
      // body present, audio doesn't count for onboarding completion
      // since we want them to do at least the typed/transcribed part).
      const { data: answered } = await admin
        .from("answers")
        .select("question_id")
        .eq("oracle_id", p.active_oracle_id)
        .eq("variant", 1)
        .neq("body", "");

      const answeredIds = new Set(
        (answered ?? []).map((a) => a.question_id),
      );

      if (answeredIds.size >= TARGET_TOTAL) {
        // Onboarding complete — they've answered everything. Mark
        // the timestamp so we don't re-evaluate them every run.
        await admin
          .from("profiles")
          .update({ last_daily_question_at: new Date().toISOString() })
          .eq("id", p.id);
        skippedComplete++;
        continue;
      }

      const language = (p.preferred_language ?? "en") as "en" | "es";
      const unanswered = questions.filter((q) => !answeredIds.has(q.id));
      if (unanswered.length === 0) {
        skippedComplete++;
        continue;
      }

      // Pick one. Prefer "surface" or "texture" depth for new users
      // (shallower than "depth" or "soul"); fall back to any if none.
      const easy = unanswered.filter(
        (q) => q.depth === "surface" || q.depth === "texture",
      );
      const pool = easy.length > 0 ? easy : unanswered;
      const pick = pool[Math.floor(Math.random() * pool.length)];

      const questionText = language === "es" ? pick.es : pick.en;

      // Push notification. Tap deep-links into /answers#q<id>; mobile
      // (Expo Linking) honors the same URL via the configured scheme,
      // and we already pass the URL fragment for the web client.
      sendPushToUser({
        userId: p.id,
        title:
          language === "es" ? "Pregunta de hoy" : "Today's question",
        body:
          questionText.length > 140
            ? questionText.slice(0, 140) + "…"
            : questionText,
        data: {
          kind: "daily_question",
          question_id: pick.id,
          deep_link: `/answers#q${pick.id}`,
        },
      }).catch((err) =>
        console.error(`daily-question push failed for ${p.id}`, err),
      );

      await admin
        .from("profiles")
        .update({ last_daily_question_at: new Date().toISOString() })
        .eq("id", p.id);

      sent++;
    } catch (err) {
      errors.push(
        `${p.id}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  await admin.from("cron_runs").insert({
    job: "daily_question",
    processed: sent,
    duration_ms: Date.now() - startedAt,
    status: errors.length > 0 ? "error" : "ok",
    error: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
  });

  return NextResponse.json({
    sent,
    skipped_complete: skippedComplete,
    errors,
  });
}

// Suppress unused-warning when ONE_DAY isn't directly referenced (the
// constant is documentary).
void ONE_DAY;
