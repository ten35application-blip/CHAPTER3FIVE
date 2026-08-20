"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

/**
 * Settings mutations — profile photo + display name.
 *
 * Photo bucket: `profile-avatars` (private, created in 0076). Path
 * convention: `{user_id}/avatar.jpg` — one photo per user, overwritten
 * on each upload. profiles.avatar_url holds the STORAGE PATH, not a
 * public URL. The bucket is private so URLs are signed server-side
 * (1 h TTL) at render time — matches the chat-uploads pattern.
 *
 * ROUND 4 rewrite (2026-07-25): uploadProfilePhoto and removeProfilePhoto
 * now target `useActionState` — signature is `(prevState, formData)` and
 * they return a typed state object. Uploads return the freshly minted
 * signed URL alongside `{ ok: true }` so the client can swap the visible
 * <img> without waiting on the RSC round-trip. The prior three rounds
 * (revalidatePath alone, router.refresh, key={signedUrl}, URL-scoped
 * failedUrl) all assumed the RSC re-render was the source of truth for
 * the fresh photo — this returns it inline instead, decoupling the
 * display from whatever iOS Safari is doing with the client router.
 * updateProfileName stays a plain server function since the name flow
 * never had the revert bug.
 *
 * ROUND 5 (2026-07-25): the REAL bug all along was that the sharp-produced
 * Node Buffer was being passed straight to supabase-js .upload(). storage-js
 * routes a raw Buffer through the "manual body" branch, which sets the
 * body as-is on fetch. Inside a Next 16 server action, Next's patched
 * fetch pipeline UTF-8-decodes that binary body — every byte >= 0x80 gets
 * replaced with U+FFFD (bytes 0xEF 0xBF 0xBD). The stored object was a
 * 3x-inflated blob of replacement chars starting `EF BF BD EF BF BD…`
 * instead of the JPEG SOI `FF D8 FF E0`. Direct proof: curl-ing the
 * signed URL returned 200 + 49137 bytes with 11046 U+FFFD sequences
 * (~67% of the file). The browser can't render it → Safari draws its
 * broken-image "?" glyph → Wilson sees "?" on settings, "W" fallback on
 * the dashboard. The dashboard's chat-uploads photos work because those
 * are Files (from the browser), which go through the FormData branch.
 * The fix: wrap `processed` in a Blob before .upload(). storage-js then
 * routes it through the FormData multipart path (index.mjs L586), which
 * preserves binary end-to-end. Rounds 1-4 all fixed the RENDER side but
 * were serving a corrupt object the whole time.
 */

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_NAME_LENGTH = 100;

// Wilson's rule: jpg/png/webp/heic in, reject others. sharp handles
// jpeg/png/webp natively; heic support depends on the runtime build,
// so we accept the upload and let sharp fail loudly if the platform
// can't decode it (Vercel's runtime includes libheif).
const ACCEPTED_MIME_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/**
 * Typed state for the photo upload action — shaped for useActionState.
 * `signedUrl` is the fresh signed URL for the newly-uploaded object so
 * the client can render it immediately without waiting for the RSC
 * refresh (the failure mode in rounds 1-3). `bytes` and `contentType`
 * are surfaced for the ?debug=1 panel Wilson can screenshot on his phone
 * — they never affect UI in normal operation.
 */
export type PhotoUploadState =
  | { ok: true; signedUrl: string; bytes: number; contentType: string }
  | { ok: false; error: string; bytes?: number; contentType?: string }
  | null;

export type PhotoRemoveState =
  | { ok: true }
  | { ok: false; error: string }
  | null;

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");
  return { supabase, user };
}

/**
 * Upload a new profile photo. Server-side:
 *   1. Validate mime type + size (≤ 8 MB pre-processed).
 *   2. sharp → resize to max 512×512 (cover fit) + re-encode as jpeg
 *      quality 82. Normalizes format, kills EXIF/orientation quirks,
 *      caps bandwidth.
 *   3. Upload the processed bytes to `profile-avatars/{user_id}/avatar.jpg`
 *      with upsert so re-uploads overwrite cleanly.
 *   4. Store the storage path on profiles.avatar_url (the bucket is
 *      private — the render surface signs a URL on demand).
 *   5. Sign a fresh URL and return it inline so the client can render
 *      the new photo without waiting on the RSC round-trip.
 */
