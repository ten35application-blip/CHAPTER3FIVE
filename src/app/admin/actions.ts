"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";

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
