"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendBeneficiaryClaimedNotice,
  sendPassingReportSubmitted,
  recordAudit,
} from "@/lib/notifications";

const VETO_HOURS = 72;

function generatePassingVetoToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

export async function claimLegacy(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect("/?error=Missing%20token");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/signin?next=${encodeURIComponent(`/legacy/${token}`)}`);
  }

  const admin = createAdminClient();
  const { data: ben } = await admin
    .from("beneficiaries")
    .select("id, owner_user_id, status, claimed_user_id")
    .eq("claim_token", token)
    .maybeSingle();

  if (!ben) {
    redirect(`/legacy/${token}?error=Link%20not%20valid`);
  }
  if (ben.status === "claimed" && ben.claimed_user_id !== user.id) {
    redirect(`/legacy/${token}?error=This%20legacy%20has%20already%20been%20claimed`);
  }
  if (ben.status === "designated") {
    redirect(`/legacy/${token}?error=Not%20yet%20active`);
  }
  if (ben.status === "removed" || ben.status === "declined") {
    redirect(`/legacy/${token}?error=Link%20no%20longer%20valid`);
  }

  // Grant access to every oracle the deceased owned.
  const { data: oracles } = await admin
    .from("oracles")
    .select("id")
    .eq("user_id", ben.owner_user_id);

  for (const o of oracles ?? []) {
    const { error } = await admin.from("archive_grants").insert({
      oracle_id: o.id,
      user_id: user.id,
      granted_by: ben.owner_user_id,
    });
    if (error) {
      const e = error as { code?: string };
      // 23505 = already granted, fine.
      if (e.code !== "23505") {
        console.error("legacy grant insert failed:", error);
      }
    }
  }

  await admin
    .from("beneficiaries")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_user_id: user.id,
    })
    .eq("id", ben.id);

  // Tell the owner — only if the owner is still alive (no point notifying
  // a deceased account; the post-mortem activation flow already explained
  // what's happening to whoever's managing the estate).
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("oracle_name, deceased_at")
    .eq("id", ben.owner_user_id)
    .maybeSingle();
  if (ownerProfile && !ownerProfile.deceased_at) {
    const { data: ownerAuth } = await admin.auth.admin.getUserById(
      ben.owner_user_id,
    );
    if (ownerAuth?.user?.email) {
      sendBeneficiaryClaimedNotice({
        to: ownerAuth.user.email,
        beneficiaryEmail: user.email ?? "(no email)",
        ownerName: ownerProfile.oracle_name ?? "your identity",
        ownerUserId: ben.owner_user_id,
      }).catch((e) => console.error("claimed notice failed:", e));
    }
  }

  await recordAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    action: "beneficiary_claimed",
    targetUserId: ben.owner_user_id,
    targetId: ben.id,
  });

  // Redirect to the orientation page on the first shared oracle (or
  // dashboard if for some reason there's nothing to claim). The
  // welcome page sets context — what the archive is, how to chat,
  // how to browse, that conversation is private — before dropping
  // them into the chat itself.
  const firstOracleId = oracles?.[0]?.id;
  redirect(
    firstOracleId ? `/shared/${firstOracleId}/welcome` : "/dashboard",
  );
}

/**
 * Beneficiary submits a "passing report" through their /legacy/[token]/report
 * link. We DO NOT immediately activate beneficiaries. Instead we open a
 * 72-hour veto window and email the owner so they can cancel if the report
 * is wrong. The cron at /api/cron/passing confirms reports past the window.
 */
export async function submitPassingReport(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const reporterName = String(formData.get("reporter_name") ?? "").trim();
  const reporterEmail = String(formData.get("reporter_email") ?? "")
    .trim()
    .toLowerCase();
  const passedOnRaw = String(formData.get("passed_on") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);

  if (!token) redirect("/?error=Missing%20token");
  if (!reporterName)
    redirect(`/legacy/${token}/report?error=Please%20enter%20your%20name`);
  if (!reporterEmail || !reporterEmail.includes("@"))
    redirect(`/legacy/${token}/report?error=Enter%20a%20valid%20email`);
  if (!passedOnRaw)
    redirect(`/legacy/${token}/report?error=Date%20required`);

  // Coerce date and refuse anything in the future.
  const passedDate = new Date(`${passedOnRaw}T00:00:00`);
  if (Number.isNaN(passedDate.getTime()))
    redirect(`/legacy/${token}/report?error=Invalid%20date`);
  if (passedDate.getTime() > Date.now() + 86_400_000)
    redirect(`/legacy/${token}/report?error=Date%20can%27t%20be%20in%20the%20future`);

  const admin = createAdminClient();
  const { data: ben } = await admin
    .from("beneficiaries")
    .select("id, owner_user_id, status")
    .eq("claim_token", token)
    .maybeSingle();

  if (!ben) redirect(`/legacy/${token}?error=Link%20not%20valid`);
  if (ben.status !== "designated") {
    redirect(`/legacy/${token}`);
  }

  // If the owner already has an open pending report, don't duplicate.
  // Just resurface the same status to the reporter and the same email
  // to the owner is already in their inbox.
  const { data: existing } = await admin
    .from("passing_reports")
    .select("id")
    .eq("owner_user_id", ben.owner_user_id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    redirect(`/legacy/${token}?reported=1`);
  }

  // Whoever submitted; null if not signed in (typical case).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const vetoToken = generatePassingVetoToken();
  const submittedAt = new Date();
  const veto_deadline = new Date(
    submittedAt.getTime() + VETO_HOURS * 3_600_000,
  );

  const { data: report, error: insertErr } = await admin
    .from("passing_reports")
    .insert({
      owner_user_id: ben.owner_user_id,
      reporter_email: reporterEmail,
      reporter_name: reporterName || null,
      reporter_user_id: user?.id ?? null,
      beneficiary_id: ben.id,
      passed_on: passedOnRaw,
      notes: notes || null,
      veto_token: vetoToken,
      veto_deadline: veto_deadline.toISOString(),
      submitted_at: submittedAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !report) {
    console.error("passing_report insert failed:", insertErr);
    redirect(
      `/legacy/${token}/report?error=Couldn%27t%20submit%20—%20try%20again`,
    );
  }

  // Email the owner with the one-click veto link.
  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;
  const vetoUrl = `${origin}/passing/cancel/${vetoToken}`;

  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("oracle_name")
    .eq("id", ben.owner_user_id)
    .maybeSingle();
  const { data: ownerAuth } = await admin.auth.admin.getUserById(
    ben.owner_user_id,
  );

  if (ownerAuth?.user?.email) {
    sendPassingReportSubmitted({
      to: ownerAuth.user.email,
      ownerName: ownerProfile?.oracle_name ?? "you",
      reporterEmail,
      reporterName: reporterName || null,
      passedOn: passedOnRaw,
      notes: notes || null,
      vetoUrl,
      deadlineText: veto_deadline.toUTCString(),
      ownerUserId: ben.owner_user_id,
    }).catch((e) => console.error("passing report email failed:", e));
  }

  await recordAudit({
    actorUserId: user?.id ?? null,
    actorEmail: reporterEmail,
    action: "passing_report_submitted",
    targetUserId: ben.owner_user_id,
    targetId: report.id,
    details: { passed_on: passedOnRaw, beneficiary_id: ben.id },
  });

  redirect(`/legacy/${token}?reported=1`);
}
