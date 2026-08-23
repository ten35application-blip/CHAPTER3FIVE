import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import {
  recordRedeemAttempt,
  REDEEM_RATE_LIMIT_MESSAGE,
  tooManyRedeemAttempts,
} from "@/lib/legacy/redeemLimit";
import { isAdmin } from "@/lib/admin/allowlist";
import {
  isInheritCodeShaped,
  normalizeInheritCode,
} from "@/lib/legacy/code-format";
import { PRICING } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { avatarsObjectPath } from "@/lib/storage/avatarObject";
import { sendInheritRedeemedEmail } from "@/lib/notifications";
import {
  findReusableCheckout,
  recordPendingPaymentOrThrow,
} from "@/lib/billing/pendingPayment";
import {
  reserveInheritedSlotCredit,
  refundInheritedSlotCredit,
} from "@/lib/subscription";

export const runtime = "nodejs";

/**
 * Bearer-authed twin of the web `redeemInheritCode` server action
 * (`src/app/(gated)/identity/inherit/actions.ts`). Same logic — copies
 * the source oracle into the recipient's account, gates on a $5
 * inherit-slot credit, mints a Stripe checkout if the caller is short,
 * consumes the credit only after the copy persists.
 *
 * Response shapes:
 *   200 { oracle_id }                — new copy landed; open the chat
 *   200 { already, oracle_id }       — same person already inherited
 *   402 { needs_payment, checkout_url } — no credit; buy first
 *   400 { error }                    — bad code shape
 *   404 { error }                    — unknown / revoked / deleted code
 *   401 { error }                    — not signed in
 *   500 { error }                    — insert/storage error
 */

const INVALID_CODE_MESSAGE =
  "That code didn't open anything. Check it letter by letter and try again.";

function copyFingerprint(
  sourceFingerprint: string,
  recipientId: string,
): string {
  return createHash("sha256")
    .update(`inherited:${sourceFingerprint}:${recipientId}`)
    .digest("hex");
}


