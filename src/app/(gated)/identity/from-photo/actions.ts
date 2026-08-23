"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
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
import { canCreateOracle, claimFreeIdentitySlot } from "@/lib/subscription";
import { sendCompanionsReadyEmail } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifiedAvatarUrl } from "@/lib/storage/avatarObject";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4 MB — Vercel body limit is 4.5, promising 5 broke before our code ran
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
 *   1. Validate the upload (image/*, ≤ 4 MB).
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

  // ---- 0. Rights attestation (2026-08-11) -------------------------------
  // The client checkbox is the honest UI half; this is the enforcement
  // half — a server action's id ships in the browser bundle and is
  // callable with any FormData, so the promise must be checked where it
  // can't be skipped. The Guidelines ban impersonating a real living
  // person without permission; this makes every from-photo creation
  // carry an explicit attestation of rights to the photo.
  if (formData.get("photo_rights") !== "on") {
    redirectWithError(
      ERROR_PATH,
      "Please confirm this photo is of you, or of someone who gave you permission.",
    );
  }

  // ---- 1. Validate the upload -------------------------------------------
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    redirectWithError(ERROR_PATH, "Pick a photo first.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    redirectWithError(ERROR_PATH, "That photo is over 4 MB. Try a smaller one.");
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
          `Our image analysis is having a moment. Give it a few seconds and try again.`,
          err,
        );
      }
      if (err.kind === "malformed") {
        // 4xx from Anthropic OR unparseable JSON. Surface the SDK
        // message so we can distinguish schema-rejection from
        // model-prose. Retry won't help a 4xx.
        redirectWithError(
          ERROR_PATH,
          `We couldn't read that photo properly. Try a different image.`,
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
  // Roster dedupe — see identity/new/actions.ts.
  const { data: sibRows } = await createAdminClient()
    .from("oracles")
    .select("traits")
    .eq("user_id", user.id)
    .is("deleted_at", null);
  const avoidDistinctive = distinctiveValuesFromTraits(
    (sibRows ?? []).map((r) => r.traits),
  );

  let traits: Traits | null = null;
  let fingerprint: string | null = null;
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
    // EVERY age-conditioned gate re-runs against the photo's age, not
    // just addressStyle (the old single re-gate). rollTraits gated its
    // rolls on the pre-photo birthday, so an 80-rolled/25-photo persona
    // kept "lost her mother 38 years ago" (a loss predating her birth)
    // and a 26-rolled/78-photo persona kept "With their parents".
    // reconcileTraitsToAge mirrors each roll-time gate exactly and
    // leaves passing values untouched. Runs BEFORE the fingerprint so
    // the fingerprint hashes what actually persists.
    candidate = reconcileTraitsToAge(candidate);
    const candidateFingerprint = fingerprintTraits(candidate);
    // Admin client on purpose — same as the roster-dedupe query above.
    // Under the caller's own token RLS scopes this SELECT to their own
    // oracles, so a fingerprint already taken by ANY other user reads
    // back as free, the first candidate falsely "passes", and the
    // collision only surfaces on the insert, against the
    // oracles_fingerprint_key unique index — which spans the whole
    // table, not one user. On this path that lands AFTER the vision
    // read and the synthesis the person just waited through and paid
    // for, as "Couldn't save them."
    const { data: existing } = await createAdminClient()
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
  // TOCTOU re-check — the early gate ran before vision + synthesis
  // (~40s). A double-tap on "Meet them" (the form has no pending
  // disable) starts a second request that passed the same gate; by
  // now the first may have landed. Milliseconds of window left after
  // this, vs the seconds the duplicates stagger by.
  {
    const lateGate = await canCreateOracle(user.id);
    if (!lateGate.ok) {
      redirectWithError(
        "/dashboard",
        "Another identity finished creating just now — you're at your plan's limit. The one you made should already be on your dashboard.",
      );
    }
  }

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

  // "Your companion is here." — the same arrival email bundle
  // deliveries send, for a single creation (Wilson 2026-08-19: an
  // email when you create an identity). Best-effort: mail trouble
  // never fails a creation someone just paid for.
  if (user.email) {
    sendCompanionsReadyEmail({
      to: user.email,
      userId: user.id,
      companions: [
        { name: persona.name, hook: persona.one_line_hook ?? null },
      ],
    }).catch((err) =>
      console.error("companion-ready email failed:", err),
    );
  }

  // Uploads go through the service role (bypasses storage RLS — same as
  // generated faces; see 0058/0060 notes). The user's photo IS the
  // avatar: this path never calls Replicate. The `admin` client above
  // is reused.
    // UNGUESSABLE PATH (2026-08-04). This used to be a deterministic key.
  // The `avatars` bucket is PUBLIC — objects are served with no auth at
  // all — so anyone who could compute the key could fetch the image.
  // And the key was the oracle id, which sits in the address bar at
  // /chat/{oracleId} every time the user opens that conversation. A
  // screenshot, a shared link, or browser history on a family computer
  // was enough to reconstruct it — and on THIS path the user's photo IS
  // the avatar, so what sat at that URL was a photograph of a real
  // person.
  // A random component makes the URL a capability: it works if you were
  // given it, and is not derivable from anything a person might see.
  // Nothing re-derives this key — it is written to oracles.avatar_url
  // once and read from there forever, including by the purge cron.
const storagePath = `user-uploaded/${oracleId}-${randomUUID()}.png`;
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
  const rawPublicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  // Never stamp a URL whose object isn't really there — the same belt
  // the archive path wears (legacy/complete, legacy/new, updateArchive).
  // The upload above checks its own error, but it cannot see a sweep
  // that lands between the upload and this write, and the failure is
  // silent and permanent: the row keeps a dead link, the public bucket
  // answers 404, and a real person's face renders as a black square —
  // in this row and in every inherited copy that later reads it
  // (avatarObject.ts, 2026-08-22). null falls back to the initial-letter
  // avatar, which reads as "no photo yet" instead of as a hole where a
  // face should be.
  // Imported here rather than at the top of the file so this stays a
  // single contiguous change — the same await-import shape
  // settings/actions.ts and dashboard/actions.ts already use.
  const publicUrl = await verifiedAvatarUrl(
    rawPublicUrl,
    `from-photo oracle=${oracleId}`,
  );

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
