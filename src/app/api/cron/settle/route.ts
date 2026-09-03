import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { ADMIN_EMAILS } from "@/lib/admin/allowlist";
import {
  LAUNCH_MONTH,
  LEDGER_SHIPPED_MONTH,
  fetchMonthBreakdown,
  isSettleable,
  nextMonth,
  prevMonth,
  settlementWindow,
  type MonthBreakdown,
} from "@/lib/admin/monthBreakdown";
import { fetchMarketingReport, type MarketingReport } from "@/lib/admin/marketingReports";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * TRANSFER DAY (Wilson 2026-09-02: "make sure it updates every 27th").
 * Runs at 05:05 UTC on the 27th (just past the window boundary at
 * 05:00). It sweeps EVERY month since the ledger shipped whose transfer
 * day has passed: freezes any that aren't in public.settlements yet,
 * and emails both owners the transfer sheet for any month they were
 * never told about (settlements.sheet_emailed_at is null), stamping it
 * once the email is delivered. So a 27th that Vercel skips, or a month
 * that froze itself when someone opened the admin page, still gets its
 * sheet on the next run — and a month never gets two sheets by accident.
 *
 * ?month=YYYY-MM re-sends ONE month's sheet on purpose (only if its
 * transfer day has passed). The email says RESENT and repeats the date
 * it was first sent, so nobody transfers twice. Already-frozen numbers
 * are returned as-is — delete the settlements row to recompute.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  const rawMonth = request.nextUrl.searchParams.get("month");
  const resendMonth = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : null;
  if (rawMonth && !resendMonth) {
    return NextResponse.json({ ok: false, error: "month must be YYYY-MM" }, { status: 400 });
  }

  // Which months to look at: one (manual resend) or every settleable
  // month since the ledger shipped (the cron). Bounded — isSettleable is
  // false the moment a month's window hasn't closed yet.
  const months: string[] = [];
  if (resendMonth) {
    if (isSettleable(resendMonth)) months.push(resendMonth);
  } else {
    for (let m = LEDGER_SHIPPED_MONTH; isSettleable(m); m = nextMonth(m)) months.push(m);
  }

  if (months.length === 0) {
    if (resendMonth) {
      // Operator typo — answer the caller, don't dirty the cron readout.
      return NextResponse.json(
        { ok: false, month: resendMonth, error: `transfer day for ${resendMonth} hasn't arrived — nothing to settle or resend` },
        { status: 409 },
      );
    }
    const firstDue = settlementWindow(LEDGER_SHIPPED_MONTH).end;
    if (Date.now() < firstDue.getTime()) {
      // A test run before the first transfer day (Vercel's "Run" button).
      // Nothing is due; say so and leave an ok row so the readout shows
      // the job is wired up.
      await admin.from("cron_runs").insert({
        job: "settle",
        processed: 0,
        duration_ms: Date.now() - startedAt,
        status: "ok",
        error: null,
      });
      return NextResponse.json({
        ok: true,
        skipped: `nothing due yet — the first transfer day is ${firstDue.toISOString().slice(0, 10)}`,
      });
    }
    // Past the first transfer day and nothing settleable: the schedule
    // only fires after a window closes, so this is a clock or schedule
    // problem. On the readout, never a silent "ok".
    const error = "no settleable month found (clock or schedule problem)";
    await admin.from("cron_runs").insert({
      job: "settle",
      processed: 0,
      duration_ms: Date.now() - startedAt,
      status: "error",
      error,
    });
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }

  const results: MonthResult[] = [];
  const problems: string[] = [];
  let emailsSent = 0;
  try {
    for (const month of months) {
      const r = await settleAndNotify(admin, month, { resend: Boolean(resendMonth) });
      results.push(r);
      emailsSent += r.emailed;
      problems.push(...r.problems.map((p) => `${month}: ${p}`));
    }
    const ok = problems.length === 0;
    await admin.from("cron_runs").insert({
      job: "settle",
      processed: emailsSent,
      duration_ms: Date.now() - startedAt,
      status: ok ? "ok" : "error",
      error: ok ? null : problems.join("; "),
    });
    return NextResponse.json(
      { ok, months: results, emailed: emailsSent, error: ok ? undefined : problems.join("; ") },
      { status: ok ? 200 : 500 },
    );
  } catch (err) {
    // A throw mid-sweep (a read that failed, a freeze that didn't write)
    // keeps whatever already happened in the readout.
    const message = err instanceof Error ? err.message : String(err);
    await admin.from("cron_runs").insert({
      job: "settle",
      processed: emailsSent,
      duration_ms: Date.now() - startedAt,
      status: "error",
      error: [...problems, message].join("; "),
    });
    return NextResponse.json({ ok: false, months: results, error: message }, { status: 500 });
  }
}

