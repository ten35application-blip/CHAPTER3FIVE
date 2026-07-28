"use server";

import { redirect } from "next/navigation";
import sharp from "sharp";
import { redirectWithError } from "@/lib/action-errors";
import { claimFreeIdentitySlot } from "@/lib/subscription";
import { SynthesisError } from "@/lib/identity/synthesize";
import { fingerprintLegacyAnswers } from "@/lib/legacy/fingerprint";
import { mintInheritCode } from "@/lib/legacy/mint";
import {
  LEGACY_QUESTION_COUNT,
  LEGACY_QUESTIONS,
} from "@/lib/legacy/questions";
import {
  synthesizeLegacyPersona,
  type LegacySubject,
} from "@/lib/legacy/synthesize";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Enough answers to weave a real person from — half the bank. */
const MIN_ANSWERS = 20;
const MAX_ANSWER_CHARS = 4000;
const MAX_SUBJECT_FIELD_CHARS = 200;

const KNOWN_QUESTION_IDS = new Set(LEGACY_QUESTIONS.map((q) => q.id));

type DraftPayload = {
  subject: LegacySubject;
  answers: Record<string, string>;
  currentStep: number;
};

function sanitizeSubject(subject: LegacySubject): LegacySubject {
  const clean = (v: unknown) =>
    typeof v === "string" ? v.trim().slice(0, MAX_SUBJECT_FIELD_CHARS) : "";
  // photoUrl must be a URL we actually minted from Supabase Storage —
  // trust nothing that came off the client. If it doesn't match the
  // shape supabase-storage/…/avatars/legacy/… we drop it so a malicious
  // client can't inject an arbitrary URL into the oracle's avatar_url.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const raw = typeof subject?.photoUrl === "string" ? subject.photoUrl : "";
  const photoUrl =
    supabaseUrl &&
    raw.startsWith(`${supabaseUrl}/storage/v1/object/public/avatars/legacy/`)
      ? raw
      : undefined;
  // Mode: enum-narrow to the two allowed strings; anything else
  // (including undefined from pre-mode drafts) falls back to "other"
  // so old drafts keep working after this rollout.
  const modeRaw = subject?.mode;
  const mode: "self" | "other" =
    modeRaw === "self" || modeRaw === "other" ? modeRaw : "other";
  return {
    name: clean(subject?.name),
    // In self mode we drop the relationship field from the UI and
    // never trust whatever might have been sitting in a stale draft.
    relationship: mode === "self" ? "" : clean(subject?.relationship),
    era: clean(subject?.era),
    heritage: clean(subject?.heritage),
    mode,
    ...(photoUrl ? { photoUrl } : {}),
  };
}

const ACCEPTED_LEGACY_PHOTO_MIMES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_LEGACY_PHOTO_BYTES = 8 * 1024 * 1024;

/**
 * Step-0 photo upload for the legacy flow. The creator must pick a
 * photo BEFORE answering any questions — that photo IS the identity's
 * face and travels with the inherit code so whoever redeems it sees
 * the same person.
 *
 * Uploads to `avatars/legacy/{user_id}/{ts}.jpg` via the admin client
 * (storage RLS on `avatars` doesn't allow direct user writes; same
 * pattern as identity/from-photo). Returns the public URL, which the
 * client saves on subject.photoUrl → autosaved into the draft.
 *
 * On completion, that URL becomes oracles.avatar_url as-is.
 */
export async function uploadLegacyPhoto(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // NO plan gate — the legacy flow is open to every tier (July 2026
  // flat-fee rework), so the auth check above is the whole gate.

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick a photo first." };
  }
  if (file.size > MAX_LEGACY_PHOTO_BYTES) {
    return { ok: false, error: "That photo is over 8 MB — try a smaller one." };
  }
  if (!ACCEPTED_LEGACY_PHOTO_MIMES.includes(file.type)) {
    return { ok: false, error: "Use a JPEG, PNG, WebP, or HEIC image." };
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
    console.error("[legacy-photo] sharp failed:", err);
    return { ok: false, error: "Couldn't read that image. Try a different one." };
  }

  const admin = createAdminClient();
  const storagePath = `legacy/${user.id}/${Date.now()}.jpg`;
  const { error: uploadError } = await admin.storage
    .from("avatars")
    // Blob wrap forces storage-js's multipart branch — Next 16's patched
    // fetch corrupts raw Buffer bodies. Same fix as 0078-era
    // profile-avatars upload (e2911d4). The Blob MUST carry its own
    // `type`: in the multipart branch storage-js ignores the
    // `contentType` option and the part's mime comes from the Blob, so
    // a typeless Blob arrives as application/octet-stream and the
    // avatars bucket's allowed-mime list rejects it.
    .upload(
      storagePath,
      new Blob([new Uint8Array(processed)], { type: "image/jpeg" }),
      { contentType: "image/jpeg", upsert: false },
    );
  if (uploadError) {
    console.error("[legacy-photo] upload failed:", uploadError);
    return { ok: false, error: "Couldn't save that photo. Try again." };
  }
  const { data: pub } = admin.storage
    .from("avatars")
    .getPublicUrl(storagePath);
  return { ok: true, url: `${pub.publicUrl}?v=${Date.now()}` };
}

