"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { fingerprintTraits } from "@/lib/identity/fingerprint";
import {
  ageFromBirthday,
  rollTraits,
  type Traits,
} from "@/lib/identity/formula";
import { birthdayForPerceivedAge } from "@/lib/identity/photoAge";
import {
  synthesizePersona,
  SynthesisError,
} from "@/lib/identity/synthesize";
import {
  analyzePhotoForIdentity,
  VisionAnalysisError,
  type SupportedImageMediaType,
} from "@/lib/identity/vision";
import { canCreateOracle, claimFreeIdentitySlot } from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FINGERPRINT_REROLLS = 5;

const SUPPORTED_MEDIA_TYPES: readonly SupportedImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const ERROR_PATH = "/identity/from-photo";

/**
 * Photo-to-identity (formula v4) — the $5-tier "blank slot" path.
 *
 *   1. Validate the upload (image/*, ≤ 5 MB).
 *   2. Claude Vision analyzes the photo (doubles as the safety gate).
 *   3. Roll traits normally, then overwrite ONLY the vision-derived
 *      fields (gender, cultural, heightRange, styleAesthetic) and align
 *      the birthday with the perceived age so the persona matches the
 *      face.
 *   4. Synthesize the persona normally.
 *   5. Insert the oracle with creation_source='photo', upload the
 *      ORIGINAL photo as the avatar (no Replicate/Flux for this path —
 *      the user's photo IS the face), and stamp avatar_url/avatar_hash.
 *   6. Reveal via /identity/new?id=… (same card as the random path).
 */