type MonthResult = {
  month: string;
  frozen: boolean;
  settledBy: MonthBreakdown["settledBy"];
  settledAt: string | null;
  /** When the owners were first sent this month's sheet (null = never). */
  sheetEmailedAt: string | null;
  /** Emails delivered on THIS run. */
  emailed: number;
  resent: boolean;
  problems: string[];
  sheet: string | null;
};

type Admin = ReturnType<typeof createAdminClient>;

/** Freeze one month (if it isn't already) and send its sheet if nobody
 *  has been told — or on purpose, marked RESENT. */
async function settleAndNotify(
  admin: Admin,
  month: string,
  opts: { resend: boolean },
): Promise<MonthResult> {
  const problems: string[] = [];
  const b = await fetchMonthBreakdown(admin, month, { settledBy: "cron" });

  // Did this month's sheet already go out? (The row exists whenever
  // fetchMonthBreakdown returned a frozen month.)
  const stamp = await admin.from("settlements").select("sheet_emailed_at").eq("month", month).maybeSingle();
  if (stamp.error) throw new Error(`settlements stamp read (${month}): ${stamp.error.message}`);
  const sheetEmailedAt: string | null = stamp.data?.sheet_emailed_at ?? null;

  if (!b.frozen) problems.push("month was NOT written to the ledger");

  const base: MonthResult = {
    month,
    frozen: b.frozen,
    settledBy: b.settledBy,
    settledAt: b.settledAt,
    sheetEmailedAt,
    emailed: 0,
    resent: false,
    problems,
    sheet: null,
  };

  // Cron run, month already announced: nothing to send. The freeze
  // check above still runs so a vanished row is noticed.
  if (sheetEmailedAt && !opts.resend) return base;

  const resent = Boolean(sheetEmailedAt) && opts.resend;
  // Last month's bank reading (typed on the 1st) sits beside the
  // formula so drift is in the email, not just on the page.
  const prevReport = await fetchMarketingReport(admin, prevMonth(month));
  const sheet = transferSheet(b, prevReport, { resent, firstEmailedAt: sheetEmailedAt });
  const subject = `${resent ? "RESENT — " : ""}Transfer day — ${b.monthLabel} is ${b.frozen ? "final" : "NOT settled"}`;

  let emailed = 0;
  for (const to of ADMIN_EMAILS) {
    // Resend's SDK reports failures in `error`; it does not throw.
    const { error } = await resend.emails.send({
      from: "chapter3five <safety@chapter3five.app>",
      to,
      subject,
      text: sheet,
    });
    if (error) {
      console.error(`[settle] send to ${to} failed:`, error);
      problems.push(`transfer sheet to ${to} not delivered (${error.message})`);
    } else {
      emailed++;
    }
  }
  if (emailed === 0) problems.push("no transfer-sheet email delivered");

  // Stamp only a first delivery of a FROZEN month: a live month's sheet
  // (which shouldn't happen — see the problem above) must not count as
  // the owners having been told the final numbers.
  let stampedAt = sheetEmailedAt;
  if (emailed > 0 && b.frozen && !sheetEmailedAt) {
    stampedAt = new Date().toISOString();
    const upd = await admin
      .from("settlements")
      .update({ sheet_emailed_at: stampedAt })
      .eq("month", month)
      .is("sheet_emailed_at", null);
    if (upd.error) {
      // The email went out; failing to stamp it would send it again next
      // run. That's a loud error, not a silent double.
      problems.push(`sheet_emailed_at not stamped (${upd.error.message}) — next run will re-send`);
      stampedAt = null;
    }
  }

  return { ...base, sheetEmailedAt: stampedAt, emailed, resent, sheet };
}

