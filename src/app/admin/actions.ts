"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import {
  sendBeneficiaryActivationEmail,
  recordAudit,
} from "@/lib/notifications";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    redirect("/");
  }
  return user;
}

export async function resolveCrisisFlag(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!id) redirect("/admin?error=Missing%20id");

  const admin = createAdminClient();
  const { error } = await admin
    .from("crisis_flags")
    .update({ resolved_at: new Date().toISOString(), notes })
    .eq("id", id);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin");
  redirect("/admin?saved=resolved");
}

export async function markUserDeceased(formData: FormData) {
  const me = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) redirect("/admin?error=Missing%20user_id");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("oracle_name, deceased_at")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.deceased_at) {
    redirect(`/admin/user/${userId}?error=Already%20marked%20deceased`);
  }

  const ownerName = profile?.oracle_name?.trim() || "Someone";
  const nowIso = new Date().toISOString();

  await admin
    .from("profiles")
    .update({ deceased_at: nowIso, deceased_confirmed_by: me.id })
    .eq("id", userId);

  // Activate every designated beneficiary and send the activation email.
  const { data: rows } = await admin
    .from("beneficiaries")
    .select("id, email, claim_token")
    .eq("owner_user_id", userId)
    .eq("status", "designated");

  for (const b of rows ?? []) {
    await admin
      .from("beneficiaries")
      .update({ status: "activated", activated_at: nowIso })
      .eq("id", b.id);

    try {
      await sendBeneficiaryActivationEmail({
        to: b.email,
        ownerName,
        claimUrl: `https://chapter3five.app/legacy/${b.claim_token}`,
      });
    } catch (err) {
      console.error("activation email failed:", err);
    }
  }

  await recordAudit({
    actorUserId: me.id,
    actorEmail: me.email ?? null,
    action: "marked_deceased",
    targetUserId: userId,
    details: {
      activated_beneficiaries: rows?.length ?? 0,
    },
  });

  revalidatePath(`/admin/user/${userId}`);
  redirect(`/admin/user/${userId}?saved=deceased`);
}

export async function unmarkUserDeceased(formData: FormData) {
  const me = await requireAdmin();
  const userId = String(formData.get("user_id") ?? "").trim();
  if (!userId) redirect("/admin?error=Missing%20user_id");

  const admin = createAdminClient();

  await admin
    .from("profiles")
    .update({ deceased_at: null, deceased_confirmed_by: null })
    .eq("id", userId);

  // Revert any not-yet-claimed activations back to designated.
  await admin
    .from("beneficiaries")
    .update({ status: "designated", activated_at: null })
    .eq("owner_user_id", userId)
    .eq("status", "activated");

  await recordAudit({
    actorUserId: me.id,
    actorEmail: me.email ?? null,
    action: "unmarked_deceased",
    targetUserId: userId,
  });

  revalidatePath(`/admin/user/${userId}`);
  redirect(`/admin/user/${userId}?saved=undeceased`);
}

export async function resolveMessageReport(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!id) redirect("/admin?error=Missing%20id");

  const admin = createAdminClient();
  const { error } = await admin
    .from("message_reports")
    .update({ resolved_at: new Date().toISOString(), notes })
    .eq("id", id);

  if (error) {
    redirect(`/admin?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/admin");
  redirect("/admin?saved=resolved");
}
