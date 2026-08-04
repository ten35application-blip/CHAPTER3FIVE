/**
 * Wall-clock budget for the daily crons.
 *
 * THE PROBLEM THIS EXISTS FOR. Every cron loops over a batch — 25 for
 * proactive, 50 for check-in, 100 for anniversaries and outreach, 200
 * for persona-outreach — and most of them make an Anthropic call per
 * row. That is seconds per row, so a full batch is minutes.
 *
 * None of them declared `maxDuration`. Ten other routes in this repo do
 * (identity creation sets 300, chat streaming sets 60), so the crons
 * were quietly running on Vercel's default of roughly fifteen seconds.
 * A hundred-row batch got two or three rows in and the platform killed
 * the function mid-loop.
 *
 * And it was invisible. Every one of these routes writes its heartbeat
 * and audit row at the END, after the loop — so a truncated run never
 * reported anything at all. Nothing failed. Nothing alerted. The rows
 * that didn't get processed just quietly didn't get processed, and the
 * next day's run started over from the same place and died in the same
 * spot.
 *
 * It has not bitten yet only because the batches are currently two test
 * accounts. It would start the day there are real users, which is the
 * worst possible day to find out.
 *
 * THE FIX IS TWO HALVES, and each is useless alone:
 *   1. Every cron now declares `export const maxDuration = 300`.
 *   2. This budget stops the loop at 240s — sixty seconds of headroom —
 *      so the run ends on OUR terms, writes its heartbeat, and reports
 *      honestly how many rows it left behind.
 *
 * Stopping early is fine for every one of these jobs: they all re-query
 * their candidates from scratch on the next run, so an unprocessed row
 * is picked up tomorrow rather than lost. What was NOT fine was being
 * killed without a record.
 *
 * 300 is the Vercel Pro ceiling and matches what identity creation and
 * the Stripe webhook already use.
 */

/**
 * Vercel Pro's per-function ceiling, and the value every cron declares.
 *
 * NOT imported by the crons, deliberately. Next reads route segment
 * config (maxDuration, runtime, revalidate, dynamic) STATICALLY, without
 * executing the module — so `export const maxDuration = CRON_MAX_DURATION`
 * compiles fine, passes tsc, passes lint, and then fails the build at the
 * "Collecting page data" step with:
 *
 *   Invalid segment configuration export detected.
 *
 * That step runs AFTER "✓ Compiled successfully" prints, which is what
 * makes it easy to miss locally. Each cron hard-codes `300` with a
 * comment pointing here. If this number changes, grep for it.
 */
export const CRON_MAX_DURATION = 300;

/** Stop this many ms in, leaving headroom to finish the current row. */
const SOFT_BUDGET_MS = 240_000;

export type CronBudget = {
  /** True once the loop should stop taking new rows. */
  exhausted: () => boolean;
  /** ms since the run started — for the heartbeat's duration_ms. */
  elapsed: () => number;
};

export function startCronBudget(startedAt: number): CronBudget {
  return {
    exhausted: () => Date.now() - startedAt > SOFT_BUDGET_MS,
    elapsed: () => Date.now() - startedAt,
  };
}