function sanitizeAnswers(
  answers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(answers ?? {})) {
    if (!KNOWN_QUESTION_IDS.has(id)) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, MAX_ANSWER_CHARS);
    if (trimmed.length > 0) out[id] = trimmed;
  }
  return out;
}

/**
 * Autosave. Upserts the caller's single draft row so they can leave and
 * come back mid-flow. Fire-and-forget from the client — errors are logged
 * server-side but never surface (losing one debounce tick is fine; the next
 * keystroke saves again).
 */
export async function saveLegacyDraft(payload: DraftPayload): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const step = Number.isInteger(payload.currentStep)
    ? Math.max(0, Math.min(LEGACY_QUESTION_COUNT, payload.currentStep))
    : 0;

  const { error } = await supabase.from("legacy_drafts").upsert(
    {
      user_id: user.id,
      subject: sanitizeSubject(payload.subject),
      answers: sanitizeAnswers(payload.answers),
      current_step: step,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[saveLegacyDraft] upsert failed", error);
  }
}

/**
 * The completion flow:
 *   1. Auth gate + sanitize + validate (name, enough answers)
 *   2. Fingerprint the source material (SHA-256 of subject + answers)
 *   3. Claude weaves the persona (name, hook, persona_prompt, traits)
 *   4. Insert into oracles with is_legacy = true + legacy_answers
 *   5. Mint an inherit code (best-effort — share page can retry)
 *   6. Delete the draft, redirect to the share moment
 */
export async function completeLegacyIdentity(payload: {
  subject: LegacySubject;
  answers: Record<string, string>;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // NO plan gate — any signed-in account (Free included) can complete
  // the flow and mint an inherit code (July 2026 flat-fee rework).
  // The recipient pays $5 per code at redemption instead.

  const subject = sanitizeSubject(payload.subject);
  const answers = sanitizeAnswers(payload.answers);

  if (!subject.name) {
    redirectWithError(
      "/identity/legacy/new",
      "Give them their name first — it's on the first page.",
    );
  }
  if (!subject.photoUrl) {
    redirectWithError(
      "/identity/legacy/new",
      "Add their photo on the first page — it travels with the code.",
    );
  }
  if (Object.keys(answers).length < MIN_ANSWERS) {
    redirectWithError(
      "/identity/legacy/new",
      `A person takes at least ${MIN_ANSWERS} answers to hold together. Answer a few more.`,
    );
  }

  const fingerprint = fingerprintLegacyAnswers(subject, answers);

  let persona;
  try {
    persona = await synthesizeLegacyPersona(subject, answers);
  } catch (err) {
    if (err instanceof SynthesisError && err.kind === "refusal") {
      redirectWithError(
        "/identity/legacy/new",
        "Something in the answers didn't sit right. Soften anything graphic and try again.",
        err,
      );
    }
    redirectWithError(
      "/identity/legacy/new",
      "Couldn't finish weaving them together. Your answers are saved — try again.",
      err,
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("oracles")
    .insert({
      user_id: user.id,
      created_by: user.id,
      is_legacy: true,
      legacy_answers: { subject, answers },
      traits: persona.traits,
      fingerprint,
      name: persona.name,
      one_line_hook: persona.one_line_hook,
      persona_prompt: persona.persona_prompt,
      // The photo the creator uploaded at Step 0 becomes the identity's
      // face on redeem. Public URL from `avatars/legacy/...` — matches
      // the shape sanitizeSubject already validated.
      avatar_url: subject.photoUrl,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      // fingerprint unique index — this exact set of answers already exists
      redirectWithError(
        "/identity/legacy/new",
        "This exact story has already been woven. Check your identities on the dashboard.",
        insertError,
      );
    }
    redirectWithError(
      "/identity/legacy/new",
      "Couldn't save them. Your answers are still here — try again.",
      insertError,
    );
  }

  // First identity created claims the post-trial Free-tier slot
  // (profiles.free_identity_id, NULL-only, server-side write).
  await claimFreeIdentitySlot(user.id, inserted.id);

  // Best-effort: if minting somehow fails, the share page offers a retry.
  // Service-role client on purpose: 0065 dropped the user-side insert
  // policy on inherit_codes, so the paid-gated actions are the only way
  // a code comes to exist. We just inserted this oracle for user.id, so
  // ownership is already established.
  await mintInheritCode(createAdminClient(), inserted.id, user.id);

  // The draft has served its purpose.
  await supabase.from("legacy_drafts").delete().eq("user_id", user.id);

  // Land in Settings so the freshly-minted code + the native Share
  // button surface in one place. The `?minted=` param triggers a
  // one-time success banner at the top of Settings (Wilson's ask
  // 2026-07-28: "take you back to your settings with your inherit
  // code and the ability to now share the code"). The old /share
  // page still works if someone deep-links to it, but nothing routes
  // there by default anymore.
  redirect(`/settings?minted=${inserted.id}`);
}
