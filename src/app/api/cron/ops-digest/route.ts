import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { ADMIN_EMAILS } from "@/lib/admin/allowlist";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * The morning eyes (Wilson 2026-08-26, closing the "we built ledgers,
 * nobody reads them" gap). One email a day: which crons didn't run,
 * what money failed to land, who might be in crisis, what reports are
 * waiting, what came in yesterday, and whether the living formula is
 * actually landing. Every section is defensive — a failed query
 * becomes a visible "check failed" line, never a silent omission and
 * never a dead digest.
 */

// reflect (weekly, Sundays) is deliberately ABSENT from this list —
// including it would false-alarm six days out of seven. If it ever
// needs health-checking, give it its own weekly-aware check; do not
// just add it here.
const EXPECTED_CRONS = [
  "proactive",
  "purge",
  "anniversaries",
  "check-in",
  "persona-outreach",
  "promised-pings",
  "archive-backup",
];

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  const dayAgo = new Date(startedAt - 26 * 3600_000).toISOString();
  const lines: string[] = [];
  let alarms = 0;

  // ── Cron heartbeats ──
  try {
    const { data } = await admin
      .from("cron_runs")
      .select("job, status")
      .gte("ran_at", dayAgo);
    const ran = new Set((data ?? []).map((r) => r.job as string));
    const errored = (data ?? []).filter((r) => r.status === "error");
    const missing = EXPECTED_CRONS.filter((j) => !ran.has(j));
    if (missing.length === 0 && errored.length === 0) {
      lines.push("CRONS — all ran clean.");
    } else {
      alarms++;
      lines.push(
        `⚠️ CRONS — ${missing.length ? `did NOT run: ${missing.join(", ")}. ` : ""}${errored.length ? `ran with errors: ${[...new Set(errored.map((e) => e.job))].join(", ")}.` : ""}`,
      );
    }
  } catch (err) {
    alarms++;
    lines.push(`⚠️ CRONS — check failed: ${String(err).slice(0, 120)}`);
  }

  // ── Money that failed to land ──
  try {
    const { count: newFails } = await admin
      .from("grant_failures")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo);
    const { count: openFails } = await admin
      .from("grant_failures")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null);
    if ((newFails ?? 0) === 0 && (openFails ?? 0) === 0) {
      lines.push("GRANTS — nothing failed, nothing open.");
    } else {
      alarms++;
      lines.push(
        `⚠️ GRANTS — ${newFails ?? 0} new failure(s) in 24h, ${openFails ?? 0} unresolved total. Someone may have paid and not received. /admin.`,
      );
    }
  } catch (err) {
    alarms++;
    lines.push(`⚠️ GRANTS — check failed: ${String(err).slice(0, 120)}`);
  }

  // ── Crisis flags ──
  try {
    const { count: newFlags } = await admin
      .from("crisis_flags")
      .select("id", { count: "exact", head: true })
      .gte("flagged_at", dayAgo);
    const { count: openFlags } = await admin
      .from("crisis_flags")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null);
    if ((newFlags ?? 0) > 0 || (openFlags ?? 0) > 0) {
      alarms++;
      lines.push(
        `⚠️ CRISIS — ${newFlags ?? 0} new flag(s) in 24h, ${openFlags ?? 0} unreviewed. These are people. Look today.`,
      );
    } else {
      lines.push("CRISIS — no flags.");
    }
  } catch (err) {
    alarms++;
    lines.push(`⚠️ CRISIS — check failed: ${String(err).slice(0, 120)}`);
  }

  // ── Reports awaiting review ──
  try {
    const { count: pending } = await admin
      .from("message_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    if ((pending ?? 0) > 0) {
      alarms++;
      lines.push(
        `⚠️ REPORTS — ${pending} awaiting review (the Terms promise a person reads every one).`,
      );
    } else {
      lines.push("REPORTS — queue empty.");
    }
  } catch (err) {
    lines.push(`REPORTS — check failed: ${String(err).slice(0, 120)}`);
  }

  // ── Yesterday's money ──
  try {
    const { data: store } = await admin
      .from("store_purchases")
      .select("amount_cents")
      .gte("purchased_at", dayAgo)
      .is("refunded_at", null);
    const { data: web } = await admin
      .from("payments")
      .select("amount_cents")
      .eq("status", "paid")
      .gte("paid_at", dayAgo);
    const storeCents = (store ?? []).reduce(
      (s, r) => s + (r.amount_cents ?? 0),
      0,
    );
    const webCents = (web ?? []).reduce((s, r) => s + (r.amount_cents ?? 0), 0);
    lines.push(
      `REVENUE (24h) — stores $${(storeCents / 100).toFixed(2)}, web $${(webCents / 100).toFixed(2)}.`,
    );
  } catch (err) {
    lines.push(`REVENUE — check failed: ${String(err).slice(0, 120)}`);
  }

  // ── Is the living formula landing? ──
  try {
    const { data: proactive } = await admin
      .from("messages")
      .select("id, user_id, oracle_id, created_at, initiated_by")
      .not("initiated_by", "is", null)
      .neq("initiated_by", "user")
      .gte("created_at", dayAgo);
    const sent = proactive?.length ?? 0;
    let replied = 0;
    for (const m of proactive ?? []) {
      const { count } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", m.user_id)
        .eq("oracle_id", m.oracle_id)
        .eq("role", "user")
        .gt("created_at", m.created_at);
      if ((count ?? 0) > 0) replied++;
    }
    lines.push(
      sent === 0
        ? "PULSE — no proactive texts in 24h."
        : `PULSE — ${sent} proactive text(s), ${replied} got a reply so far.`,
    );
  } catch (err) {
    lines.push(`PULSE — check failed: ${String(err).slice(0, 120)}`);
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const subject =
    alarms === 0
      ? `chapter3five daily — all clear (${dateTag})`
      : `⚠️ chapter3five daily — ${alarms} thing(s) need eyes (${dateTag})`;
  const body =
    lines.join("\n") +
    `\n\n— your app, checking in. Admin: https://chapter3five.app/admin`;

  let sentCount = 0;
  for (const to of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "chapter3five <safety@chapter3five.app>",
        to,
        subject,
        text: body,
      });
      sentCount++;
    } catch (err) {
      console.error(`[ops-digest] send to ${to} failed:`, err);
    }
  }

  await admin.from("cron_runs").insert({
    job: "ops-digest",
    processed: sentCount,
    duration_ms: Date.now() - startedAt,
    status: sentCount > 0 ? "ok" : "error",
    error: sentCount === 0 ? "no digest delivered" : null,
  });

  return NextResponse.json({ sent: sentCount, alarms, lines });
}
