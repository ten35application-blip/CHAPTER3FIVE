"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/action-errors";

/**
 * Marks the profile soft-deleted (0024 grace-period pattern), soft-deletes
 * all their oracles in the same stroke, signs the user out, and lands
 * them on the "you're out" landing.
 *
 * The 30-day grace window exists at the DB level so a genuine "wait no"
 * remains technically recoverable via admin — but the UX presents this
 * as final. That's the contract we advertised on the confirmation page.
 *
 * The hard purge happens later via a scheduled sweep (out of scope for
 * this action); until then a re-sign-in with the same email during the
 * 30 days would find profiles.deleted_at set and be treated as deleted.
 */
export async function deleteAccount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const typed = String(formData.get("email_confirmation") ?? "").trim().toLowerCase();
  const actual = (user.email ?? "").trim().toLowerCase();
  if (!typed || typed !== actual) {
    redirectWithError(
      "/settings/delete",
      "That doesn't match the email on this account. Try again — or hit back to leave everything alone.",
    );
  }

  const now = new Date().toISOString();

  // Mark the profile deleted (grace-period flag). RLS allows this via
  // the "users can update their own profile" policy from 0001.
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ deleted_at: now })
    .eq("id", user.id);
  if (profileErr) {
    redirectWithError(
      "/settings/delete",
      "Something went wrong ending the account. Give it a minute and try once more.",
      profileErr,
    );
  }

  // Cascade the delete flag to their oracles so nothing lingers on the
  // dashboard mid-signout.
  await supabase
    .from("oracles")
    .update({ deleted_at: now })
    .eq("user_id", user.id)
    .is("deleted_at", null);

  await supabase.auth.signOut();
  redirect("/account-deleted");
}
