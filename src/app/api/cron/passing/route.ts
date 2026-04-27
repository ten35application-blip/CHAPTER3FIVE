import { NextResponse, type NextRequest } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendBeneficiaryActivationEmail,
  recordAudit,
} from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * Daily passing-report cron. For each report whose 72h veto window
 * has elapsed without the owner clicking cancel:
 *  1. Mark the report 'confirmed'
 *  2. Stamp profiles.deceased_at with the date the reporter gave
 *  3. Flip every 'designated' beneficiary for that owner to
 *     'activated' so their /legacy/[token] claim links work
 *  4. Email each beneficiary their personalized claim URL
 *
 * Idempotent — re-running won't double-activate. The cron is daily,
 * which means the actual unlock can land up to 24h after the 72h
 * window closes. That's fine; the email tells the owner the deadline
 * in UTC, not "exactly 72h to the second".
 */

const BATCH = 25;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (
    !process.env.CRON_SECRET ||
    auth !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();

  const { data: due, error } = await admin
    .from("passing_reports")
    .select(
      "id, owner_user_id, reporter_email, passed_on, submitted_at, veto_deadline",
    )
    .eq("status", "pending")
    .lte("veto_deadline", new Date().toISOString())
    .order("veto_deadline", { ascending: true })
    .limit(BATCH);

  if (error) {
    await admin.from("cron_runs").insert({
      job: "passing",
      status: "error",
      error: error.message,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  let confirmed = 0;
  let activated = 0;
  let mailed = 0;
  const failures: string[] = [];

  for (const report of due ?? []) {
    try {
      // 1. Confirm the report.
      await admin
        .from("passing_reports")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", report.id);

      // 2. Stamp deceased_at on the owner profile. Use the date the
      //    reporter gave; fall back to submission date if missing.
      const deceasedDate = report.passed_on
        ? new Date(`${report.passed_on}T00:00:00Z`)
        : new Date(report.submitted_at);
      await admin
        .from("profiles")
        .update({ deceased_at: deceasedDate.toISOString() })
        .eq("id", report.owner_user_id)
        .is("deceased_at", null);

      confirmed += 1;

      // 3. Activate every designated beneficiary.
      const { data: beneficiaries } = await admin
        .from("beneficiaries")
        .select("id, email, claim_token, status")
        .eq("owner_user_id", report.owner_user_id)
        .eq("status", "designated");

      const { data: ownerProfile } = await admin
        .from("profiles")
        .select("oracle_name")
        .eq("id", report.owner_user_id)
        .maybeSingle();
      const ownerName = ownerProfile?.oracle_name ?? "your loved one";

      for (const ben of beneficiaries ?? []) {
        await admin
          .from("beneficiaries")
          .update({
            status: "activated",
            activated_at: new Date().toISOString(),
            notified_at: new Date().toISOString(),
          })
          .eq("id", ben.id);
        activated += 1;

        // 4. Email the beneficiary their claim URL.
        try {
          await sendBeneficiaryActivationEmail({
            to: ben.email,
            ownerName,
            claimUrl: `${origin}/legacy/${ben.claim_token}`,
            ownerUserId: report.owner_user_id,
          });
          mailed += 1;
        } catch (e) {
          failures.push(
            `mail ${ben.id}: ${e instanceof Error ? e.message : "unknown"}`,
          );
        }
      }

      await recordAudit({
        action: "passing_report_confirmed",
        targetUserId: report.owner_user_id,
        targetId: report.id,
        details: { activated_count: beneficiaries?.length ?? 0 },
      });
    } catch (e) {
      failures.push(
        `report ${report.id}: ${e instanceof Error ? e.message : "unknown"}`,
      );
    }
  }

  await admin.from("cron_runs").insert({
    job: "passing",
    status: failures.length ? "error" : "ok",
    error: failures.length ? failures.join(" | ").slice(0, 1000) : null,
    duration_ms: Date.now() - startedAt,
    processed: confirmed,
  });

  return NextResponse.json({
    confirmed,
    activated,
    mailed,
    failures: failures.length,
  });
}
