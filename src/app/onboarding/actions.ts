"use server";

import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/version";

/**
 * Record acceptance of the current Terms/Privacy/Guidelines bundle on
 * the caller's profile row, then let them into the app. The (gated)
 * layout reads terms_version_accepted on every authed page, so this
 * write is the single source of truth for the gate.
 */
export async function acceptTerms(formData: FormData) {
  // Belt-and-suspenders: the checkbox is required client-side, but a
  // hand-crafted POST shouldn't be able to skip it.
  if (!formData.get("agree")) {
    redirectWithError(
      "/onboarding",
      "Please confirm you've read and agree before continuing.",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // Upsert so a missing profile row (trigger hiccup) can't strand the
  // user here. RLS from 0001 allows insert/update of your own row.
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    terms_accepted_at: new Date().toISOString(),
    terms_version_accepted: CURRENT_TERMS_VERSION,
  });

  if (error) {
    redirectWithError(
      "/onboarding",
      "Something went wrong saving your agreement. Try again in a moment.",
      error,
    );
  }

  redirect("/dashboard");
}

/** For people who read the documents and decide not to agree. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
