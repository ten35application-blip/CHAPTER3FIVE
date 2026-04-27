"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { names } from "@/content/names";
import { isAdmin } from "@/lib/admin";

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

  // Mirror the chosen name + mode + language onto the active oracle row.
  // If active_oracle_id is null (e.g. user deleted their previous
  // identity and is back here making a new one), enforce paywall and
  // create the new oracle row before continuing — otherwise the rest
  // of onboarding has nothing to write into and randomize generate
  // will kick back to this same form.
  const { data: profileRow } = await supabase
    .from("profiles")
    .select("active_oracle_id, extra_oracle_credits")
    .eq("id", user.id)
    .single();

  let activeOracleId = profileRow?.active_oracle_id ?? null;

  if (!activeOracleId) {
    // Count includes soft-deleted oracles by design — if you've ever
    // had one, the next requires payment (or admin bypass).
    const { count: oracleCount } = await supabase
      .from("oracles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    const hasAtLeastOne = (oracleCount ?? 0) >= 1;
    const credits = profileRow?.extra_oracle_credits ?? 0;

    if (hasAtLeastOne && credits <= 0 && !isAdmin(user.email)) {
      redirect("/oracle/pay?after=onboard");
    }

    const { data: created, error: createErr } = await supabase
      .from("oracles")
      .insert({
        user_id: user.id,
        name: oracleName,
        mode,
        preferred_language: language,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      redirect(
        `/onboarding?error=${encodeURIComponent(createErr?.message ?? "Could not create identity")}`,
      );
    }
    activeOracleId = created.id;

    const profileUpdates: Record<string, unknown> = {
      active_oracle_id: created.id,
    };
    if (hasAtLeastOne && !isAdmin(user.email)) {
      profileUpdates.extra_oracle_credits = Math.max(0, credits - 1);
    }
    await supabase.from("profiles").update(profileUpdates).eq("id", user.id);
  } else {
    await supabase
      .from("oracles")
      .update({
        name: oracleName,
        mode,
        preferred_language: language,
      })
      .eq("id", activeOracleId)
      .eq("user_id", user.id);
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
