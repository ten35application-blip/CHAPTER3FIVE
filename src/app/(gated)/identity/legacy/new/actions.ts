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
import { LEGACY_QUESTION_COUNT } from "@/lib/legacy/questions";
import {
  minAnswersForMode,
  sanitizeLegacyAnswers,
  sanitizeLegacySubject,
} from "@/lib/legacy/sanitize";
import {
  synthesizeLegacyPersona,
  type LegacySubject,
} from "@/lib/legacy/synthesize";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifiedAvatarUrl } from "@/lib/storage/avatarObject";
import {
  findReusableCheckout,
  recordPendingPaymentOrThrow,
} from "@/lib/billing/pendingPayment";
import { createClient } from "@/lib/supabase/server";
import { sendInheritCodeEmail } from "@/lib/notifications";
import { randomUUID } from "node:crypto";

// MIN_ANSWERS / sanitizers moved to @/lib/legacy/sanitize.ts
// (2026-07-29) so the mobile-facing /api/legacy/* routes share the
// exact same validation. Local aliases keep the code below verbatim.
// Mode-dependent now — a self-authored archive can hold together on
// fewer answers than one written about someone who can't correct it.
const sanitizeSubject = sanitizeLegacySubject;
const sanitizeAnswers = sanitizeLegacyAnswers;

type DraftPayload = {
  subject: LegacySubject;
  answers: Record<string, string>;
  currentStep: number;
};

const ACCEPTED_LEGACY_PHOTO_MIMES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];
const MAX_LEGACY_PHOTO_BYTES = 4 * 1024 * 1024; // was 8 MB — above Vercel's 4.5 MB body limit, so 4.6-8 MB uploads died at the platform with an unreadable error

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
    return { ok: false, error: "That photo is over 4 MB — try a smaller one." };
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
    // UNGUESSABLE PATH (2026-08-04). This used to be a deterministic key.
  // The `avatars` bucket is PUBLIC — objects are served with no auth at
  // all — so anyone who could compute the key could fetch the image.
  // Same key as the mobile route: {user_id}/{millisecond timestamp},
  // enumerable by anyone holding the user id, returning a photograph of
  // someone's dead relative.
  // A random component makes the URL a capability: it works if you were
  // given it, and is not derivable from anything a person might see.
  // Nothing re-derives this key — it is written to oracles.avatar_url
  // once and read from there forever, including by the purge cron.
const storagePath = `legacy/${user.id}/${randomUUID()}.jpg`;
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

/**
 * Autosave. Upserts the caller's single draft row so they can leave and
 * come back mid-flow. Fire-and-forget from the client — errors are logged
 * server-side but never surface (losing one debounce tick is fine; the next
 * keystroke saves again).
 */
/**
 * Discard the in-progress draft and start the flow fresh in the given
 * mode. Backs the "Start fresh" side of the mode-switch choice screen
 * (page.tsx): a user with 18 answers about their mother who taps
 * "Yourself" must never have her name, photo, and answers silently
 * relabeled as their own self-archive — but a mis-tap must not nuke
 * their work either, so the DELETE only happens behind this explicit
 * form action, never on navigation.
 */
export async function discardLegacyDraft(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const rawMode = String(formData.get("mode") ?? "");
  const mode = rawMode === "self" || rawMode === "other" ? rawMode : "other";

  // 0138: scoped to the mode being restarted. With per-mode drafts
  // this action's only remaining caller is a deliberate "start fresh"
  // on one slot — the other slot's draft is none of its business.
  const { error } = await supabase
    .from("legacy_drafts")
    .delete()
    .eq("user_id", user.id)
    .eq("mode", mode);
  if (error) {
    redirectWithError(
      `/identity/legacy/new?mode=${mode}`,
      "Couldn't clear the old draft. Try again in a moment.",
      error,
    );
  }
  redirect(`/identity/legacy/new?mode=${mode}`);
}

