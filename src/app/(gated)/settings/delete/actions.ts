"use server";
import { cancelStripeOnDeletion } from "@/lib/billing/cancelOnDeletion";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/action-errors";
import { sendAccountDeletedEmail } from "@/lib/notifications";

/**
 * Marks the profile soft-deleted (0024 grace-period pattern), soft-deletes
 * all their oracles in the same stroke, signs the user out, and lands
 * them on the "you're out" landing.
 *
 * The contract (matching /account-deleted, the farewell email, and the
 * mobile post-delete alert): a 30-day grace window during which signing
 * back in and tapping Reactivate on /restore brings everything back —
 * profile and the identities that went down with it, matched on this
 * action's shared deleted_at stamp (see lib/account/reactivate.ts).
 * After 30 days the purge cron erases it for real.
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
  // `.is("deleted_at", null)` so a double-submit can't re-stamp an
  // account that is already deleted. This form has no pending-state
  // guard, and re-stamping would move profiles.deleted_at while the
  // oracle cascade below (correctly filtered to rows not yet deleted)
  // leaves the identities on the FIRST stamp. The restore paths match
  // oracles on the profile's stamp, so the two would no longer line
  // up and a paid restore would miss every identity — leaving them on
  // a purge countdown the user just paid to cancel. The mobile and
  // admin delete paths carry the same filter for the same reason.
  // Stop the money first: a deleted account must stop billing (the
  // 30-day purge would otherwise leave Stripe charging a card attached
  // to nothing, forever). Best-effort; failures are audited.
  await cancelStripeOnDeletion(user.id);

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ deleted_at: now })
    .eq("id", user.id)
    .is("deleted_at", null);
  if (profileErr) {
    redirectWithError(
      "/settings/delete",
      "Something went wrong ending the account. Give it a minute and try once more.",
      profileErr,
    );
  }

  // Cascade the delete flag to their oracles so nothing lingers on the
  // dashboard mid-signout.
  //
  // NEVER the concierge. Adrian is a single shared row that happens to
  // be owned by an operator's personal account (is_concierge = true,
  // exactly one row), and every free-tier user talks to that same row.
  // Filtering it out was already the rule in permanentDeleteIdentity
  // and dev/reset-user; this cascade was one of the two that missed it.
  //
  // WHAT THIS FILTER DOES AND DOES NOT DO. It keeps the concierge out
  // of the soft-delete sweep, so it stays visible and stays off the
  // 30-day purge countdown that 0136 introduces. It does NOT save the
  // concierge from an account purge: that path calls
  // auth.admin.deleteUser, and oracles.user_id references auth.users
  // ON DELETE CASCADE, which takes every row the operator owns
  // regardless of this or any other column. The real guard for that
  // lives in api/cron/purge (it refuses to purge an account that owns
  // the concierge); the real FIX is that a shared row should not be
  // owned by a personal account at all.
  await supabase
    .from("oracles")
    .update({ deleted_at: now })
    .eq("user_id", user.id)
    .eq("is_concierge", false)
    .is("deleted_at", null);

  // REVOKE THE INHERIT CODES THIS ACCOUNT MINTED, or the account is
  // never actually deleted.
  //
  // api/cron/purge refuses to purge any account that still holds an
  // unrevoked code — it counts it into codeHoldingOwners and `continue`s
  // — and nothing else ever revokes them. So a father who minted codes
  // and later deleted his account sat in the database FOREVER: messages,
  // archive, photos and email address all retained, while both legal
  // pages promised him that after 30 days "everything is permanently and
  // irreversibly purged." That promise could not be kept.
  //
  // Nobody who PAID loses anything. Redemption is where the $5 is
  // charged, and it produces a fully independent copy — its own
  // legacy_answers, its own persona_prompt, its own photo object, its
  // own messages (verified in production: four separate avatar objects
  // across one archive and its three copies, 0 shared URLs). Revoking
  // only closes codes nobody has redeemed yet, which nobody has paid
  // for. Wilson's rule stands: they paid for the code, it's theirs.
  const { error: revokeSweepErr } = await supabase
    .from("inherit_codes")
    .update({ revoked_at: now })
    .eq("created_by", user.id)
    .is("revoked_at", null);
  if (revokeSweepErr) {
    // Fail CLOSED: an unrevoked-code account is one the purge cron
    // refuses to purge FOREVER, silently breaking the 30-day
    // deletion promise (self-audit 2026-08-25). Better to fail the
    // deletion loudly and let the user retry.
    console.error("[deleteAccount] code revoke failed:", revokeSweepErr);
    redirectWithError(
      "/settings/delete",
      "Couldn't complete deletion just now. Nothing was deleted — try again.",
    );
  }


  // Farewell email — best-effort, non-blocking. Shared sender (also
  // used by the mobile endpoint) so it lands in email_log like every
  // other transactional send instead of bypassing the ledger.
  if (user.email) {
    const to = user.email;
    void sendAccountDeletedEmail({ to, userId: user.id }).catch((err) => {
      console.error("[delete-account] farewell email failed:", err);
    });
  }

  await supabase.auth.signOut();
  redirect("/account-deleted");
}
