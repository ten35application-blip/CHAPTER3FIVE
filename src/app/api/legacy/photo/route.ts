import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { createAdminClient } from "@/lib/supabase/admin";

const ACCEPTED_LEGACY_PHOTO_MIMES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_LEGACY_PHOTO_BYTES = 8 * 1024 * 1024;

function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/**
 * POST /api/legacy/photo — mobile twin of the uploadLegacyPhoto()
 * server action. Multipart body with a `photo` part. Processes with
 * sharp (rotate + 1024² attention crop + mozjpeg 85) and uploads to
 * `avatars/legacy/{user_id}/{ts}.jpg` via the service role — same
 * path shape sanitizeLegacySubject validates on save/complete.
 *
 * → { ok: true, url } | { ok: false, error } with the action's copy.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) return fail("Not signed in.", 401);

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  // NO plan gate — the legacy flow is open to every tier.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Pick a photo first.");
  }
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Pick a photo first.");
  }
  if (file.size > MAX_LEGACY_PHOTO_BYTES) {
    return fail("That photo is over 8 MB — try a smaller one.");
  }
  if (!ACCEPTED_LEGACY_PHOTO_MIMES.includes(file.type)) {
    return fail("Use a JPEG, PNG, WebP, or HEIC image.");
  }

  const inputBytes = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    processed = await sharp(inputBytes)
      .rotate()
      .resize(1024, 1024, { fit: "cover", position: "attention" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch (err) {
    console.error("[api/legacy/photo] sharp failed:", err);
    return fail("Couldn't read that image. Try a different one.");
  }

  const admin = createAdminClient();
  const storagePath = `legacy/${user.id}/${Date.now()}.jpg`;
  const { error: uploadError } = await admin.storage
    .from("avatars")
    // Blob wrap forces storage-js's multipart branch — same Next-16
    // fetch note as the web action (legacy/new/actions.ts).
    .upload(
      storagePath,
      new Blob([new Uint8Array(processed)], { type: "image/jpeg" }),
      { contentType: "image/jpeg", upsert: false },
    );
  if (uploadError) {
    console.error("[api/legacy/photo] upload failed:", uploadError);
    return fail("Couldn't save that photo. Try again.", 500);
  }
  const { data: pub } = admin.storage.from("avatars").getPublicUrl(storagePath);
  return NextResponse.json({ ok: true, url: `${pub.publicUrl}?v=${Date.now()}` });
}
