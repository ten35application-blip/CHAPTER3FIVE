"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { createClient } from "@/lib/supabase/server";

/**
 * Profile photo mutations. Bucket: `profile-avatars` (private,
 * created in migration 0076). Path convention: `{user_id}/avatar.jpg`
 * — one photo per user, overwritten on each upload.
 *
 * profiles.avatar_url holds the STORAGE PATH, not a public URL. The
 * bucket is private so URLs are signed server-side (1 h TTL) at
 * render time — matches the chat-uploads pattern.
 */

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

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
 */
export async function uploadProfilePhoto(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, user } = await requireUser();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a photo first." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: "That photo is over 8 MB. Try a smaller one.",
    };
  }
  if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: "Use a JPEG, PNG, WebP, or HEIC image.",
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
    };
  }

  const storagePath = `${user.id}/avatar.jpg`;

  const { error: uploadError } = await supabase.storage
    .from("profile-avatars")
    .upload(storagePath, processed, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (uploadError) {
    console.error("[profile-photo] upload failed:", uploadError);
    return {
      ok: false,
      error: "Couldn't save the photo. Try again.",
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
    };
  }

  revalidatePath("/settings");
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Clear the profile photo. Best-effort remove from storage first, then
 * null the column — the storage delete failing (e.g. object already
 * gone) shouldn't block the user from resetting to the initial
 * fallback.
 */
export async function removeProfilePhoto(): Promise<
  { ok: true } | { ok: false; error: string }
> {
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
  revalidatePath("/settings/profile");
  revalidatePath("/dashboard");
  return { ok: true };
}
