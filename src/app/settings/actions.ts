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

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Cascade: deleting the auth user removes profile, answers, agreements.
  // We need the service role to delete from auth.users, so for V1 we just
  // delete profile data and sign the user out. A scheduled job can fully
  // purge auth records later. (Document this in the privacy policy too.)
  await supabase.from("profiles").delete().eq("id", user.id);
  await supabase.auth.signOut();
  redirect("/?deleted=true");
}
