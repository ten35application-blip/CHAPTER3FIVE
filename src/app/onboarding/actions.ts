"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/version";
import { isAdmin } from "@/lib/admin/allowlist";

/**
 * Record acceptance of the current Terms/EULA/Privacy/Guidelines bundle
 * on the caller's profile row, then let them into the app. The (gated)
 * layout reads terms_version_accepted on every authed page, so this
 * write is the single source of truth for the fast-path gate.
 *
 * Also appends to public.terms_acceptances (0086) — the source of
 * truth for legal disputes. Every re-consent adds a new row rather
 * than overwriting; captures IP + user agent + email so the record
 * has enough context if it ever needs defending. The ledger row
 * survives account deletion (FK is on delete set null, not cascade).
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

  // Write via the admin client — 0087 blocks authenticated-role
  // writes to terms_accepted_at and terms_version_accepted so a
  // mobile client can't PATCH the columns directly and bypass this
  // action. The admin client bypasses the trigger via service_role.
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").upsert({
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

  // Append the ledger row via the admin client (RLS forbids user
  // writes — the record is server-side only so it can't be tampered).
  // Best-effort: a failure here should NOT bounce the user back to
  // /onboarding since the profile column already carries the gate
  // signal. Logged for follow-up.
  try {
    const h = await headers();
    // Vercel: x-forwarded-for = "client-ip, proxy1, proxy2". First
    // entry is the client. Falls back to x-real-ip if the header set
    // is different in another host.
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : (h.get("x-real-ip") ?? null);
    const userAgent = h.get("user-agent");
    // Dedupe against rapid retries: if a row already exists for this
    // user + version in the last 60 seconds, skip the insert so a
    // double-click / refresh doesn't flood the ledger with copies.
    // Genuine re-consent on a NEW version still writes a row because
    // terms_version changes on the version bump.
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await admin
      .from("terms_acceptances")
      .select("id")
      .eq("user_id", user.id)
      .eq("terms_version", CURRENT_TERMS_VERSION)
      .gt("accepted_at", cutoff)
      .limit(1)
      .maybeSingle();
    if (!recent) {
      const { error: ledgerErr } = await admin
        .from("terms_acceptances")
        .insert({
          user_id: user.id,
          user_email: user.email ?? null,
          terms_version: CURRENT_TERMS_VERSION,
          ip_address: ip,
          user_agent: userAgent,
        });
      if (ledgerErr) {
        console.error(
          "[onboarding] terms_acceptances ledger insert failed:",
          ledgerErr,
        );
      }
    }
  } catch (err) {
    console.error("[onboarding] terms_acceptances ledger threw:", err);
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
