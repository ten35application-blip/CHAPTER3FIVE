import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { fingerprintTraits } from "@/lib/identity/fingerprint";
import {
  distinctiveValuesFromTraits,
  reconcileTraitsToAge,
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
import { randomUUID } from "node:crypto";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB — Vercel body limit is 4.5, promising 5 broke before our code ran
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
 *   1. Validate the upload (JPEG/PNG/GIF/WebP, ≤ 4 MB)
 *   2. Claude Vision analyzes the photo (doubles as the safety gate)
 *   3. Seeded roll — vision overwrites only the look-derived fields
 *   4. Synthesize normally
 *   5. Insert with creation_source='photo'; the uploaded photo IS the
 *      avatar (uploaded to avatars/user-uploaded/{id}.png, service
 *      role, avatar_hash stamped)
 *   6. → { id } — client reveals via the same card as the random path
 *
 * Error copy matches the web action string-for-string.
 *
 * Phase 4 (2026-08-03) — placeholder-fill mode. When the multipart
 * body carries a `placeholder_id` string field, the route flips into
 * "fill the existing photo-companion slot" mode instead of creating
 * a new row:
 *
 *   - Quota gate is SKIPPED: the placeholder row already exists and
 *     the user has already paid for it via subscription; no new slot
 *     is being consumed.
 *   - Ownership is enforced server-side (row.user_id === auth.uid()
 *     AND row.is_photo_placeholder === true). A crafted call naming
 *     someone else's oracle 404s. A call naming an already-filled
 *     row 409s (no double-fill).
 *   - Rather than INSERTing a second row, the synthesized persona
 *     fields (name, traits, fingerprint, persona_prompt, one_line_hook,
 *     significant_events, voice_examples, pet_name, all the trait
 *     detail columns) are written onto the existing row in ONE update,
 *     with is_photo_placeholder flipped to false. Same id survives, so
 *     the chat surface simply re-renders as the live persona.
 *   - The avatar upload path is identical to the create case (same
 *     avatars bucket + hash stamping), just keyed by the existing id.
 *
 * Idempotency-friendly: because the update is gated on
 * is_photo_placeholder = true, a repeat POST after a successful fill
 * lands as a 409 rather than silently re-generating. The caller can
 * treat 409 like success (the row is filled — refresh).
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  // ---- 1a. Read the multipart body up-front so we can inspect
  //          placeholder_id BEFORE spending vision/synthesis + BEFORE
  //          checking the quota (placeholders skip the quota gate).
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return fail("Pick a photo first.");
  }
  const rawPlaceholderId = formData.get("placeholder_id");
  const placeholderId =
    typeof rawPlaceholderId === "string" && rawPlaceholderId.trim().length > 0
      ? rawPlaceholderId.trim()
      : null;

  // Phase-4 placeholder-fill: verify ownership + placeholder state
  // BEFORE spending vision/synthesis. A stale placeholder_id, a
  // non-owned row, or an already-filled row all short-circuit here.
  if (placeholderId) {
    const { data: placeholderRow } = await supabase
      .from("oracles")
      .select("id, user_id, is_photo_placeholder")
      .eq("id", placeholderId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!placeholderRow || placeholderRow.user_id !== user.id) {
      return fail("Couldn't find that identity to update.", 404);
    }
    if (!placeholderRow.is_photo_placeholder) {
      return NextResponse.json(
        {
          error: "This identity has already been created.",
          code: "already_filled",
        },
        { status: 409 },
      );
    }
  } else {
    // ---- 0. Quota gate (create-mode only) — refuse BEFORE paying
    //          for vision/synthesis.
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
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Pick a photo first.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return fail("That photo is over 4 MB. Try a smaller one.");
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
      if (err.kind === "network") {
        // Anthropic call failed (rate limit, timeout, transport).
        // Surface as retryable + include the specific SDK message so
        // the caller can tell us WHICH failure mode (2026-08-04
        // diagnostic pass — remove the (${err.message}) suffix once
        // the ramp bug is fingerprinted).
        return fail(
          `Our image analysis is having a moment. Give it a few seconds and try again.`,
          502,
        );
      }
      if (err.kind === "malformed") {
        // 4xx from Anthropic OR unparseable response. Include the
        // SDK message so we can distinguish schema-rejection from
        // model-outputted-prose. Retrying a 4xx won't help — user
        // needs the info.
        return fail(
          `We couldn't read that photo properly. Try a different image.`,
          502,
        );
      }
    }
    // Unknown non-VisionAnalysisError. Include the underlying message
    // in the response so a user hitting this can actually tell us
    // what's happening (dev-friendly during the ramp; safe to leave
    // because the message text carries no secrets — just JS error
    // strings). Server-side console.error above still fires so Vercel
    // logs correlate.
    const detail = err instanceof Error ? err.message : "unknown";
    return fail(
      `Something went wrong reading the photo (${detail}). Try again in a moment.`,
      500,
    );
  }

  // ---- 3. Seeded roll ----------------------------------------------------
  let traits: Traits | null = null;
  let fingerprint: string | null = null;
  // Roster dedupe — see the web twin.
  const { data: sibRows } = await createAdminClient()
    .from("oracles")
    .select("traits")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const avoidDistinctive = distinctiveValuesFromTraits(
    (sibRows ?? []).map((r) => r.traits),
  );

  for (let attempt = 0; attempt < MAX_FINGERPRINT_REROLLS; attempt++) {
    let candidate: Traits = {
      ...rollTraits({ avoidDistinctive }),
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
    // EVERY age-conditioned gate re-runs against the photo's age — see
    // the web twin's note. Before the fingerprint, so the hash covers
    // what persists.
    candidate = reconcileTraitsToAge(candidate);
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

  // ---- 5. Insert (or fill placeholder) + avatar upload ------------------
  const admin = createAdminClient();
  const personaFields = {
    traits,
    fingerprint,
    name: persona.name,
    one_line_hook: persona.one_line_hook,
    persona_prompt: persona.persona_prompt,
    significant_events: persona.significant_events,
    creation_source: "photo" as const,
    disclosure_pace: traits.disclosurePace ?? null,
    silence_style: traits.silenceStyle ?? null,
    punctuation_habit: traits.punctuationHabit ?? null,
    memory_style: traits.memoryStyle ?? null,
    text_burst_style: traits.textBurstStyle ?? null,
    chronotype: traits.chronotype ?? null,
    voice_examples: persona.voice_examples,
    texting_fluency: traits.textingFluency ?? null,
    pet_name: persona.pet_name ?? null,
  };

  let oracleId: string;
  if (placeholderId) {
    // Placeholder-fill: flip is_photo_placeholder=false and write the
    // synthesized persona onto the existing row in ONE update. The
    // .eq("is_photo_placeholder", true) guard makes this idempotent —
    // a repeat call after a successful fill matches 0 rows and returns
    // "already filled" without generating a second persona from a new
    // vision pass. (The earlier 409 short-circuit handles the common
    // case; this belt covers a concurrent double-tap that raced past
    // the pre-check.)
    // maybeSingle so a concurrent double-tap that raced past the
    // pre-check lands as zero rows (data === null, no error) rather
    // than an ambiguous single-row throw. Zero rows = the other tab
    // filled first; return 409 already_filled, which the mobile
    // client's uploadPlaceholderPhoto handler treats as success.
    // Audit 2026-08-03: was 500 on the race — client rendered
    // "couldn't save" for a request that in fact succeeded.
    const { data: updated, error: updateError } = await admin
      .from("oracles")
      .update({
        ...personaFields,
        is_photo_placeholder: false,
      })
      .eq("id", placeholderId)
      .eq("user_id", user.id)
      .eq("is_photo_placeholder", true)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (updateError) {
      console.error(
        "[api/identity/from-photo] placeholder fill failed:",
        updateError,
      );
      return fail("Couldn't save them. Try again.", 500);
    }
    if (!updated) {
      return NextResponse.json(
        { error: "already_filled", code: "already_filled" },
        { status: 409 },
      );
    }
    oracleId = updated.id as string;
  } else {
    // TOCTOU re-check — see the web twin: the early gate ran before
    // vision + synthesis (~40s); a duplicate request that passed the
    // same gate may have landed since. (The placeholder-fill branch
    // above converts an existing row, so it consumes no quota and
    // needs no re-check.)
    const lateGate = await canCreateOracle(user.id);
    if (!lateGate.ok) {
      return NextResponse.json(
        {
          error:
            "Another identity finished creating just now — you're at your plan's limit.",
          code: "quota_reached",
        },
        { status: 409 },
      );
    }

    const { data: inserted, error: insertError } = await admin
      .from("oracles")
      .insert({
        user_id: user.id,
        ...personaFields,
      })
      .select("id")
      .single();
    if (insertError || !inserted) {
      console.error("[api/identity/from-photo] insert failed:", insertError);
      return fail("Couldn't save them. Try again.", 500);
    }
    oracleId = inserted.id as string;

    // First identity created claims the post-trial Free-tier slot —
    // before the avatar upload, whose soft-failure path returns early.
    // Placeholder-fill mode skips this: the placeholder was created by
    // the auto-populate helper post-subscribe; the free-slot claim
    // doesn't apply to a paid-tier row.
    await claimFreeIdentitySlot(user.id, oracleId);
  }

  // The user's photo IS the avatar — no Replicate for this path.
    // UNGUESSABLE PATH (2026-08-04). This used to be a deterministic key.
  // The `avatars` bucket is PUBLIC — objects are served with no auth at
  // all — so anyone who could compute the key could fetch the image.
  // Same key as the web action: the oracle id, which sits in the address
  // bar at /chat/{oracleId}. On this path the user's photo IS the
  // avatar, so a reconstructed URL returned a photograph of a real
  // person.
  // A random component makes the URL a capability: it works if you were
  // given it, and is not derivable from anything a person might see.
  // Nothing re-derives this key — it is written to oracles.avatar_url
  // once and read from there forever, including by the purge cron.
const storagePath = `user-uploaded/${oracleId}-${randomUUID()}.png`;
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
    return NextResponse.json({ id: oracleId, filled: placeholderId !== null });
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
  // `filled: true` on the placeholder-fill path lets the client tell
  // "the placeholder is now a live persona, refresh the current chat"
  // apart from "brand new identity, navigate to the reveal card".
  return NextResponse.json({ id: oracleId, filled: placeholderId !== null });
}
