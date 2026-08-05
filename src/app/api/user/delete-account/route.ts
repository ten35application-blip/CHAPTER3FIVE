import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * Mobile-callable account-deletion endpoint. Mirrors the
 * deleteAccount server action used by the web /account page —
 * same confirmation gates (typed identity name + account-creation
 * date), same soft-delete + 30-day grace.
 *
 * Apple's account-deletion guideline (5.1.1(v)) requires the
 * deletion flow to live INSIDE the iOS app, not behind a Safari
 * redirect. The mobile settings screen calls this endpoint after
 * a native confirm dialog.
 */

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function isoDate(input: string | null | undefined): string {
  if (!input) return "";
  return new Date(input).toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  let body: { confirm_name?: string; confirm_date?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const typedName = String(body.confirm_name ?? "");
  const typedDate = String(body.confirm_date ?? "").trim();

  // Cookie OR Bearer auth so the Expo client can call this. Without the
  // Bearer branch the mobile "delete account" button 401s forever,
  // functionally failing Apple 5.1.1(v) even though the UI exists.
  // Fable audit 2026-07-28.
  //
  // Uses the SHARED getRequestAuth helper (2026-08-04). The previous
  // version built a token-scoped client, used it to resolve `user`, and
  // then THREW IT AWAY — every query below ran on the cookie client,
  // which has no session on a mobile request. The profile read returned
  // null under RLS, so `profile.oracle_name` was undefined, the
  // confirmation fell through to the email branch while the app sends
  // the identity name, and the route answered 400 "Email does not
  // match" every single time. Account deletion from the phone could
  // not succeed by any input — the exact requirement this file exists
  // to satisfy.
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, created_at")
    .eq("id", user.id)
    .single();

  // Confirmation: identity name (or email if no identity) + creation date.
  if (profile?.oracle_name) {
    if (normalize(typedName) !== normalize(profile.oracle_name)) {
      return NextResponse.json(
        { error: "Name does not match — delete cancelled." },
        { status: 400 },
      );
    }
  } else {
    if (normalize(typedName) !== normalize(user.email ?? "")) {
      return NextResponse.json(
        { error: "Email does not match — delete cancelled." },
        { status: 400 },
      );
    }
  }

  if (typedDate !== isoDate(profile?.created_at)) {
    return NextResponse.json(
      { error: "Created date does not match — delete cancelled." },
      { status: 400 },
    );
  }

  // Soft delete: mark profile + schedule 30-day purge. Same shape
  // as the web action so the cron picks it up identically.
  const now = new Date();
  const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // `.is("deleted_at", null)` so a repeat call can't re-stamp an
  // account that is already deleted. Re-stamping would restart the
  // grace window, and — since the web delete cascades the profile's
  // stamp onto the user's oracles and the restore paths match on it —
  // would desynchronize that pairing and cost them every identity at
  // the next purge. A second call is now a no-op, which is the honest
  // answer to "delete an already-deleted account".
  const admin = createAdminClient();
  const { data: stamped, error } = await admin
    .from("profiles")
    .update({
      deleted_at: now.toISOString(),
      scheduled_purge_at: purgeAt.toISOString(),
    })
    .eq("id", user.id)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Zero rows = already deleted. Still ok:true (the caller's intent is
  // satisfied), but don't write an audit row claiming a purge date that
  // was never stored — the real one was set by the first call.
  if (stamped && stamped.length > 0) {
    await recordAudit({
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      action: "account_soft_deleted_mobile",
      targetUserId: user.id,
      details: { scheduled_purge_at: purgeAt.toISOString() },
    });
  }

  // Sign out the session on the server side; the client will also
  // sign out locally to clear keychain credentials.
  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
