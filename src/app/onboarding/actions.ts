"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { names } from "@/content/names";

export async function startOnboarding(formData: FormData) {
  const oracleName = String(formData.get("oracle_name") ?? "").trim();
  const mode = String(formData.get("mode") ?? "").trim();
  const language = String(formData.get("language") ?? "en").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const birthdate = String(formData.get("birthdate") ?? "").trim();

  if (!oracleName) {
    redirect("/onboarding?error=Please%20name%20your%20identity");
  }
  if (mode !== "real" && mode !== "randomize" && mode !== "import") {
    redirect("/onboarding?error=Please%20choose%20a%20mode");
  }
  if (language !== "en" && language !== "es") {
    redirect("/onboarding?error=Invalid%20language");
  }

  // Birthday — required for 18+ verification. We self-declared at signup;
  // this is the actual date.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate)) {
    redirect("/onboarding?error=Please%20enter%20your%20birthday");
  }
  const dob = new Date(birthdate + "T00:00:00Z");
  if (isNaN(dob.getTime())) {
    redirect("/onboarding?error=Invalid%20birthday");
  }
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  if (age < 18) {
    redirect(
      "/onboarding?error=chapter3five%20is%2018%2B%20only.%20We%20can%E2%80%99t%20open%20an%20account%20for%20someone%20under%2018.",
    );
  }
  if (age > 120) {
    redirect("/onboarding?error=Please%20double-check%20your%20birthday");
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
    birthdate,
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
