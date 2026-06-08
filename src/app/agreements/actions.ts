"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Bumped when the agreements page changes meaningfully. Acceptance
// rows record this version so we know exactly what each user agreed
// to and when. If we change the disclosures, bump this and re-prompt.
const AGREEMENT_VERSION = "2026-04-27";

// Six required acknowledgments + one conditional (memory_mode, only
// when the user picked that mode). Each becomes a row in the
// agreements table tagged with this version.
const REQUIRED_DOCS = [
  "terms",
  "privacy",
  "cookies",
  "ai_processing",
  "age_18plus",
  "not_therapy",
] as const;
const CONDITIONAL_DOCS = ["memory_mode"] as const;

export async function acceptAgreements(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  // Read the user's profile to know which conditional acknowledgments
  // apply (memory-mode users see + must accept the memory disclosure).
  const { data: prof } = await supabase
    .from("profiles")
    .select("mode")
    .eq("id", user.id)
    .single();

  const docs: string[] = [...REQUIRED_DOCS];
  if (prof?.mode === "memory") {
    docs.push(...CONDITIONAL_DOCS);
  }

  for (const doc of docs) {
    const accepted = formData.get(doc) === "on";
    if (!accepted) {
      redirect(
        `/agreements?error=Please%20check%20every%20box%20to%20continue`,
      );
    }
  }

  const rows = docs.map((document) => ({
    user_id: user.id,
    document,
    version: AGREEMENT_VERSION,
  }));

  const { error: agreementError } = await supabase
    .from("agreements")
    .upsert(rows, { onConflict: "user_id,document,version" });

  if (agreementError) {
    redirect(
      `/agreements?error=${encodeURIComponent(agreementError.message)}`,
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("id", user.id);

  if (profileError) {
    redirect(`/agreements?error=${encodeURIComponent(profileError.message)}`);
  }

  redirect("/dashboard");
}
