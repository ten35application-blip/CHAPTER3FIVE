"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const AGREEMENT_VERSION = "2026-04-25";
const REQUIRED_DOCS = ["terms", "privacy", "cookies"] as const;

export async function acceptAgreements(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  for (const doc of REQUIRED_DOCS) {
    const accepted = formData.get(doc) === "on";
    if (!accepted) {
      redirect(`/agreements?error=Please%20accept%20all%20three%20to%20continue`);
    }
  }

  const rows = REQUIRED_DOCS.map((document) => ({
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
