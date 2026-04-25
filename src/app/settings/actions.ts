"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateLanguage(formData: FormData) {
  const language = String(formData.get("language") ?? "en").trim();
  if (language !== "en" && language !== "es") {
    redirect("/settings?error=Invalid%20language");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { error } = await supabase
    .from("profiles")
    .update({ preferred_language: language })
    .eq("id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?saved=language");
}

export async function updateTextingStyle(formData: FormData) {
  const style = String(formData.get("texting_style") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { error } = await supabase
    .from("profiles")
    .update({ texting_style: style || null })
    .eq("id", user.id);

  if (error) {
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?saved=style");
}

function isoDate(input: string | null | undefined): string {
  if (!input) return "";
  return new Date(input).toISOString().slice(0, 10);
}

function namesMatch(typed: string, actual: string | null | undefined): boolean {
  if (!actual) return false;
  return typed.trim().toLowerCase() === actual.trim().toLowerCase();
}

export async function deleteOracle(formData: FormData) {
  const typedName = String(formData.get("confirm_name") ?? "");
  const typedDate = String(formData.get("confirm_date") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, created_at")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/settings?error=Profile%20not%20found");
  }

  if (!namesMatch(typedName, profile.oracle_name)) {
    redirect(
      "/settings?error=Oracle%20name%20does%20not%20match%20-%20delete%20cancelled",
    );
  }
  if (typedDate !== isoDate(profile.created_at)) {
    redirect(
      "/settings?error=Created%20date%20does%20not%20match%20-%20delete%20cancelled",
    );
  }

  // Wipe answers and reset the profile. Account stays alive so the user can
  // start a new oracle from /onboarding.
  const { error: ansErr } = await supabase
    .from("answers")
    .delete()
    .eq("user_id", user.id);
  if (ansErr) {
    redirect(`/settings?error=${encodeURIComponent(ansErr.message)}`);
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .update({
      oracle_name: null,
      mode: "real",
      texting_style: null,
      onboarding_completed: false,
    })
    .eq("id", user.id);
  if (profErr) {
    redirect(`/settings?error=${encodeURIComponent(profErr.message)}`);
  }

  redirect("/onboarding?notice=oracle-deleted");
}

export async function deleteAccount(formData: FormData) {
  const typedName = String(formData.get("confirm_name") ?? "");
  const typedDate = String(formData.get("confirm_date") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, created_at")
    .eq("id", user.id)
    .single();

  // If the user has no oracle (already deleted it), they confirm with their
  // email instead of an oracle name.
  if (profile?.oracle_name) {
    if (!namesMatch(typedName, profile.oracle_name)) {
      redirect(
        "/settings?error=Oracle%20name%20does%20not%20match%20-%20delete%20cancelled",
      );
    }
  } else {
    if (typedName.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
      redirect(
        "/settings?error=Email%20does%20not%20match%20-%20delete%20cancelled",
      );
    }
  }

  if (typedDate !== isoDate(profile?.created_at)) {
    redirect(
      "/settings?error=Created%20date%20does%20not%20match%20-%20delete%20cancelled",
    );
  }

  // Cascade via FK: deleting profile removes answers, agreements via the
  // schema's on-delete-cascade chains. The auth.users row is left for
  // operational cleanup; RLS prevents any further access without a profile.
  await supabase.from("answers").delete().eq("user_id", user.id);
  await supabase.from("agreements").delete().eq("user_id", user.id);
  await supabase.from("profiles").delete().eq("id", user.id);
  await supabase.auth.signOut();
  redirect("/?deleted=true");
}
