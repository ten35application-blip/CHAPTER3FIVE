import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit, sendAccountRestoredEmail } from "@/lib/notifications";

/**
 * Reactivate a soft-deleted account inside its 30-day grace window.
 *
 * THE PROMISE THIS KEEPS. /account-deleted tells the user, in bold:
 * "Sign back in during that window and it reactivates — nothing is
 * lost." The mobile post-delete alert says the same. Until this file,
 * NOTHING implemented it: the web proxy redirected every soft-deleted
 * sign-in to /restore — a page that did not exist, so the promise
 * dead-ended on a 404 — and mobile silently signed the user out onto
 * the landing page. The only real path back was emailing support.
 *
 * Shared core because there are two callers with the same contract:
 * the /restore server action (web, cookie auth) and
 * /api/account/reactivate (phone, Bearer auth).
 *
 * ORDER MATTERS. Oracles first, profile second. If the profile cleared
 * first and the oracle sweep then failed, the user would land on a
 * live account whose identities are all still in the trash on a purge
 * countdown — the exact "restore cost you everything" failure 0136
 * exists to prevent. Failing the other way is safe: the account stays
 * deleted, the user retries, and the already-cleared oracles simply
 * match zero rows the second time.
 *
 * THE STAMP MATCH. deleteAccount cascades the profile's exact
 * deleted_at timestamp onto every oracle it takes down, so
 * `oracles.deleted_at = stamp` selects precisely the identities that
 * went down with the account. An identity the user genuinely deleted
 * on its own earlier keeps its own stamp and its own countdown —
 * reactivating the account does not resurrect it.
 *
 * Admin client throughout: protect_oracle_state deliberately blocks
 * the restore direction (deleted_at timestamp → null) for user-role
 * writes, so this can only run server-side. Auth is the caller's job;
 * both callers only ever pass their own verified user id.
 */
export async function reactivateAccount(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();

  const { data: profile, error: readErr } = await admin
    .from("profiles")
    .select("deleted_at")
    .eq("id", userId)
    .maybeSingle<{ deleted_at: string | null }>();

  if (readErr) {
    console.error("[reactivate] profile read failed:", readErr);
    return { ok: false, error: "read_failed" };
  }
  // Already active — idempotent success, so a double-tap or a stale
  // tab never shows an error for a state the user wants anyway.
  if (!profile?.deleted_at) return { ok: true };

  const stamp = profile.deleted_at;

  const { error: oracleErr } = await admin
    .from("oracles")
    .update({ deleted_at: null, scheduled_purge_at: null })
    .eq("user_id", userId)
    .eq("deleted_at", stamp);
  if (oracleErr) {
    console.error("[reactivate] oracle un-delete failed:", oracleErr);
    return { ok: false, error: "oracle_restore_failed" };
  }

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ deleted_at: null, scheduled_purge_at: null })
    .eq("id", userId);
  if (profileErr) {
    // Oracles are already back but the account is still marked deleted.
    // Retry-safe (the oracle sweep matches zero rows next time), so
    // surface it as an error and let the user tap again.
    console.error("[reactivate] profile un-delete failed:", profileErr);
    return { ok: false, error: "profile_restore_failed" };
  }

  await recordAudit({
    actorUserId: userId,
    action: "account_reactivated",
    targetUserId: userId,
  });

  // The welcome-back receipt. This used to live only on the webhook's
  // restore_account branch — a purchase nothing can mint — so the real
  // (self-serve) reactivation sent nothing. Fire-and-forget.
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    if (authUser?.user?.email) {
      sendAccountRestoredEmail({ to: authUser.user.email, userId }).catch(
        (e) => console.error("restored email failed:", e),
      );
    }
  } catch (e) {
    console.error("restored email lookup failed:", e);
  }

  return { ok: true };
}
