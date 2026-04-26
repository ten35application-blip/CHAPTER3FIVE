"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function acceptArchiveInvite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/?error=Missing%20code");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/auth/signin?next=${encodeURIComponent(`/invite/${code}`)}`);
  }

  // Validate the invite via service-role (so we can read regardless of who
  // currently owns the oracle).
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("archive_invites")
    .select("id, oracle_id, inviter_user_id, status")
    .eq("code", code)
    .maybeSingle();

  if (!invite || invite.status !== "pending") {
    redirect(`/invite/${code}?error=Code%20not%20valid`);
  }
  if (invite.inviter_user_id === user.id) {
    redirect(`/invite/${code}?error=You%20can't%20accept%20your%20own%20invite`);
  }

  // Create the grant (admin client bypasses RLS — owner-RLS-write would
  // fail since the recipient isn't the owner).
  const { error: grantErr } = await admin.from("archive_grants").insert({
    oracle_id: invite.oracle_id,
    user_id: user.id,
    granted_by: invite.inviter_user_id,
  });

  if (grantErr) {
    // unique violation == already granted, which is fine
    const e = grantErr as { code?: string; message?: string };
    if (e.code !== "23505") {
      redirect(
        `/invite/${code}?error=${encodeURIComponent(e.message ?? "Could not accept")}`,
      );
    }
  }

  await admin
    .from("archive_invites")
    .update({
      status: "accepted",
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  redirect(`/shared/${invite.oracle_id}`);
}
