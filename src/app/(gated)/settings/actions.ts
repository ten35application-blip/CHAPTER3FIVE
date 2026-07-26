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
