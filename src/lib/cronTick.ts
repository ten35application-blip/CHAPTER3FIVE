import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cron auth for the pg_cron era (2026-08-25).
 *
 * Vercel Hobby crons are best-effort — the ops digest caught
 * persona-outreach skipped three days straight and promised-pings
 * never firing. Supabase pg_cron is reliable and free, but it can't
 * carry CRON_SECRET (secrets don't belong in the cron catalog), so
 * gated routes get a second door:
 *
 *   1. CRON_SECRET Bearer (Vercel cron, manual ops) → authorized,
 *      and the tick is stamped so backstops stand down.
 *   2. No/wrong secret (pg_cron, or anyone else on the internet) →
 *      authorized ONLY by atomically claiming the job's tick row,
 *      which requires the last run to be older than minGapMinutes.
 *
 * Door 2 is safe because every route behind it is idempotent (status
 * flags, yearly acknowledgment dedup, cadence gates) — an outside
 * caller can only make the job run when it was due anyway, at most
 * once per gap window. Postgres serializes the conditional UPDATE, so
 * concurrent callers can't both claim.
 */
export async function authorizeCronTick(
  request: NextRequest,
  jobName: string,
  minGapMinutes: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`) {
    // Secret path: stamp unconditionally so a pg_cron backstop an hour
    // later sees a fresh run and stands down.
    await admin
      .from("internal_ticks")
      .upsert({ name: jobName, last_run_at: new Date().toISOString() });
    return true;
  }
  const { data: claimed } = await admin
    .from("internal_ticks")
    .update({ last_run_at: new Date().toISOString() })
    .eq("name", jobName)
    .lt(
      "last_run_at",
      new Date(Date.now() - minGapMinutes * 60_000).toISOString(),
    )
    .select("name");
  return !!claimed && claimed.length > 0;
}
