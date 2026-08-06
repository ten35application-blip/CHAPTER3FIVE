"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/action-errors";
import { reactivateAccount } from "@/lib/account/reactivate";

/**
 * The web half of the reactivation promise. Auth comes from the
 * cookie session — a soft-deleted user can still sign in (the proxy
 * allowlists /auth and /restore), so by the time this runs we have a
 * verified user id and simply hand it to the shared core.
 */
export async function reactivateMyAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const result = await reactivateAccount(user.id);
  if (!result.ok) {
    redirectWithError(
      "/restore",
      "That didn't go through. Give it a second and tap again — your account is still safe until the date shown.",
      result.error,
    );
  }

  redirect("/dashboard?restored=1");
}
