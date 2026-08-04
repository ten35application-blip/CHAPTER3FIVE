import { createHash } from "node:crypto";
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
import { recordPendingPaymentOrThrow } from "@/lib/billing/pendingPayment";
import {
  consumeInheritedSlotCredit,
  getInheritedSlotCredits,
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

function avatarsObjectPath(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const prefix = `${supabaseUrl}/storage/v1/object/public/avatars/`;
  if (!supabaseUrl || !avatarUrl.startsWith(prefix)) return null;
  const rest = avatarUrl.slice(prefix.length);
  const path = rest.split("?")[0];
  return path.length > 0 ? path : null;
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
  if (!codeRow || codeRow.revoked_at) {
    await recordRedeemAttempt(user.id, false);
    return NextResponse.json({ error: INVALID_CODE_MESSAGE }, { status: 404 });
  }

  const { data: source } = await admin
    .from("oracles")
    .select(
      "id, user_id, deleted_at, name, one_line_hook, persona_prompt, traits, legacy_answers, avatar_url, preferred_language, fingerprint",
    )
    .eq("id", codeRow.oracle_id)
    .maybeSingle();
  if (!source || source.deleted_at) {
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
  const { data: priorCopy } = await admin
    .from("oracles")
    .select("id")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .or(priorFilters)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (priorCopy) {
    return NextResponse.json({ already: true, oracle_id: priorCopy.id });
  }

  // Credit gate — admins skip, everyone else needs a purchased slot.
  const usingCredit = !isAdmin(user.email);
  if (usingCredit && (await getInheritedSlotCredits(user.id)) < 1) {
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
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
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
    const destPath = `legacy/${user.id}/inherited-${Date.now()}.jpg`;
    const { error: copyError } = await admin.storage
      .from("avatars")
      .copy(sourcePath, destPath);
    if (!copyError) {
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
      const { data: racedCopy } = await admin
        .from("oracles")
        .select("id")
        .eq("user_id", user.id)
        .eq("inherited_from_code_id", codeRow.id)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle<{ id: string }>();
      if (racedCopy) {
        return NextResponse.json({ already: true, oracle_id: racedCopy.id });
      }
    }
    return NextResponse.json(
      { error: "Couldn't bring them in. Try again in a moment." },
      { status: 500 },
    );
  }

  // Consume credit AFTER the copy actually persisted.
  if (usingCredit) {
    await consumeInheritedSlotCredit(user.id);
  }

  return NextResponse.json({ oracle_id: inserted.id });
}
