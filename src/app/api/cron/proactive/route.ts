import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CRON_MAX_DURATION } from "@/lib/cron/budget";

export const runtime = "nodejs";
export const maxDuration = CRON_MAX_DURATION;

// NOTE: THIS CRON IS A NO-OP. The loop below `continue`s for every
// candidate — proactive outreach was paused pending the rewire onto
// oracles.legacy_answers and never came back. It still runs daily at
// 17:00 UTC and still reports a heartbeat, so from the outside it looks
// like a healthy job that simply never has anyone to message. It has no
// time budget for the same reason: there is no work to budget.
// Either finish the rewire or drop it from vercel.json.
// anthropic / spendGovernor / opener / arc / sendPushToUser imports
// removed with the neuter -- they'll come back with the legacy_answers
// rewire when the compose+push body returns.

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

  const sent = 0;
  for (const profile of candidates) {
    if (!profile.active_oracle_id) continue;

    // Skip if the user muted this conversation. Read separately so a
    // missing column (older deploy) doesn't crash the cron.
    type MuteEntry = { kind?: string; id?: string };
    let muted: MuteEntry[] = [];
    try {
      const { data: row } = await admin
        .from("profiles")
        .select("muted_conversations")
        .eq("id", profile.id)
        .maybeSingle();
      if (Array.isArray((row as { muted_conversations?: unknown } | null)?.muted_conversations)) {
        muted = (row as { muted_conversations: MuteEntry[] }).muted_conversations;
      }
    } catch {
      muted = [];
    }
    if (
      muted.some(
        (m) => m.kind === "owned" && m.id === profile.active_oracle_id,
      )
    ) {
      continue;
    }

    // Proactive outreach is intentionally paused (Fable audit follow-
    // up). The old body pulled context from the deleted answers table
    // + 355-question set; the new legacy_answers JSONB rewire is a
    // follow-up phase. Skip cleanly for every user so the cron loop
    // stays healthy and the schedule doesn't rot. The whole compose /
    // Anthropic / persist / push block will come back when the rewire
    // reads from oracles.legacy_answers instead.
    continue;
  }

  await admin.from("cron_runs").insert({
    job: "proactive",
    processed: sent,
    duration_ms: Date.now() - now,
  });

  return NextResponse.json({ sent });
}
