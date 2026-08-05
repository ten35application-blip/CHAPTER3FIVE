import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin/allowlist";

export const runtime = "nodejs";

/**
 * Cron heartbeat readout. For each configured cron, reports the
 * last row in cron_runs — how long ago, its status, whether it
 * appears stale compared to its expected cadence.
 *
 * Admin-only. Wilson can hit this on demand, and (later) an
 * external uptime pinger can hit it too to alert on stale jobs.
 *
 * Fable audit: cron_runs was written on every run but no code ever
 * READ from it — silent cron failures went unnoticed.
 */

// Expected cadence per job (from vercel.json). Grace = how much
// slack we give before flagging as stale (roughly 2× cadence).
const JOBS: Record<string, { cadenceHours: number; graceHours: number }> = {
  outreach:            { cadenceHours: 24, graceHours: 48 },
  proactive:           { cadenceHours: 24, graceHours: 48 },
  purge:               { cadenceHours: 24, graceHours: 48 },
  reflect:             { cadenceHours: 24 * 7, graceHours: 24 * 9 },
  anniversaries:       { cadenceHours: 24, graceHours: 48 },
  // daily-question job removed in the 2026-07-29 old-app nuke.
  // vercel.json runs check-in daily at 16:00 UTC (Vercel Hobby's
  // once-per-day cron limit). It's HOURLY-shaped internally
  // (walks chat_blocks whose cooldown expired) but its INVOCATION
  // is daily; the readout tracks invocation cadence.
  "check-in":          { cadenceHours: 24, graceHours: 48 },
  "persona-outreach":  { cadenceHours: 24, graceHours: 48 },
  // passing was deliberately unscheduled 2026-08-04 (see the header of
  // api/cron/passing/route.ts — inherit codes are live from mint, so
  // nothing needs to detect a death). Tracking it here would flag a
  // permanent false "stale" the day the readout starts working.
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "not_admin" }, { status: 403 });
  }

  const admin = createAdminClient();

  const results = await Promise.all(
    Object.entries(JOBS).map(async ([job, { cadenceHours, graceHours }]) => {
      // ran_at, NOT created_at — cron_runs is
      // (id, job, ran_at, status, processed, error, duration_ms) per
      // migration 0020. Selecting created_at returned PostgREST 42703
      // on every job; the error was discarded, data came back null, and
      // all eight jobs reported never_run/stale regardless of whether
      // they had run.
      const { data: latest, error: latestErr } = await admin
        .from("cron_runs")
        .select("processed, duration_ms, status, error, ran_at")
        .eq("job", job)
        .order("ran_at", { ascending: false })
        .limit(1)
        .maybeSingle<{
          processed: number | null;
          duration_ms: number | null;
          status: string | null;
          error: string | null;
          ran_at: string;
        }>();

      // Don't let a query failure masquerade as "this job never ran" —
      // that's the shape of the bug above.
      if (latestErr) {
        return {
          job,
          status: "unknown" as const,
          cadence_hours: cadenceHours,
          last_run: null,
          hours_since_last: null,
          error: `cron_runs query failed: ${latestErr.message}`,
          stale: true,
        };
      }

      if (!latest) {
        return {
          job,
          status: "never_run" as const,
          cadence_hours: cadenceHours,
          last_run: null,
          hours_since_last: null,
          stale: true,
        };
      }

      const hoursSince =
        (Date.now() - new Date(latest.ran_at).getTime()) / (1000 * 60 * 60);
      const stale = hoursSince > graceHours;

      return {
        job,
        cadence_hours: cadenceHours,
        last_run: latest.ran_at,
        hours_since_last: Math.round(hoursSince * 10) / 10,
        status: latest.status ?? "unknown",
        error: latest.error,
        processed: latest.processed,
        duration_ms: latest.duration_ms,
        stale,
      };
    }),
  );

  const anyStale = results.some((r) => r.stale);
  const anyErrored = results.some((r) => r.status === "error");

  return NextResponse.json(
    {
      overall: anyStale || anyErrored ? "degraded" : "ok",
      any_stale: anyStale,
      any_errored: anyErrored,
      jobs: results,
    },
    // 200 for machine-consumable status; body carries the verdict.
    // If Wilson wires an uptime pinger, it can grep for
    // "degraded" or parse jobs[].stale.
    { status: 200 },
  );
}
