"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendPassingReportVetoed,
  recordAudit,
} from "@/lib/notifications";

/**
 * Owner clicks the veto link in their "we got a passing report"
 * email. Flips the open report to 'vetoed' and sends the reporter
 * a polite "couldn't verify" note. Knowing only the veto token
 * (a 32-char random string) is itself authorization — no account
 * sign-in required, because the owner may not have access to the
 * device they're signed in on, but they can always check email.
 */
export async function vetoPassingReport(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect("/?error=Missing%20token");

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("passing_reports")
    .select("id, owner_user_id, reporter_email, status")
    .eq("veto_token", token)
    .maybeSingle();

  if (!report) {
    redirect("/passing/cancel/result?state=notfound");
  }
  if (report.status === "vetoed") {
    redirect("/passing/cancel/result?state=already");
  }
  if (report.status === "confirmed") {
    redirect("/passing/cancel/result?state=expired");
  }

  await admin
    .from("passing_reports")
    .update({
      status: "vetoed",
      vetoed_at: new Date().toISOString(),
    })
    .eq("id", report.id);

  // Tell the reporter politely.
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("oracle_name")
    .eq("id", report.owner_user_id)
    .maybeSingle();
  sendPassingReportVetoed({
    to: report.reporter_email,
    ownerName: ownerProfile?.oracle_name ?? "the account holder",
  }).catch((e) => console.error("veto email failed:", e));

  await recordAudit({
    actorUserId: report.owner_user_id,
    actorEmail: null,
    action: "passing_report_vetoed",
    targetUserId: report.owner_user_id,
    targetId: report.id,
  });

  redirect("/passing/cancel/result?state=ok");
}
