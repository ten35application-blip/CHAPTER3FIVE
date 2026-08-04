import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { isAdmin } from "@/lib/admin/allowlist";
import { recordPendingPaymentOrThrow } from "@/lib/billing/pendingPayment";
import { SynthesisError } from "@/lib/identity/synthesize";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { fingerprintLegacyAnswers } from "@/lib/legacy/fingerprint";
import { mintInheritCode } from "@/lib/legacy/mint";
import {
  minAnswersForMode,
  sanitizeLegacyAnswers,
  sanitizeLegacySubject,
} from "@/lib/legacy/sanitize";
import {
  synthesizeLegacyPersona,
  type LegacySubject,
} from "@/lib/legacy/synthesize";
import { PRICING } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";
import {
  claimFreeIdentitySlot,
  consumeOtherIdentityCreateCredit,
  hasOtherIdentityCreateCredit,
} from "@/lib/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

// Same synthesis budget as the web page (legacy/new/page.tsx):
// weaving up to 40 answers through Anthropic can run long.
export const maxDuration = 300;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * POST /api/legacy/complete — mobile twin of completeLegacyIdentity()
 * (identity/legacy/new/actions.ts). Body { subject, answers }.
 *
 * Same completion flow, JSON in/out:
 *   1. Auth + terms + sanitize + validate (name, photo, ≥20 answers)
 *   2. Per-mode legacy quota (one self + one other per account)
 *   3. Other-mode $5 mint gate — if unpaid, creates the SAME Stripe
 *      Checkout session the web action does and returns 402
 *      { needs_payment: true, checkout_url } for the client to open
 *      in the browser. The credit is granted by the webhook while
 *      they pay; a retried POST after payment completes the mint.
 *   4. Claude weaves the persona
 *   5. Service-role insert with is_legacy + legacy_answers
 *   6. Mint the inherit code, delete the draft
 *   7. → { oracle_id, inherit_code } (code null if minting failed —
 *      the web share page offers a retry, mobile shows Settings)
 *
 * Every user-facing message matches the web action verbatim.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  let payload: {
    subject?: LegacySubject;
    answers?: Record<string, string>;
  };
  try {
    payload = await request.json();
  } catch {
    return fail("Invalid JSON");
  }

  const subject = sanitizeLegacySubject(
    (payload.subject ?? {}) as LegacySubject,
    user.id,
  );
  const answers = sanitizeLegacyAnswers(payload.answers ?? {});

  if (!subject.name) {
    return fail("Give them their name first — it's on the first page.");
  }
  if (!subject.photoUrl) {
    return fail("Add their photo on the first page — it travels with the code.");
  }
  const minAnswers = minAnswersForMode(subject.mode === "self" ? "self" : "other");
  if (Object.keys(answers).length < minAnswers) {
    return fail(
      `A person takes at least ${minAnswers} answers to hold together. Answer a few more.`,
    );
  }

  // Legacy-flow quota: one self-mode + one other-mode mint per account
  // (Wilson 2026-07-28). Inherited copies (0111) don't count — they
  // were redeemed, not minted. Read via the user client so RLS scopes
  // to auth.uid(), exactly like the web action.
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
    const effective = rowMode === "self" ? "self" : "other";
    return effective === currentMode;
  }).length;
  if (sameModeCount >= 1) {
    return fail(
      currentMode === "self"
        ? "You've already made a legacy identity for yourself. One per account -- edit the existing one from your dashboard."
        : "You've already made a legacy identity for a loved one. One per account -- edit the existing one from your dashboard.",
      409,
    );
  }

  // Other-mode mints are PAID — $5 one-time at Finish, enforced HERE,
  // BEFORE synthesis. Self-mode stays free. Admins skip the till.
  // Fail-closed: an unreadable balance reads as no-credit.
  const usingCreateCredit = currentMode === "other" && !isAdmin(user.email);
  if (usingCreateCredit && !(await hasOtherIdentityCreateCredit(user.id))) {
    const priceId = process.env.STRIPE_PRICE_ID_OTHER_IDENTITY_CREATE;
    if (!priceId) {
      return fail(
        "The payment step isn't set up yet — your answers are saved. Check back soon.",
        503,
      );
    }

    // Same checkout-session shape as the web action. The success URL
    // lands on the web flow with ?paid=1; a mobile user can close the
    // browser and hit Finish again in the app — the credit is on the
    // account either way (the webhook grants it, this route re-checks).
    const host = request.headers.get("host") ?? "chapter3five.app";
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    const origin = `${proto}://${host}`;

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
      if (!session.url) throw new Error("checkout session has no url");
      return NextResponse.json(
        { needs_payment: true, checkout_url: session.url },
        { status: 402 },
      );
    } catch (err) {
      console.error("[api/legacy/complete] checkout failed:", err);
      return fail(
        "Couldn't open the payment page. Your answers are saved — try again.",
        502,
      );
    }
  }

  const fingerprint = fingerprintLegacyAnswers(subject, answers);

  let persona;
  try {
    persona = await synthesizeLegacyPersona(subject, answers);
  } catch (err) {
    console.error("[api/legacy/complete] synthesis failed:", err);
    if (err instanceof SynthesisError && err.kind === "refusal") {
      return fail(
        "Something in the answers didn't sit right. Soften anything graphic and try again.",
        502,
      );
    }
    return fail(
      "Couldn't finish weaving them together. Your answers are saved — try again.",
      502,
    );
  }

  // Service-role insert on purpose — see the web action's note (0067+
  // blocks PostgREST-role inserts; server-only columns).
  // is_self_archive (0125) is stamped true when subject.mode === 'self'
  // so canCreateOracle can exclude the Me row from the plan quota tally
  // (Wilson's Phase-2 lock: "Me is a separate free slot on all tiers").
  const { data: inserted, error: insertError } = await createAdminClient()
    .from("oracles")
    .insert({
      user_id: user.id,
      created_by: user.id,
      is_legacy: true,
      is_self_archive: currentMode === "self",
      legacy_answers: { subject, answers },
      traits: persona.traits,
      fingerprint,
      name: persona.name,
      one_line_hook: persona.one_line_hook,
      persona_prompt: persona.persona_prompt,
      avatar_url: subject.photoUrl,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      return fail(
        "This exact story has already been woven. Check your identities on the dashboard.",
        409,
      );
    }
    console.error("[api/legacy/complete] insert failed:", insertError);
    return fail(
      "Couldn't save them. Your answers are still here — try again.",
      500,
    );
  }

  // Consume the paid mint credit AFTER synthesis + insert succeeded —
  // a failed weave leaves the credit intact for the retry.
  if (usingCreateCredit) {
    await consumeOtherIdentityCreateCredit(user.id);
  }

  await claimFreeIdentitySlot(user.id, inserted.id);

  // Mint. A null is returned to the client as inherit_code: null; the
  // mobile screen must not claim a code "is being minted" — nothing is.
  // Recovery is the ungated retry in web Settings, which detects a
  // codeless legacy archive from state.
  const code = await mintInheritCode(createAdminClient(), inserted.id, user.id);

  // The draft has served its purpose.
  await supabase.from("legacy_drafts").delete().eq("user_id", user.id);

  return NextResponse.json({ oracle_id: inserted.id, inherit_code: code });
}