const usd = (c: number) =>
  (c / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

/** What the formula said the Marketing account held after LAST month's
 *  transfer — this month's balance minus this month's transfer. Same
 *  arithmetic the ledger uses; no second money calc. */
function prevFormulaBalance(b: MonthBreakdown): number {
  return b.growthBalanceCents - b.growthTransferCents;
}

/** The plain-English sheet — what to actually do at the bank. */
function transferSheet(
  b: MonthBreakdown,
  prevReport: MarketingReport | null,
  status: { resent: boolean; firstEmailedAt: string | null },
): string {
  const lines: string[] = [];
  lines.push(`${b.monthLabel} — ${b.periodLabel}`);
  if (!b.frozen) {
    lines.push("⚠️ NOT SETTLED — these numbers were NOT written to the ledger. Do not transfer anything; open the admin page and check the cron readout.");
  } else if (status.resent) {
    lines.push(
      `⚠️ RESENT — this month was ALREADY SETTLED on ${b.settledAt?.slice(0, 10) ?? "?"} and this sheet first went out ${status.firstEmailedAt?.slice(0, 10) ?? "?"}. The numbers are the same. Do NOT transfer again if you already did.`,
    );
  } else {
    lines.push(`FINAL (written to the ledger${b.settledAt ? ` ${b.settledAt.slice(0, 10)}` : ""}).`);
    if (b.settledBy === "lazy") {
      lines.push("This month settled itself when the admin page was opened after the 27th — no sheet went out then. This is the first one.");
    }
  }
  lines.push("");
  lines.push("SUMMARY:");
  lines.push(b.summary);
  lines.push("");
  lines.push("COMING UP:");
  for (const u of b.upcoming) lines.push(`  • ${u}`);
  lines.push("");
  lines.push("THE NUMBERS:");
  lines.push(`Sales ${usd(b.grossCents)} (web ${usd(b.grossWebCents)} · stores ${usd(b.grossStoreCents)})`);
  lines.push(`Store cut ${usd(b.storeCommissionCents)}${b.storeCommissionActual ? "" : " (est.)"} · card fees ${usd(b.webProcessingCents)} (${b.webChargeCount} charges)`);
  lines.push(`Expenses ${usd(b.totalExpensesCents)} → ${b.profitCents < 0 ? `LOSS ${usd(-b.profitCents)}` : `profit ${usd(b.profitCents)}`}`);
  if (b.contributionsCents > 0) {
    lines.push(`Member contributions on the 1st: ${usd(b.contributionsCents)} (${usd(b.contributionsPerMemberCents)} each — capital, not income)`);
  }
  if (b.lockedSavingsDepositCents > 0) {
    lines.push(`Savings floor put in by ${b.partners.filter((p) => p.savingsDepositCents > 0).map((p) => `${p.name} (${usd(p.savingsDepositCents)})`).join(" + ")} — capital, stays in savings`);
  }
  lines.push("");
  lines.push(status.resent ? "DO TODAY (the 27th) — ONLY IF NOT DONE ALREADY:" : "DO TODAY (the 27th):");
  if (b.storeNetCents > 0) {
    lines.push(`  ⏱ Timing: ${usd(b.webNetCents)} of this month is web money (in the bank within days). ${usd(b.storeNetCents)} is store money — Apple pays about a month behind, Google mid-next-month. Make the transfers once it lands.`);
  }
  if (b.paidOutCents === 0) {
    lines.push(`  • Nothing to transfer this month${b.profitCents < 0 ? " — it was a loss month" : " — the reserve and taxes took all of it"}.`);
  }
  for (const p of b.partners) {
    if (p.payout === "december") {
      lines.push(
        p.drawCents > 0
          ? `  • ${p.name}: DECEMBER DRAW ${usd(p.drawCents)} (this month ${usd(p.transferCents)} + pot ${usd(p.potBeforeCents)}) — transfer to their bank`
          : `  • ${p.name}: nothing leaves — ${usd(p.transferCents)} added to the December pot, now ${usd(p.undrawnBalanceCents)}`,
      );
      if (p.drawCents > 0 && p.taxSchedule === "december" && p.taxHeldCents > 0) {
        lines.push(`  • ${p.name}: ALSO pay his taxes — ${usd(p.taxHeldCents)} held for him, sent in his own name (IRS / NY State / NYC), then record it on the page so the held amount drains`);
      }
    } else if (p.drawCents > 0) {
      lines.push(`  • ${p.name}: transfer ${usd(p.drawCents)} to their bank`);
    } else {
      lines.push(`  • ${p.name}: nothing this month`);
    }
  }
  if (b.growthTransferCents > 0) {
    lines.push(`  • Marketing account (Navy Federal): move ${usd(b.growthTransferCents)} (27th → 1st money; the formula says it should then hold ${usd(b.growthBalanceCents)})`);
  } else {
    lines.push(`  • Marketing account (Navy Federal): nothing to move (formula balance stays ${usd(b.growthBalanceCents)})`);
  }
  lines.push(`  • Cash leaving the account today: ${usd(b.paidOutCents)}`);
  if (b.taxPaidTotalCents > 0) {
    lines.push(`  • (Already left this month, on the days they were sent: ${usd(b.taxPaidTotalCents)} in tax payments — ${b.partners.filter((p) => p.taxPaidCents > 0).map((p) => `${p.name} ${usd(p.taxPaidCents)}`).join(" · ")})`);
  }
  lines.push("");
  lines.push("STAYS IN THE ACCOUNT:");
  for (const p of b.partners) {
    const t = p.taxParts;
    lines.push(
      `  • ${p.name}'s taxes ${usd(p.taxEnvelopeCents)} (SE ${usd(t.seCents)} · federal ${usd(t.federalCents)} · state ${usd(t.stateCents)}${t.cityCents ? ` · NYC ${usd(t.cityCents)}` : ""}${t.localCents ? ` · Bethlehem ${usd(t.localCents)}` : ""}${t.paNonresidentCents ? ` · of the state line, ${usd(t.paNonresidentCents)} goes to PA first and NY credits it` : ""}) — held for ${p.name} now ${usd(p.taxHeldCents)}${p.taxPaidCents > 0 ? ` (after ${usd(p.taxPaidCents)} sent this month)` : ""}`,
    );
    if (p.taxOverpaidCents > 0) {
      lines.push(`  • ⚠️ ${usd(p.taxOverpaidCents)} more was sent for ${p.name}'s taxes than was held — the business advanced it; the next envelopes fill it back`);
    }
  }
  lines.push(`  • Operating reserve ${usd(b.reserveAfterCents)} of ${usd(b.reserveTargetCents)} target — next month's bills ${usd(b.billsCents)} (fixed subs + this month's usage) + cushion for growth ${usd(b.cushionCents)} (top-up this month ${usd(b.reserveTopUpCents)}${b.reserveDrawCents ? `, drawn ${usd(b.reserveDrawCents)}` : ""})`);
  if (b.shortfallCents > 0) {
    lines.push(
      b.shortfallPaidBy
        ? `  • ⚠️ SHORTFALL ${usd(b.shortfallCents)} the reserve couldn't cover — paid out of pocket by ${b.shortfallPaidBy}, booked as capital the business owes back`
        : `  • ⚠️ SHORTFALL ${usd(b.shortfallCents)} the reserve couldn't cover — paid out of pocket; nobody booked yet (set shortfall_paid_by so it becomes their capital)`,
    );
  }
  lines.push(`  • The operating account should hold about ${usd(b.accountShouldHoldCents)} after today (reserve + taxes still held after payments sent + December pots)`);
  const owed = b.partners.filter((p) => p.capitalCents > 0);
  if (owed.length > 0) {
    lines.push(`  • Capital the business owes back: ${owed.map((p) => `${p.name} ${usd(p.capitalCents)}`).join(" · ")} (the $175s, the savings floor, any loss covered out of pocket)`);
  }
  if (b.lockedSavingsCents > 0) {
    lines.push(`  • The savings account holds ${usd(b.lockedSavingsCents)} — the bank's minimum, a member's capital. Never reserve, never marketing, never spent.`);
  }
  lines.push("");
  lines.push("TAXES — WHAT'S DUE NEXT (record every payment on the page the day it's sent):");
  for (const p of b.partners) {
    if (p.taxDueNote) lines.push(`  • ${p.taxDueNote}`);
  }
  lines.push("");
  lines.push(b.contributionsVerdict);
  lines.push("");
  lines.push(`ON THE 1ST: report what Navy Federal shows in the Marketing account (formula expects ${usd(b.growthBalanceCents)}) — https://chapter3five.app/admin/revenue?month=${b.month}`);
  const prevLabel = settlementWindow(prevMonth(b.month)).monthLabel;
  if (prevReport) {
    const diff = prevReport.balanceCents - prevFormulaBalance(b);
    lines.push(
      `Last month's check: Navy Federal showed ${usd(prevReport.balanceCents)} on ${prevReport.reportedOn} for ${prevLabel}` +
        (diff === 0 ? " — matches the formula." : ` — ${usd(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than the formula expected (${usd(prevFormulaBalance(b))}).`),
    );
  } else if (prevMonth(b.month) >= LAUNCH_MONTH) {
    lines.push(`⏰ ${prevLabel}'s Marketing balance was never reported — open the page, tap ‹, and type what the bank showed on the 1st.`);
  }
  lines.push("");
  lines.push("Statement: https://chapter3five.app/admin/revenue/statement · not tax advice");
  return lines.join("\n");
}
