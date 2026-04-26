"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // Redirect to the first shared oracle, or dashboard if none.
  const firstOracleId = oracles?.[0]?.id;
  redirect(firstOracleId ? `/shared/${firstOracleId}` : "/dashboard");
}
