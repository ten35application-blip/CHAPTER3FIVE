import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
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
import { requireTermsAccepted } from "@/lib/legal/gate";
import { canCreateOracle, claimFreeIdentitySlot } from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FINGERPRINT_REROLLS = 5;

const SUPPORTED_MEDIA_TYPES: readonly SupportedImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Vision + synthesis back-to-back can run long.
export const maxDuration = 300;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/identity/from-photo — mobile twin of the
 * createIdentityFromPhoto() server action. Multipart body with a
 * `photo` part; JSON out. Same six steps as the action:
 *
 *   1. Validate the upload (JPEG/PNG/GIF/WebP, ≤ 5 MB)
 *   2. Claude Vision analyzes the photo (doubles as the safety gate)
 *   3. Seeded roll — vision overwrites only the look-derived fields
 *   4. Synthesize normally
 *   5. Insert with creation_source='photo'; the uploaded photo IS the
 *      avatar (uploaded to avatars/user-uploaded/{id}.png, service
 *      role, avatar_hash stamped)
 *   6. → { id } — client reveals via the same card as the random path
 *
 * Error copy matches the web action string-for-string.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  // ---- 0. Quota gate — refuse BEFORE paying for vision/synthesis ----
  {
    const gate = await canCreateOracle(user.id);
    if (!gate.ok) {
      if (gate.reason === "upgrade_required") {
        return NextResponse.json(
          { error: "upgrade_required", code: "upgrade_required" },
          { status: 402 },
        );
      }
      if (gate.reason === "quota_reached") {
        return NextResponse.json(
          {
            error: `You're at ${gate.currentCount ?? "your"} of ${gate.quota ?? "the"} identities. Add an extra slot from Settings to make another.`,
            code: "quota_reached",
          },
          { status: 409 },
        );
      }
      return fail("Couldn't check your plan. Try again in a moment.", 500);
    }
  }

  // ---- 1. Validate the upload -------------------------------------------
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
  if (file.size > MAX_PHOTO_BYTES) {
    return fail("That photo is over 5 MB. Try a smaller one.");
  }
  const mediaType = file.type as SupportedImageMediaType;
  if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
    return fail("That file type won't work — use a JPEG, PNG, GIF, or WebP.");
  }
  const bytes = Buffer.from(await file.arrayBuffer());

  // ---- 2. Vision analysis (also the safety gate) ------------------------
  let vision;
  try {
    vision = await analyzePhotoForIdentity(bytes, mediaType);
  } catch (err) {
    console.error("[api/identity/from-photo] vision failed:", err);
    if (err instanceof VisionAnalysisError) {
      if (err.kind === "refusal") {
        return fail("We couldn't work with that photo. Try a different one.", 422);
      }
      if (err.kind === "minor") {
        return fail(
          "Photos need to show an adult. chapter3five is 18 and over.",
          422,
        );
      }
      if (err.kind === "not_a_portrait") {
        return fail(
          "We couldn't find a clear face in that photo. Try one where the person is front and center.",
          422,
        );
      }
    }
    return fail(
      "Something went wrong reading the photo. Try again in a moment.",
      500,
    );
  }

  // ---- 3. Seeded roll ----------------------------------------------------
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
    // Formula v5 age-gate re-apply — same 55+ gate rollAddressStyle
    // uses, without re-rolling (see the web action's note).
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
    return fail("Couldn't find a fresh identity. Try again in a moment.", 500);
  }

  // ---- 4. Synthesize -----------------------------------------------------
  let persona;
  try {
    persona = await synthesizePersona(traits);
  } catch (err) {
    console.error("[api/identity/from-photo] synthesis failed:", err);
    if (err instanceof SynthesisError && err.kind === "refusal") {
      return fail("That combination didn't sit right. Try again.", 502);
    }
    return fail("Couldn't finish meeting them. Try again.", 502);
  }

  // ---- 5. Insert + avatar upload ----------------------------------------
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
      disclosure_pace: traits.disclosurePace ?? null,
      silence_style: traits.silenceStyle ?? null,
      punctuation_habit: traits.punctuationHabit ?? null,
      memory_style: traits.memoryStyle ?? null,
      text_burst_style: traits.textBurstStyle ?? null,
      chronotype: traits.chronotype ?? null,
      voice_examples: persona.voice_examples,
      texting_fluency: traits.textingFluency ?? null,
      pet_name: persona.pet_name ?? null,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    console.error("[api/identity/from-photo] insert failed:", insertError);
    return fail("Couldn't save them. Try again.", 500);
  }
  const oracleId = inserted.id as string;

  // First identity created claims the post-trial Free-tier slot —
  // before the avatar upload, whose soft-failure path returns early.
  await claimFreeIdentitySlot(user.id, oracleId);

  // The user's photo IS the avatar — no Replicate for this path.
  const storagePath = `user-uploaded/${oracleId}.png`;
  const { error: uploadError } = await admin.storage
    .from("avatars")
    // Typed-Blob wrap, not the raw Buffer — same Next-16 fetch note as
    // the web action (from-photo/actions.ts).
    .upload(
      storagePath,
      new Blob([new Uint8Array(bytes)], { type: mediaType }),
      { contentType: mediaType, upsert: true },
    );
  if (uploadError) {
    // The identity exists but has no face — soft failure; the reveal
    // shows the initial-letter avatar, exactly like the web path.
    console.error("[api/identity/from-photo] avatar upload failed:", uploadError);
    return NextResponse.json({ id: oracleId });
  }
  const { data: pub } = admin.storage.from("avatars").getPublicUrl(storagePath);
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  // avatar_hash = SHA-256 of the uploaded bytes, '-collision' fallback
  // per the 0058 partial unique index — mirrors the web action.
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
    console.error("[api/identity/from-photo] avatar stamp failed:", updateError);
  }

  // ---- 6. Reveal ----------------------------------------------------------
  return NextResponse.json({ id: oracleId });
}
