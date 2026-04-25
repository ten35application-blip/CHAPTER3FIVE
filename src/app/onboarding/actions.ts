"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { names } from "@/content/names";

export async function startOnboarding(formData: FormData) {
  const oracleName = String(formData.get("oracle_name") ?? "").trim();
  const mode = String(formData.get("mode") ?? "").trim();
  const language = String(formData.get("language") ?? "en").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (!oracleName) {
    redirect("/onboarding?error=Please%20name%20your%20thirtyfive");
  }
  if (mode !== "real" && mode !== "randomize" && mode !== "import") {
    redirect("/onboarding?error=Please%20choose%20a%20mode");
  }
  if (language !== "en" && language !== "es") {
    redirect("/onboarding?error=Invalid%20language");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const updates: Record<string, string> = {
    oracle_name: oracleName,
    mode,
    preferred_language: language,
  };
  if (timezone) updates.timezone = timezone;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  if (mode === "randomize") {
    redirect("/onboarding/randomize");
  }
  if (mode === "import") {
    redirect("/onboarding/import");
  }
  redirect("/onboarding/questions");
}

export async function suggestRandomName() {
  const pick = names[Math.floor(Math.random() * names.length)];
  redirect(`/onboarding?suggested=${encodeURIComponent(pick)}`);
}