export async function createIdentityFromPhoto(
  formData: FormData,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // ---- 0. Quota gate ----------------------------------------------------
  // Vision analysis + Replicate face-gen is expensive; refuse BEFORE
  // paying for either. Free tier: 1 identity via free_identity_id.
  // Pro: PRICING.totalIdentitiesPerPlan + extra_oracle_credits.
  {
    const gate = await canCreateOracle(user.id);
    if (!gate.ok) {
      if (gate.reason === "upgrade_required") {
        redirect(
          `/upgrade?next=${encodeURIComponent("/identity/from-photo")}&reason=identity`,
        );
      }
      if (gate.reason === "quota_reached") {
        redirectWithError(
          ERROR_PATH,
          `You're at ${gate.currentCount ?? "your"} of ${gate.quota ?? "the"} identities. Add an extra slot from Settings to make another.`,
        );
      }
      redirectWithError(
        ERROR_PATH,
        "Couldn't check your plan. Try again in a moment.",
      );
    }
  }

  // ---- 1. Validate the upload -------------------------------------------
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    redirectWithError(ERROR_PATH, "Pick a photo first.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    redirectWithError(ERROR_PATH, "That photo is over 5 MB. Try a smaller one.");
  }
  const mediaType = file.type as SupportedImageMediaType;
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
    redirectWithError(
      ERROR_PATH,
      "That file type won't work — use a JPEG, PNG, GIF, or WebP.",
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());

  // ---- 2. Vision analysis (also the safety gate) ------------------------
  let vision;
  try {
    vision = await analyzePhotoForIdentity(bytes, mediaType);
  } catch (err) {
    if (err instanceof VisionAnalysisError) {
      if (err.kind === "refusal") {
        redirectWithError(
          ERROR_PATH,
          "We couldn't work with that photo. Try a different one.",
          err,
        );
      }
      if (err.kind === "minor") {
        redirectWithError(
          ERROR_PATH,
          "Photos need to show an adult. chapter3five is 18 and over.",
          err,
        );
      }
      if (err.kind === "not_a_portrait") {
        redirectWithError(
          ERROR_PATH,
          "We couldn't find a clear face in that photo. Try one where the person is front and center.",
          err,
        );
      }
      if (err.kind === "network") {
        // Include SDK message so the user can tell us WHICH failure
        // mode (2026-08-04 diagnostic — dial back once fingerprinted).
        redirectWithError(
          ERROR_PATH,
          `Our image analysis is having a moment (${err.message}). Try again in a few seconds.`,
          err,
        );
      }
      if (err.kind === "malformed") {
        // 4xx from Anthropic OR unparseable JSON. Surface the SDK
        // message so we can distinguish schema-rejection from
        // model-prose. Retry won't help a 4xx.
        redirectWithError(
          ERROR_PATH,
          `We got an odd response reading that photo (${err.message}). Try a different image.`,
          err,
        );
      }
    }
    // Unknown non-VisionAnalysisError — include the JS message so a
    // user hitting this can actually tell us what's happening (safe:
    // the message text carries no secrets, just JS strings). Vercel
    // console.error above still captures the full stack.
    const detail = err instanceof Error ? err.message : "unknown";
    redirectWithError(
      ERROR_PATH,
      `Something went wrong reading the photo (${detail}). Try again in a moment.`,
      err,
    );
  }

  // ---- 3. Seeded roll ----------------------------------------------------
  // Roll everything normally, then overwrite only the vision-derived
  // fields so the rest of the personality stays as random as any other
  // identity — the photo decides the look, not the life.
  let traits: Traits | null = null;
  let fingerprint: string | null = null;
  for (let attempt = 0; attempt < MAX_FINGERPRINT_REROLLS; attempt++) {
    const candidate: Traits = {
      ...rollTraits(),
      gender: vision.gender,
      cultural: vision.cultural,
      heightRange: vision.heightRange,
      styleAesthetic: vision.styleAesthetic,
    };
    candidate.birthday = birthdayForPerceivedAge(
      candidate.birthday,
      vision.perceivedAgeMin,
      vision.perceivedAgeMax,
    );
    // Formula v5 age-gate re-apply: rollExpansion already ran against
    // rollTraits's random pre-photo birthday, so an old-pre-roll +
    // young-photo can survive with addressStyle="hon_sweetheart" on a
    // 28-year-old. Re-enforce the same 55+ gate rollAddressStyle uses,
    // without re-rolling (which would shift the overall probability).
    if (
      candidate.addressStyle === "hon_sweetheart" &&
      ageFromBirthday(candidate.birthday) < 55
    ) {
      candidate.addressStyle = null;
    }
    const candidateFingerprint = fingerprintTraits(candidate);
    const { data: existing } = await supabase
      .from("oracles")
      .select("id")
      .eq("fingerprint", candidateFingerprint)
      .maybeSingle();
    if (!existing) {
      traits = candidate;
      fingerprint = candidateFingerprint;
      break;
    }
  }
  if (!traits || !fingerprint) {
    redirectWithError(
      ERROR_PATH,
      "Couldn't find a fresh identity. Try again in a moment.",
    );
  }

  // ---- 4. Synthesize -----------------------------------------------------
  let persona;
  try {
    persona = await synthesizePersona(traits);
  } catch (err) {
    if (err instanceof SynthesisError && err.kind === "refusal") {
      redirectWithError(
        ERROR_PATH,
        "That combination didn't sit right. Try again.",
        err,
      );
    }
    redirectWithError(
      ERROR_PATH,
      "Couldn't finish meeting them. Try again.",
      err,
    );
  }

  // ---- 5. Insert + avatar upload ----------------------------------------
  // Insert via admin client — 0067 rejects ALL user-role oracle
  // inserts. Also sets creation_source='photo' which the 0091
  // guard blocks on user INSERTs but allows via service_role.
  const admin = createAdminClient();
  const { data: inserted, error: insertError } = await admin
    .from("oracles")
    .insert({
      user_id: user.id,
      traits,
      fingerprint,
      name: persona.name,
      one_line_hook: persona.one_line_hook,
      persona_prompt: persona.persona_prompt,
      significant_events: persona.significant_events,
      creation_source: "photo",
      // Fable humanization (0078) — same rolls the auto path stores.
      disclosure_pace: traits.disclosurePace ?? null,
      silence_style: traits.silenceStyle ?? null,
      punctuation_habit: traits.punctuationHabit ?? null,
      memory_style: traits.memoryStyle ?? null,
      text_burst_style: traits.textBurstStyle ?? null,
      chronotype: traits.chronotype ?? null,
      voice_examples: persona.voice_examples,
      // Formula v5 additions (0094).
      texting_fluency: traits.textingFluency ?? null,
      pet_name: persona.pet_name ?? null,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    redirectWithError(
      ERROR_PATH,
      "Couldn't save them. Try again.",
      insertError,
    );
  }
  const oracleId = inserted.id as string;

  // First identity created claims the post-trial Free-tier slot
  // (profiles.free_identity_id, NULL-only, server-side write). Before
  // the avatar upload — its soft-failure path redirects early.
  await claimFreeIdentitySlot(user.id, oracleId);

  // Uploads go through the service role (bypasses storage RLS — same as
  // generated faces; see 0058/0060 notes). The user's photo IS the
  // avatar: this path never calls Replicate. The `admin` client above
  // is reused.
  const storagePath = `user-uploaded/${oracleId}.png`;
  const { error: uploadError } = await admin.storage
    .from("avatars")
    // Typed-Blob wrap, not the raw Buffer: storage-js routes a Buffer
    // through the manual-body branch, which Next 16's patched fetch
    // UTF-8-corrupts (see settings/actions.ts round-5 note). The Blob's
    // own `type` is what sets the multipart part's mime — the
    // contentType option is ignored on that branch.
    .upload(
      storagePath,
      new Blob([new Uint8Array(bytes)], { type: mediaType }),
      { contentType: mediaType, upsert: true },
    );
  if (uploadError) {
    // The identity exists but has no face — surface a soft failure and
    // let the reveal show the initial-letter avatar; a re-upload flow
    // can attach the photo later.
    console.error("[from-photo] avatar upload failed:", uploadError);
    redirect(`/identity/new?id=${oracleId}`);
  }
  const { data: pub } = admin.storage.from("avatars").getPublicUrl(storagePath);
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  // avatar_hash = SHA-256 of the uploaded bytes. The 0058 partial unique
  // index enforces "no two of the same"; if this exact file already
  // backs another oracle (same photo uploaded twice), fall back to the
  // documented '-collision' suffix rather than stranding the identity.
  let avatarHash = createHash("sha256").update(bytes).digest("hex");
  const { data: clash } = await admin
    .from("oracles")
    .select("id")
    .eq("avatar_hash", avatarHash)
    .neq("id", oracleId)
    .limit(1)
    .maybeSingle();
  if (clash) {
    avatarHash = `${avatarHash}-collision`;
  }

  const { error: updateError } = await admin
    .from("oracles")
    .update({
      avatar_url: publicUrl,
      avatar_hash: avatarHash,
      face_generation_status: "succeeded",
      face_generation_error: null,
    })
    .eq("id", oracleId);
  if (updateError) {
    console.error("[from-photo] avatar stamp failed:", updateError);
  }

  // ---- 6. Reveal ----------------------------------------------------------
  redirect(`/identity/new?id=${oracleId}`);
}

// birthdayForPerceivedAge moved to @/lib/identity/photoAge.ts
// (2026-07-29) so the mobile-facing /api/identity/from-photo route
// shares the exact same age math.
