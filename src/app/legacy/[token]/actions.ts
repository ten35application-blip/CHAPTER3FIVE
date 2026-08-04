"use server";

import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Claim an activated beneficiary link.
 *
 * Preconditions checked here (not just on the landing page — a
 * hand-crafted POST shouldn't be able to skip them):
 *   - user is signed in
 *   - beneficiary row exists for this claim_token
 *   - status is 'activated' (the passing cron flipped it) OR
 *     'designated' (pre-mortem invite acceptance — the owner is
 *     still alive but wants this person to accept the invite now)
 *   - not already 'claimed' or 'declined' or 'removed'
 *
 * On success:
 *   - stamps beneficiary.claimed_at, claimed_user_id, status='claimed'
 *   - inserts archive_grants for every is_legacy oracle the owner
 *     built (so the beneficiary can chat with each of them)
 *   - redirects to /dashboard with a welcome banner
 */
export async function claimBeneficiary(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) {
    redirectWithError("/", "That link doesn't open anything.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Preserve the token so signin can bounce back after.
    redirect(`/auth/signin?next=${encodeURIComponent(`/legacy/${token}`)}`);
  }

  const admin = createAdminClient();

  // Atomic claim: only proceed if status is still activated/designated
  // AND not already claimed by someone else. If two beneficiaries
  // click at once (rare) the second gets a friendly "already claimed".
  // EMAIL BINDING (2026-08-04) — mirrors /api/beneficiary/claim. The
  // token alone was a bare bearer credential to a family's memorial
  // archive: anyone signed in who presented it got archive_grants on
  // every legacy oracle the owner built. A forwarded email was enough.
  // The invitation named a specific address; the claimant must be
  // signed in as it.
  const callerEmail = (user.email ?? "").trim().toLowerCase();
  if (!callerEmail) {
    redirectWithError(
      `/legacy/${token}`,
      "Your account has no email address to match this invitation.",
    );
  }

  const { data: claimed, error: claimErr } = await admin
    .from("beneficiaries")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_user_id: user.id,
    })
    .eq("claim_token", token)
    .ilike("email", callerEmail)
    .in("status", ["activated", "designated"])
    .select("id, owner_user_id")
    .maybeSingle<{ id: string; owner_user_id: string }>();

  if (claimErr || !claimed) {
    redirectWithError(
      `/legacy/${token}`,
      "This link is no longer valid, was already claimed, or was sent to a different email address. Sign in with the address the invitation was sent to.",
    );
  }

  // Grant access to every is_legacy oracle the owner built. Chats
  // with formula/photo companions aren't part of the legacy path;
  // only the archives explicitly recorded for inheritance transfer.
  const { data: oracles } = await admin
    .from("oracles")
    .select("id")
    .eq("user_id", claimed.owner_user_id)
    .eq("is_legacy", true)
    .is("deleted_at", null);

  if (oracles?.length) {
    const rows = oracles.map((o) => ({
      oracle_id: o.id,
      user_id: user.id,
      granted_by: claimed.owner_user_id,
    }));
    // Upsert-style: ignore any (oracle, user) pair that already exists
    // in case this beneficiary previously received an archive_invite
    // to the same oracle.
    const { error: grantErr } = await admin
      .from("archive_grants")
      .upsert(rows, { onConflict: "oracle_id,user_id" });
    if (grantErr) {
      console.error("[legacy/claim] archive_grants upsert failed:", grantErr);
      // Don't bounce the user — the beneficiary row is already stamped
      // as claimed. Wilson can manually reconcile from admin.
    }
  }

  redirect("/dashboard?claimed=1");
}
