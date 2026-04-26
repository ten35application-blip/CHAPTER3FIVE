"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBeneficiaryClaimedNotice, recordAudit } from "@/lib/notifications";

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
        ownerName: ownerProfile.oracle_name ?? "your thirtyfive",
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

  // Redirect to the first shared oracle, or dashboard if none.
  const firstOracleId = oracles?.[0]?.id;
  redirect(firstOracleId ? `/shared/${firstOracleId}` : "/dashboard");
}
