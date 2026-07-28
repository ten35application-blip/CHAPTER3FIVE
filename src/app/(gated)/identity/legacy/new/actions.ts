"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { redirectWithError } from "@/lib/action-errors";
import { isAdmin } from "@/lib/admin/allowlist";
import { getStripe } from "@/lib/stripe";
import { PRICING } from "@/lib/pricing";
import {
  claimFreeIdentitySlot,
  consumeOtherIdentityCreateCredit,
  hasOtherIdentityCreateCredit,
} from "@/lib/subscription";
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
import { recordPendingPaymentOrThrow } from "@/lib/billing/pendingPayment";
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

  // NO plan gate — any signed-in account (Free included) can run the
  // flow (July 2026 flat-fee rework). But completion is mode-priced:
  // self-mode is free, other-mode costs a one-time $5 mint credit
  // (checked below, before synthesis). The recipient still pays $5
  // per code at redemption, unchanged.

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

  // Legacy-flow quota: every account may mint one self-mode + one
  // other-mode legacy identity. The randomize + from-photo paths use
  // the tier quotas (Free 1 / Basic 3 / Pro 5); this cap is legacy-
  // only. Wilson's ask 2026-07-28: "one for themselves and one for a
  // loved one." We count the caller's existing legacy oracles of the
  // same mode -- self clashes with self, other clashes with other --
  // and reject a third of the same kind. Read via user client so RLS
  // scopes to auth.uid().
  // Inherited copies (0111) are is_legacy + owned too, but they were
  // REDEEMED, not minted — they must not eat the mint quota.
  const { data: existingLegacy } = await supabase
    .from("oracles")
    .select("id, legacy_answers")
    .eq("is_legacy", true)
    .is("inherited_at", null)
    .is("deleted_at", null);
  const currentMode = subject.mode ?? "other";
  const sameModeCount = (existingLegacy ?? []).filter((row) => {
    const rowMode =
      (row.legacy_answers as { subject?: { mode?: unknown } } | null)?.subject
        ?.mode;
    // Pre-mode rows count as "other" by convention -- matches the
    // sanitizeSubject / page.tsx hydration defaults.
    const effective = rowMode === "self" ? "self" : "other";
    return effective === currentMode;
  }).length;
  if (sameModeCount >= 1) {
    redirectWithError(
      "/identity/legacy/new",
      currentMode === "self"
        ? "You've already made a legacy identity for yourself. One per account -- edit the existing one from your dashboard."
        : "You've already made a legacy identity for a loved one. One per account -- edit the existing one from your dashboard.",
    );
  }

  // Other-mode mints are PAID — $5 one-time at Finish, enforced HERE,
  // BEFORE synthesis (no burning Anthropic tokens on unpaid runs).
  // Self-mode stays free; the recipient-redeem gate ($5 per code in
  // /identity/inherit) is separate and unchanged. Admins skip the
  // till, as everywhere else. Fail-closed: an unreadable balance
  // reads as no-credit and bounces to checkout rather than minting a
  // free other-mode identity. The credit is CONSUMED after synthesis
  // + insert succeed (post-persist, like every other credit) — a
  // failed weave leaves the credit intact for the retry.
  const usingCreateCredit = currentMode === "other" && !isAdmin(user.email);
  if (usingCreateCredit && !(await hasOtherIdentityCreateCredit(user.id))) {
    const priceId = process.env.STRIPE_PRICE_ID_OTHER_IDENTITY_CREATE;
    if (!priceId) {
      // Same feature-flag posture as the checkout route's 503: the
      // surface ships before the Stripe Price exists. Graceful banner
      // instead of a hard error while Wilson wires the env.
      redirectWithError(
        "/identity/legacy/new",
        "The payment step isn't set up yet — your answers are saved. Check back soon.",
      );
    }

    // Inline checkout-session creation, same shape as the
    // other_identity_create branch in /api/stripe/checkout (a server
    // action can't cleanly proxy its own cookie-authed POST, so the
    // branch is mirrored here: mode=payment, one line item,
    // purchase_kind metadata, pending payments row, redirect to
    // session.url). The webhook grants the credit while they pay;
    // ?paid=1 lands them back on their last question with the
    // "You're paid — finish it" CTA (Wilson's option B).
    const headerList = await headers();
    const host = headerList.get("host") ?? "chapter3five.app";
    const proto = headerList.get("x-forwarded-proto") ?? "https";
    const origin = `${proto}://${host}`;

    let checkoutUrl: string | null = null;
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: user.email ?? undefined,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          user_id: user.id,
          purpose: "other_identity_create",
          purchase_kind: "other_identity_create",
        },
        success_url: `${origin}/identity/legacy/new?paid=1`,
        cancel_url: `${origin}/identity/legacy/new?cancelled=1`,
      });
      // H2 fix: throw on ledger insert failure so the surrounding
      // catch redirects with a graceful "answers are saved -- try
      // again" instead of orphaning the Stripe session. Insert BEFORE
      // assigning checkoutUrl so a ledger failure leaves it null and
      // the fallback error path fires.
      await recordPendingPaymentOrThrow({
        admin: createAdminClient(),
        stripe,
        session,
        row: {
          user_id: user.id,
          amount_cents: PRICING.otherIdentityCreateCents,
          currency: "usd",
          purpose: "other_identity_create",
        },
      });
      checkoutUrl = session.url;
    } catch (err) {
      redirectWithError(
        "/identity/legacy/new",
        "Couldn't open the payment page. Your answers are saved — try again.",
        err,
      );
    }
    if (!checkoutUrl) {
      redirectWithError(
        "/identity/legacy/new",
        "Couldn't open the payment page. Your answers are saved — try again.",
      );
    }
    redirect(checkoutUrl);
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

  // Service-role insert on purpose: protect_oracle_columns (0067+)
  // rejects ALL oracles inserts from PostgREST roles, and the legacy
  // row needs server-only columns (is_legacy, fingerprint) anyway.
  // Ownership is not client-controlled — user_id/created_by come from
  // auth.getUser above and every field was sanitized server-side.
  const { data: inserted, error: insertError } = await createAdminClient()
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

  // Consume the paid mint credit AFTER synthesis + insert succeeded —
  // the credit was paid for a COMPLETED identity, so a failed weave or
  // a lost insert race (23505 above) leaves it intact for the retry.
  // Best-effort, never throws; a double-submit can't consume twice
  // because the fingerprint index collapses the second insert before
  // this line is reached.
  if (usingCreateCredit) {
    await consumeOtherIdentityCreateCredit(user.id);
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