export async function uploadProfilePhoto(
  _prevState: PhotoUploadState,
  formData: FormData,
): Promise<PhotoUploadState> {
  const { supabase, user } = await requireUser();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a photo first." };
  }
  const bytes = file.size;
  const contentType = file.type;
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: "That photo is over 8 MB. Try a smaller one.",
      bytes,
      contentType,
    };
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "Use a JPEG, PNG, WebP, or HEIC image.",
      bytes,
      contentType,
    };
  }

  const inputBytes = Buffer.from(await file.arrayBuffer());

  // Process: strip metadata, respect EXIF orientation, cover-fit to a
  // 512×512 square, re-encode as jpeg q82. Sharp's rotate() with no
  // args applies EXIF orientation before resizing so portrait photos
  // don't come out sideways.
  let processed: Buffer;
  try {
    processed = await sharp(inputBytes)
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention" })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.error("[profile-photo] sharp failed:", err);
    return {
      ok: false,
      error: "Couldn't read that image. Try a different photo.",
      bytes,
      contentType,
    };
  }

  const storagePath = `${user.id}/avatar.jpg`;

  // Wrap the Buffer in a Blob so supabase-js goes through the FormData
  // multipart branch (StorageFileApi.uploadOrUpdate). See the round-5
  // note above — Next 16's patched fetch corrupts a raw Buffer body via
  // UTF-8 decode, and the multipart path is the workaround.
  const uploadBody = new Blob([new Uint8Array(processed)], {
    type: "image/jpeg",
  });

  const { error: uploadError } = await supabase.storage
    .from("profile-avatars")
    .upload(storagePath, uploadBody, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (uploadError) {
    console.error("[profile-photo] upload failed:", uploadError);
    return {
      ok: false,
      error: "Couldn't save the photo. Try again.",
      bytes,
      contentType,
    };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: storagePath })
    .eq("id", user.id);
  if (updateError) {
    console.error("[profile-photo] profile update failed:", updateError);
    return {
      ok: false,
      error: "Photo uploaded but couldn't be saved. Try again.",
      bytes,
      contentType,
    };
  }

  // Mint a fresh signed URL for the just-uploaded object. The client
  // uses this to render the new photo IMMEDIATELY, without waiting for
  // the RSC payload to re-arrive — that dependence was the root of the
  // "reverts to original" symptom on iOS Safari across rounds 1-3.
  const { data: signed, error: signError } = await supabase.storage
    .from("profile-avatars")
    .createSignedUrl(storagePath, 60 * 60);
  if (signError || !signed?.signedUrl) {
    console.error("[profile-photo] sign failed:", signError);
    return {
      ok: false,
      error: "Photo saved but preview failed. Refresh to see it.",
      bytes,
      contentType,
    };
  }

  // Still revalidate so other surfaces (dashboard header avatar, etc.)
  // pick up the new photo on their next render.
  revalidatePath("/settings");
  revalidatePath("/dashboard");

  return {
    ok: true,
    signedUrl: signed.signedUrl,
    bytes,
    contentType,
  };
}

/**
 * Clear the profile photo. Best-effort remove from storage first, then
 * null the column — the storage delete failing (e.g. object already
 * gone) shouldn't block the user from resetting to the initial
 * fallback. Adapted to `useActionState` shape in round 4 so the whole
 * photo widget can be one native `<form>` per action.
 */