export async function saveLegacyDraft(payload: DraftPayload): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const step = Number.isInteger(payload.currentStep)
    ? Math.max(0, Math.min(LEGACY_QUESTION_COUNT, payload.currentStep))
    : 0;

  // Per-mode rows (0138): the sanitized subject's mode names the row,
  // so a self walk and an other walk autosave side by side.
  const subject = sanitizeSubject(payload.subject, user.id);
  const { error } = await supabase.from("legacy_drafts").upsert(
    {
      user_id: user.id,
      mode: subject.mode === "self" ? "self" : "other",
      subject,
      answers: sanitizeAnswers(payload.answers),
      current_step: step,
    },
    { onConflict: "user_id,mode" },
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

  const subject = sanitizeSubject(payload.subject, user.id);
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
  const minAnswers = minAnswersForMode(
    subject.mode === "self" ? "self" : "other",
  );
  if (Object.keys(answers).length < minAnswers) {
    redirectWithError(
      "/identity/legacy/new",
      `A person takes at least ${minAnswers} answers to hold together. Answer a few more.`,
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
    .eq("user_id", user.id)
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

    // Dedupe against a session already in flight — the credit is
    // granted by the webhook, so a user bounced back before it lands
    // still reads 0 here and would be charged a second $5. Same shape
    // as the redeem gate; see findReusableCheckout.
    const reusableMint = await findReusableCheckout({
      admin: createAdminClient(),
      stripe: getStripe(),
      userId: user.id,
      purpose: "other_identity_create",
    });
    if (reusableMint.kind === "paid_pending_grant") {
      redirectWithError(
        "/identity/legacy/new",
        "Your payment went through — it's being applied right now. Give it a few seconds and hit Finish again. Your answers are saved.",
      );
    }
    if (reusableMint.kind === "open") {
      redirect(reusableMint.url);
    }

    let checkoutUrl: string | null = null;
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        // PA sales-tax collection; Checkout collects the billing address.
        automatic_tax: { enabled: true },
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
  // is_self_archive (0125) is stamped true when subject.mode === 'self'
  // so canCreateOracle can exclude Me from the plan quota tally
  // (Wilson's Phase-2 lock: "Me is a separate free slot on all tiers").
  // Never mint an archive pointing at a photo that isn't there — the
  // upload checks its own error, but cannot see a client that composed
  // the URL itself or an object swept afterwards. A dead link renders
  // as a black square where a person's face belongs (2026-08-22).
  const verifiedPhotoUrl = await verifiedAvatarUrl(
    subject.photoUrl ?? null,
    `legacy/complete(web) user=${user.id}`,
  );

  const { data: inserted, error: insertError } = await createAdminClient()
    .from("oracles")
    .insert({
      user_id: user.id,
      created_by: user.id,
      is_legacy: true,
      is_self_archive: subject.mode === "self",
      legacy_answers: { subject, answers },
      traits: persona.traits,
      fingerprint,
      name: persona.name,
      one_line_hook: persona.one_line_hook,
      persona_prompt: persona.persona_prompt,
      // The photo the creator uploaded at Step 0 becomes the identity's
      // face on redeem. Public URL from `avatars/legacy/...` — matches
      // the shape sanitizeSubject already validated.
      avatar_url: verifiedPhotoUrl,
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
  // THE RETURN VALUE IS LOAD-BEARING (2026-08-04). This used to be
  // fire-and-forget. On failure mintInheritCode returns null, the user
  // was redirected to /settings?minted=<id>, Settings resolved the
  // banner by looking the oracle up among oracles that HAVE a code,
  // found nothing, showed no banner, and rendered the empty-slot
  // placeholder — "When you record someone you love, their code will
  // appear here."
  //
  // So: they paid $5, answered 30+ questions, watched the weaving
  // screen, and landed on a page that behaved exactly as if none of it
  // had happened. No error, no retry, no indication anything was wrong.
  // The oracle existed and they could chat with it themselves; the only
  // thing that failed was the one thing they paid for.
  const mintedCode = await mintInheritCode(
    createAdminClient(),
    inserted.id,
    user.id,
  );

  // The code in their inbox — the mobile twin has sent this since
  // 2026-08-16; the web action (including the paid $5 flow) only
  // showed it in Settings (ultrareview 2026-08-19). Best-effort:
  // a mail failure must never fail a finished forty-five-question
  // sitting.
  if (mintedCode && user.email) {
    sendInheritCodeEmail({
      to: user.email,
      userId: user.id,
      name: persona.name,
      hook: persona.one_line_hook ?? null,
      code: mintedCode,
      isSelf: currentMode === "self",
    }).catch((err) =>
      console.error("[legacy complete] inherit-code email failed:", err),
    );
  }

  // The draft has served its purpose — but ONLY this walk's draft
  // (0138): finishing one slot must never wipe the other slot's
  // work in progress.
  await supabase
    .from("legacy_drafts")
    .delete()
    .eq("user_id", user.id)
    .eq("mode", currentMode);

  // Land in Settings so the freshly-minted code + the native Share
  // button surface in one place. The `?minted=` param triggers a
  // one-time success banner at the top of Settings (Wilson's ask
  // 2026-07-28: "take you back to your settings with your inherit
  // code and the ability to now share the code"). The old /share
  // page still works if someone deep-links to it, but nothing routes
  // there by default anymore.
  // On success, ?minted= fires the celebratory banner. On FAILURE we
  // deliberately send no param: Settings detects a codeless legacy
  // archive from state and renders its own recovery card, which is
  // durable (it still shows next week if they navigate away) where a
  // param is not. An earlier version emitted ?mintfailed=, which
  // nothing read and which MintedBanner's URL scrub didn't clean, so it
  // just sat in the address bar forever.
  redirect(mintedCode ? `/settings?minted=${inserted.id}` : `/settings`);
}
