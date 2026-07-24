"use server";

import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/version";
import { isAdmin } from "@/lib/admin/allowlist";

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
      diagnose(error, isAdmin(user.email)),
      error,
    );
  }

  redirect("/dashboard");
}

/**
 * Turn a Supabase/Postgres error into a message the user can act on.
 *
 * Admins (allowlisted emails) get the raw diagnosis — including the
 * Postgres error code and hint — so they can fix schema / RLS issues
 * without tailing Vercel logs. Regular users get a friendly generic
 * fallback that never leaks column names, table names, or RLS hints.
 *
 * The "columns are missing" case is called out specifically because
 * that's the failure mode when migration 0056 hasn't been run — the
 * single most likely reason a fresh install lands here.
 */
function diagnose(
  error: { message?: string; code?: string; details?: string; hint?: string },
  admin: boolean,
): string {
  const msg = error.message ?? "";
  const code = error.code ?? "";

  // 42703 = undefined_column, PGRST204 = PostgREST schema-cache miss on a
  // newly-added column. Both mean: migration 0056 hasn't been applied.
  const missingColumn =
    code === "42703" ||
    code === "PGRST204" ||
    /terms_accepted_at|terms_version_accepted/i.test(msg);

  if (missingColumn) {
    return admin
      ? "Admin: migration 0056 hasn't run against this database. Apply supabase/migrations/0056_terms_acceptance.sql in Supabase Studio, then try again."
      : "We're finishing a small update. Please try again in a few minutes.";
  }

  // 42P01 = undefined_table — profiles is missing entirely (very unlikely,
  // but treat it clearly if it happens).
  if (code === "42P01") {
    return admin
      ? "Admin: the public.profiles table is missing. Apply 0001_initial_schema.sql (and every migration since) before this gate will work."
      : "We're finishing a small update. Please try again in a few minutes.";
  }

  // 42501 = insufficient_privilege — RLS blocked the write. Shouldn't
  // happen under 0001's policies, but if the policies have drifted it will.
  if (code === "42501") {
    return admin
      ? `Admin: RLS blocked the profile upsert. Check the 0001 profiles policies — user is ${error.details ?? "signed in but blocked"}.`
      : "We couldn't save your agreement. Please sign out and back in, then try again.";
  }

  if (admin) {
    const hint = error.hint ? ` Hint: ${error.hint}.` : "";
    return `Admin: profile upsert failed (${code || "no-code"}) — ${msg}.${hint}`;
  }

  return "Something went wrong saving your agreement. Try again in a moment.";
}

/** For people who read the documents and decide not to agree. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