export async function removeProfilePhoto(
  _prevState: PhotoRemoveState,
  _formData: FormData,
): Promise<PhotoRemoveState> {
  const { supabase, user } = await requireUser();

  const storagePath = `${user.id}/avatar.jpg`;
  const { error: removeError } = await supabase.storage
    .from("profile-avatars")
    .remove([storagePath]);
  if (removeError) {
    // Log and continue — the column clear below is the source of truth
    // for what the app renders.
    console.warn(
      "[profile-photo] storage remove non-fatal:",
      removeError,
    );
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);
  if (updateError) {
    console.error("[profile-photo] profile clear failed:", updateError);
    return { ok: false, error: "Couldn't clear the photo. Try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Save the user's display name. Trimmed + length-capped at 100 chars.
 * Empty string clears the field (returned as null on read). Personas
 * pull this from profiles.full_name at chat-stream time so they can
 * address the user warmly by name.
 *
 * Column-level protection: full_name is NOT on the billing trigger's
 * guarded list (0065/0073), and the profiles-owner UPDATE policy from
 * 0001 restricts writes to the caller's own row — so an authenticated
 * user updating their own name is the standard supported path.
 */
export async function updateProfileName(
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  const trimmed = String(name ?? "").trim();
  if (trimmed.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: `Names top out at ${MAX_NAME_LENGTH} characters.`,
    };
  }

  const value = trimmed.length === 0 ? null : trimmed;

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: value })
    .eq("id", user.id);
  if (error) {
    console.error("[profile-name] update failed:", error);
    return { ok: false, error: "Couldn't save your name. Try again." };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Password reset kickoff. Sends the standard Supabase
 * "recover your account" email to the caller's registered address; the
 * link inside lands on /auth/update-password with a live session that
 * lets the client-side form call updateUser({password}) directly.
 *
 * We DON'T let the caller pass an arbitrary email — the reset always
 * goes to the currently-signed-in user's own email (`auth.users.email`).
 * Prevents a signed-in user from spamming reset emails to strangers.
 *
 * Deliberately reports success even if Supabase returns an error, to
 * avoid leaking whether an account exists — but since we required a
 * signed-in session above, that leak surface is already zero here. We
 * still swallow the error to a generic message so a transient email
 * provider issue doesn't stall the surface.
 */
export async function sendPasswordResetEmail(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const { supabase, user } = await requireUser();
  const email = user.email;
  if (!email) {
    return { ok: false, error: "No email on file for this account." };
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";
  const redirectTo = origin
    ? `${origin}/auth/update-password`
    : "/auth/update-password";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) {
    console.error("[password-reset] resetPasswordForEmail failed:", error);
    return { ok: false, error: "Couldn't send the reset email. Try again." };
  }
  return { ok: true };
}

/**
 * Notification preference — the single opt-out for every message a
 * persona sends you first.
 *
 * `profiles.outreach_enabled` is what all four outreach crons filter
 * on (persona-outreach, proactive, check-in/outreach, anniversaries),
 * so flipping this off stops proactive texts at the source rather than
 * merely suppressing the banner. That's deliberate: in a grief app,
 * "stop contacting me" has to mean the message is never composed, not
 * that it lands silently and ambushes the user in the list later.
 *
 * Mirrored by the mobile Settings toggle (app/settings.tsx) — both
 * surfaces read and write this one column so the preference follows the
 * account, not the device. Device-level OS permission is separate and
 * lives in iOS Settings; this is the account-level intent.
 */
export async function setOutreachEnabled(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("profiles")
    .update({ outreach_enabled: enabled })
    .eq("id", user.id);
  if (error) {
    console.error("[notifications] outreach toggle failed:", error);
    return { ok: false, error: "Couldn't save that. Try again." };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Revoke an inherit code.
 *
 * There was no working revoke anywhere in the product. The only
 * implementation was an admin stub that logged and returned
 * "Revoke recorded (stub)." — meanwhile the beneficiary email
 * (lib/notifications.ts) tells users, in writing, "You can revoke
 * access at any time from Sharing." That screen did not exist.
 *
 * That gap matters more than a normal missing feature. Someone posts a
 * photo of their inherit card to explain the app, or hands one to a
 * person they later fall out with, and there is no way to take it back
 * — and no way to even see that it was used, since 0111 dropped the
 * share ledger.
 *
 * Semantics deliberately match the consumer model documented in 0055:
 * revoking stops NEW redemptions. Copies already redeemed stay with the
 * families that hold them, because taking a dead parent back out of a
 * grieving person's hands is not a thing this product should be able to
 * do — and the copy is theirs, in their account, by design.
 *
 * Scoped by created_by so a caller can only ever revoke their own.
 */
export async function revokeInheritCode(
  oracleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("inherit_codes")
    .update({ revoked_at: new Date().toISOString() })
    .eq("oracle_id", oracleId)
    .eq("created_by", user.id)
    .is("revoked_at", null)
    .select("id");

  if (error) {
    console.error("[inherit] revoke failed:", error);
    return { ok: false, error: "Couldn't revoke that code. Try again." };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "That code is already revoked, or isn't yours to revoke.",
    };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Mint an inherit code for a legacy identity that doesn't have one.
 *
 * Exists because mint is best-effort at creation time and could fail
 * silently: the user paid, answered thirty-plus questions, and landed
 * on a Settings page that looked exactly as though they'd never done
 * it. Three comments in the codebase claimed "the share page offers a
 * retry" — that page is linked from nowhere and was gated behind Pro,
 * which the July 2026 flat-fee rework removed everywhere else. A
 * Free-tier user whose mint failed was redirected to /upgrade.
 *
 * Deliberately NOT plan-gated. The legacy flow is open to every tier;
 * gating the recovery from a failure we caused would be charging
 * someone to fix our bug, on the archive of a person who died.
 *
 * Idempotent and safe to expose: it refuses unless the caller owns the
 * oracle, it is a legacy oracle THEY created (not one they inherited),
 * and it currently has no live code.
 */
export async function retryMintInheritCode(
  oracleId: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  // INHERITED COPIES ARE EXCLUDED — this filter is load-bearing.
  //
  // I reimplemented this action from identity/legacy/[id]/share and
  // dropped `.is("inherited_at", null)`, which that version carries with
  // the comment "a redeemed identity is not the recipient's to mint new
  // codes for."
  //
  // Without it: redeem someone's archive for $5, then call this with
  // your own copy's id. Your copy is is_legacy, owned by you, and has no
  // inherit_codes row (codes belong to the SOURCE oracle) — so every
  // remaining guard passed. You'd get a live code for someone else's
  // dead relative, resellable at $5 a head, that the original family's
  // revoke can never reach because it points at a different oracle. The
  // Settings UI never offers it, but this is a server action imported by
  // a client component, so its id is in the browser bundle and callable
  // with any argument.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, is_legacy")
    .eq("id", oracleId)
    .eq("user_id", user.id)
    .eq("is_legacy", true)
    .is("inherited_at", null)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; is_legacy: boolean | null }>();

  if (!oracle) {
    return { ok: false, error: "That identity isn't one we can make a code for." };
  }

  const { data: existing } = await supabase
    .from("inherit_codes")
    .select("code")
    .eq("oracle_id", oracleId)
    .is("revoked_at", null)
    .maybeSingle<{ code: string }>();
  if (existing?.code) {
    // Someone raced us, or the user tapped twice. Hand back the real one.
    return { ok: true, code: existing.code };
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { mintInheritCode } = await import("@/lib/legacy/mint");
  const code = await mintInheritCode(createAdminClient(), oracleId, user.id);
  if (!code) {
    return {
      ok: false,
      error:
        "We couldn't make a code just now. Try once more — nothing is lost, and your archive is safe.",
    };
  }

  // Same inbox copy the finish flow sends — the retry mint was the
  // one path that still left the code screen-only (ultrareview
  // 2026-08-19). Best-effort.
  if (user.email) {
    try {
      const { sendInheritCodeEmail } = await import("@/lib/notifications");
      const { data: o } = await createAdminClient()
        .from("oracles")
        .select("name, one_line_hook, legacy_answers")
        .eq("id", oracleId)
        .maybeSingle<{
          name: string | null;
          one_line_hook: string | null;
          legacy_answers: { subject?: { mode?: string } } | null;
        }>();
      if (o?.name) {
        sendInheritCodeEmail({
          to: user.email,
          userId: user.id,
          name: o.name,
          hook: o.one_line_hook ?? null,
          code,
          isSelf: o.legacy_answers?.subject?.mode === "self",
        }).catch((err) =>
          console.error("[retry-mint] inherit-code email failed:", err),
        );
      }
    } catch (err) {
      console.error("[retry-mint] inherit-code email setup failed:", err);
    }
  }

  revalidatePath("/settings");
  return { ok: true, code };
}