export async function POST(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Rate limit BEFORE any lookup (migration 0131). The endpoint reveals
  // validity before payment — 404 for a bad code, 402-with-checkout for
  // a good one — so unlimited probing is enumeration of every family's
  // archive. Checked ahead of the shape test so malformed spam counts
  // too.
  if (await tooManyRedeemAttempts(user.id)) {
    return NextResponse.json(
      { error: REDEEM_RATE_LIMIT_MESSAGE },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({} as { code?: unknown }));
  const rawCode = typeof body.code === "string" ? body.code : "";
  const code = normalizeInheritCode(rawCode);
  if (!isInheritCodeShaped(code)) {
    await recordRedeemAttempt(user.id, false);
    return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: codeRow, error: lookupError } = await admin
    .from("inherit_codes")
    .select("id, oracle_id, revoked_at")
    .eq("code", code)
    .maybeSingle();
  if (lookupError) {
    return NextResponse.json(
      { error: "Something went wrong. Try again in a moment." },
      { status: 500 },
    );
  }
  if (!codeRow) {
    await recordRedeemAttempt(user.id, false);
    return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 404 });
  }
  // Honest revoked-code copy, distinct from the vague invalid message —
  // see the web twin: this branch only fires on a code that MATCHES a
  // real row, so nothing is revealed to an enumerator, only the truth
  // to the person the code was given to.
  if (codeRow.revoked_at) {
    await recordRedeemAttempt(user.id, false);
    return NextResponse.json(
      {
        error:
          "The person who made this code has turned it off, so it can't open the archive anymore. The archive itself is safe. If this is a surprise, reach out to them.",
      },
      { status: 410 },
    );
  }

  const { data: source } = await admin
    .from("oracles")
    .select(
      "id, user_id, deleted_at, name, one_line_hook, persona_prompt, traits, legacy_answers, avatar_url, preferred_language, fingerprint",
    )
    .eq("id", codeRow.oracle_id)
    .maybeSingle();
  // Only a MISSING source rejects — a soft-deleted source stays
  // redeemable. Revocation is the one kill switch for a code; deletion
  // never is. See the web twin for the full reasoning; the purge cron
  // guards guarantee a code-bearing source survives until revoked.
  if (!source) {
    await recordRedeemAttempt(user.id, false);
    return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 404 });
  }
  await recordRedeemAttempt(user.id, true);

  // Creator redeeming their own code: no-op, no charge.
  if (source.user_id === user.id) {
    return NextResponse.json({ already: true, oracle_id: source.id });
  }

  // Already redeemed? Same person via same or re-minted code.
  const expectedFingerprint = source.fingerprint
    ? copyFingerprint(source.fingerprint as string, user.id)
    : null;
  const priorFilters = expectedFingerprint
    ? `inherited_from_code_id.eq.${codeRow.id},fingerprint.eq.${expectedFingerprint}`
    : `inherited_from_code_id.eq.${codeRow.id}`;
  // NO deleted_at filter — see the web twin (identity/inherit/actions.ts):
  // the fingerprint unique index doesn't exclude soft-deleted rows, so a
  // recipient who deleted their copy and re-enters the code used to pay
  // $5 AGAIN and then wedge forever on 23505. A deleted copy is restored
  // instead, free — they already paid for this archive once.
  const { data: priorCopy } = await admin
    .from("oracles")
    .select("id, deleted_at")
    .eq("user_id", user.id)
    .or(priorFilters)
    .limit(1)
    .maybeSingle<{ id: string; deleted_at: string | null }>();
  if (priorCopy) {
    if (priorCopy.deleted_at) {
      const { error: restoreErr } = await admin
        .from("oracles")
        .update({ deleted_at: null })
        .eq("id", priorCopy.id);
      if (restoreErr) {
        return NextResponse.json(
          { error: "Couldn't bring them back. Try again in a moment." },
          { status: 500 },
        );
      }
    }
    return NextResponse.json({ already: true, oracle_id: priorCopy.id });
  }

  // Credit gate — admins skip, everyone else needs a purchased slot.
  // Atomic reserve, not check-then-spend — see the long note on the web
  // twin in (gated)/identity/inherit/actions.ts. Two redemptions at once
  // both saw the same single credit and both got an archive, one free.
  // consume_profile_credit does the check and decrement in one statement
  // so exactly one caller wins, and fails CLOSED to the payment screen.
  const usingCredit = !isAdmin(user.email);
  if (usingCredit && !(await reserveInheritedSlotCredit(user.id))) {
    const priceId = process.env.STRIPE_PRICE_ID_INHERITED_SLOT;
    if (!priceId) {
      return NextResponse.json(
        { error: "The payment step isn't set up yet. Try again in a bit." },
        { status: 500 },
      );
    }
    const headerList = await headers();
    const host = headerList.get("host") ?? "chapter3five.app";
    const proto = headerList.get("x-forwarded-proto") ?? "https";
    const origin = `${proto}://${host}`;

    // Dedupe against a session already in flight — the credit is
    // granted by the webhook, so a user bounced back before it lands
    // still reads 0 here and would be charged a second $5. Mirrors the
    // web twin; see findReusableCheckout.
    const reusable = await findReusableCheckout({
      admin,
      stripe: getStripe(),
      userId: user.id,
      purpose: "inherited_slot_purchase",
    });
    if (reusable.kind === "paid_pending_grant") {
      return NextResponse.json(
        {
          error:
            "Your payment went through — it's being applied right now. Give it a few seconds and try the code again.",
        },
        { status: 409 },
      );
    }
    if (reusable.kind === "open") {
      return NextResponse.json(
        { needs_payment: true, checkout_url: reusable.url },
        { status: 402 },
      );
    }

    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        // PA sales-tax collection; Checkout collects the billing address.
        automatic_tax: { enabled: true },
        customer_email: user.email ?? undefined,
        line_items: [{ price: priceId as string, quantity: 1 }],
        metadata: {
          user_id: user.id,
          purpose: "inherited_slot_purchase",
          purchase_kind: "inherited_slot",
        },
        // Carries the code back, same as the web action. 5f14d8e fixed
        // that call site and missed this one — the identical
        // one-surface-only mistake apologized for in 6f4c273. An
        // Android user redeeming in the app pays in the browser and
        // lands here, so without it they retype the code off the card
        // after paying, exactly like the bug that fix was written for.
        success_url: `${origin}/identity/inherit?purchased=1&code=${encodeURIComponent(code)}`,
        cancel_url: `${origin}/identity/inherit?cancelled=1`,
      });
      await recordPendingPaymentOrThrow({
        admin: createAdminClient(),
        stripe,
        session,
        row: {
          user_id: user.id,
          amount_cents: PRICING.inheritedSlotPurchaseCents,
          currency: "usd",
          purpose: "inherited_slot_purchase",
        },
      });
      if (!session.url) {
        return NextResponse.json(
          { error: "Couldn't open the payment page. Try again in a moment." },
          { status: 500 },
        );
      }
      return NextResponse.json(
        { needs_payment: true, checkout_url: session.url },
        { status: 402 },
      );
    } catch {
      return NextResponse.json(
        { error: "Couldn't open the payment page. Try again in a moment." },
        { status: 500 },
      );
    }
  }

  // Copy the avatar into the recipient's own namespace (best-effort).
  let newAvatarUrl: string | null = null;
  const sourcePath = avatarsObjectPath(source.avatar_url as string | null);
  if (sourcePath) {
    // Random, not a timestamp — the destination is as sensitive as
    // the source. This is the inherited photograph of the person who
    // died, landing on a PUBLIC bucket; a millisecond key is
    // enumerable by anyone holding the recipient's user id.
    const destPath = `legacy/${user.id}/inherited-${randomUUID()}.jpg`;
    const { error: copyError } = await admin.storage
      .from("avatars")
      .copy(sourcePath, destPath);
    if (copyError) {
      // The photo IS the archive for most families. A silent drop here
      // hands someone a faceless copy of their dead relative and tells
      // nobody, so at minimum it must be loud in the logs.
      console.error(
        `[inherit] avatar copy failed for oracle=${codeRow.oracle_id} → user=${user.id}: ${copyError.message} (source=${sourcePath})`,
      );
    } else {
      const { data: pub } = admin.storage
        .from("avatars")
        .getPublicUrl(destPath);
      newAvatarUrl = `${pub.publicUrl}?v=${Date.now()}`;
    }
  }

  // Insert the frozen copy.
  const { data: inserted, error: insertError } = await admin
    .from("oracles")
    .insert({
      user_id: user.id,
      created_by: user.id,
      is_legacy: true,
      creation_source: "inherited",
      inherited_from_code_id: codeRow.id,
      inherited_at: new Date().toISOString(),
      name: source.name,
      one_line_hook: source.one_line_hook,
      persona_prompt: source.persona_prompt,
      traits: source.traits,
      legacy_answers: source.legacy_answers,
      preferred_language: source.preferred_language ?? "en",
      avatar_url: newAvatarUrl,
      fingerprint: expectedFingerprint,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      // Same OR-filter as the pre-check (a re-minted code shares the
      // fingerprint but not the code id) and no deleted_at filter —
      // a soft-deleted copy holding the fingerprint is restored, free.
      // This fallback finding nothing was the "paid twice, wedged
      // forever" dead end. Mirrors the web twin exactly.
      const { data: racedCopy } = await admin
        .from("oracles")
        .select("id, deleted_at")
        .eq("user_id", user.id)
        .or(priorFilters)
        .limit(1)
        .maybeSingle<{ id: string; deleted_at: string | null }>();
      if (racedCopy) {
        if (racedCopy.deleted_at) {
          await admin
            .from("oracles")
            .update({ deleted_at: null })
            .eq("id", racedCopy.id);
        }
        // Already had this person — the credit just reserved bought
        // nothing, so give it back.
        if (usingCredit) await refundInheritedSlotCredit(user.id);
        return NextResponse.json({ already: true, oracle_id: racedCopy.id });
      }
    }
    // Insert failed with nothing to show for it. Return the credit so
    // "try again in a moment" is actually possible — otherwise they paid
    // $5, got nothing, and had nothing left to retry with.
    if (usingCredit) await refundInheritedSlotCredit(user.id);
    return NextResponse.json(
      { error: "Couldn't bring them in. Try again in a moment." },
      { status: 500 },
    );
  }

  // Spent up front by the reserve above and refunded on every failure
  // path, so there is nothing to consume here.

  // The quiet arrival note — and the only record of the $5 unlock
  // (2026-08-21: plans, packs, and refunds all emailed; this purchase
  // was silent). Best-effort: they are already in the conversation.
  if (user.email) {
    sendInheritRedeemedEmail({
      to: user.email,
      userId: user.id,
      name: (source.name as string | null) ?? "Someone",
      hook: (source.one_line_hook as string | null) ?? null,
    }).catch((err) =>
      console.error("[identity/inherit] arrival email failed:", err),
    );
  }

  return NextResponse.json({ oracle_id: inserted.id });
}
