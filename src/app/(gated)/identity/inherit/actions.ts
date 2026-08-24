"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { isAdmin } from "@/lib/admin/allowlist";
import {
  isInheritCodeShaped,
  normalizeInheritCode,
} from "@/lib/legacy/code-format";
import { PRICING } from "@/lib/pricing";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInheritRedeemedEmail } from "@/lib/notifications";
import {
  recordRedeemAttempt,
  REDEEM_RATE_LIMIT_MESSAGE,
  tooManyRedeemAttempts,
} from "@/lib/legacy/redeemLimit";
import {
  findReusableCheckout,
  recordPendingPaymentOrThrow,
} from "@/lib/billing/pendingPayment";
import { createClient } from "@/lib/supabase/server";
import {
  reserveInheritedSlotCredit,
  refundInheritedSlotCredit,
} from "@/lib/subscription";
import { rehomeArchivePhoto } from "@/lib/storage/avatarObject";

/**
 * One friendly message for every invalid outcome — wrong shape, unknown
 * code, revoked code, deleted oracle. Never reveals whether a code exists.
 */
const INVALID_CODE_MESSAGE =
  "That code didn't open anything. Check it letter by letter and try again.";

/**
 * The recipient's copy carries a fingerprint derived from the source
 * oracle's fingerprint salted with the recipient's user id. Two jobs:
 *   - never collides with the creator's row on oracles_fingerprint_key
 *   - IS deterministic per (source, recipient), so a second redemption
 *     of the same identity by the same person — even through a
 *     re-minted code — collides with their own first copy and gets
 *     treated as already-redeemed instead of minting a duplicate.
 */
function copyFingerprint(
  sourceFingerprint: string,
  recipientId: string,
): string {
  return createHash("sha256")
    .update(`inherited:${sourceFingerprint}:${recipientId}`)
    .digest("hex");
}

/**
 * The legacy photo is stored as a public URL into the `avatars` bucket
 * (`.../storage/v1/object/public/avatars/legacy/{uid}/{ts}.jpg?v=...`).
 * Extract the object path so we can storage-copy it. Returns null for
 * anything that isn't a URL into this project's avatars bucket — the
 * copy is then simply skipped (letter avatar fallback).
 */
function avatarsObjectPath(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const prefix = `${supabaseUrl}/storage/v1/object/public/avatars/`;
  if (!supabaseUrl || !avatarUrl.startsWith(prefix)) return null;
  const rest = avatarUrl.slice(prefix.length);
  const path = rest.split("?")[0];
  return path.length > 0 ? path : null;
}

/**
 * Redeem an inherit code.
 *
 * MODEL (July 2026 durability rework, Wilson: "copies get sent out and
 * stays on that person's account as a contact"): redemption DUPLICATES
 * the legacy oracle into the recipient's account — a frozen snapshot of
 * name / hook / persona_prompt / traits / legacy_answers plus a copied
 * avatar file under the recipient's own storage namespace. The copy is
 * fully owned by the recipient (user_id = them), so the creator
 * deleting their account, their oracle, or their photo can never take
 * the person away from the family. No live sync after redemption, by
 * design.
 *
GATE MODEL (unchanged from the flat-fee rework): redemption is paid
 * PER CODE — every NEW redemption consumes one purchased inherit-slot
 * credit (profiles.inherited_slot_credits, $5 one-time via Stripe). No
 * credit → we mint a Stripe checkout session inline and redirect
 * straight to it (Wilson's ask 2026-07-28: no /upgrade detour). On
 * successful payment the webhook grants the credit and the buyer is
 * bounced back to /identity/inherit?purchased=1 to re-enter their
 * code. No memorial waiver — Wilson: "it is NOT free to inherit a
 * code and it's not our place to verify someone died."
 *
 * The credit is consumed AFTER the copy persists (consumePackCredit
 * pattern) and only when the copy is genuinely NEW — re-redeeming an
 * identity you already hold, or your own code, never charges.
 *
 * Anti-probing note: a credit-less user can distinguish "invalid code"
 * from "valid code" (the latter bounces them to purchase). Accepted:
 * codes are ~31 bits (10,000 x 60 x 59 x 58) AND redemption is rate-limited per user; the enumeration surface is the
 * same one every gift-code system carries.
 *
 * Everything runs through the service-role client on purpose:
 * inherit_codes has no authenticated-read policy (codes can't be probed
 * from the client), the source oracle belongs to another user (RLS
 * would hide it), and the copy INSERT sets server-only columns
 * (is_legacy, inherited_from_code_id, inherited_at, creation_source)
 * that the protect_oracle_state trigger blocks for PostgREST roles.
 */
export async function redeemInheritCode(rawCode: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // Rate limit before any lookup — mirrors /api/identity/inherit
  // (migration 0131). This endpoint reveals validity before payment,
  // so unlimited probing enumerates other families' archives.
  if (await tooManyRedeemAttempts(user.id)) {
    redirectWithError("/identity/inherit", REDEEM_RATE_LIMIT_MESSAGE);
  }

  const code = normalizeInheritCode(rawCode ?? "");
  if (!isInheritCodeShaped(code)) {
    await recordRedeemAttempt(user.id, false);
    redirectWithError("/identity/inherit", INVALID_CODE_MESSAGE);
  }

  const admin = createAdminClient();

  const { data: codeRow, error: lookupError } = await admin
    .from("inherit_codes")
    .select("id, oracle_id, revoked_at")
    .eq("code", code)
    .maybeSingle();

  if (lookupError) {
    redirectWithError(
      "/identity/inherit",
      "Something went wrong. Try again in a moment.",
      lookupError,
    );
  }
  if (!codeRow) {
    await recordRedeemAttempt(user.id, false);
    redirectWithError("/identity/inherit", INVALID_CODE_MESSAGE);
  }
  // A REVOKED code gets honest copy, deliberately distinct from the
  // vague invalid-code message. The vague message told a person
  // holding a CORRECT code to "check it letter by letter and try
  // again" — retyping into the rate limiter, forever, with no way to
  // learn the truth. The anti-enumeration argument doesn't apply
  // here: this branch only fires when the entered code MATCHES a real
  // row, so the holder has already proven possession; the only thing
  // revealed is the code's own state, to the person it was given to.
  if (codeRow.revoked_at) {
    await recordRedeemAttempt(user.id, false);
    redirectWithError(
      "/identity/inherit",
      "The person who made this code has turned it off, so it can't open the archive anymore. The archive itself is safe. If this is a surprise, reach out to them.",
    );
  }

  // The full snapshot read — everything the copy freezes at redemption
  // time. Admin client: the source row belongs to the creator, RLS
  // would (correctly) hide it from the recipient.
  const { data: source } = await admin
    .from("oracles")
    .select(
      "id, user_id, deleted_at, name, one_line_hook, persona_prompt, traits, legacy_answers, avatar_url, preferred_language, fingerprint",
    )
    .eq("id", codeRow.oracle_id)
    .maybeSingle();

  // Only a MISSING source rejects. A soft-deleted source stays
  // redeemable on purpose: revoking a code is the one and only thing
  // that kills it — deletion never does. Before this, closing the
  // creator's account (or a Contacts swipe on the archive) cascaded
  // deleted_at onto the source and every outstanding card silently hit
  // "That code didn't open anything" — the product's central promise
  // failing in its central scenario, with an error nobody could
  // diagnose. The snapshot columns are intact on a soft-deleted row,
  // and the purge cron refuses to hard-delete identities (and now
  // accounts) holding unrevoked codes, so the data this copy needs is
  // guaranteed to still exist.
  if (!source) {
    await recordRedeemAttempt(user.id, false);
    redirectWithError("/identity/inherit", INVALID_CODE_MESSAGE);
  }
  await recordRedeemAttempt(user.id, true);

  // The creator redeeming their own code is a no-op — they already
  // have them. Straight to the welcome, no charge, no copy.
  if (source.user_id === user.id) {
    redirect(`/dashboard?welcomed=${source.id}`);
  }

  // Already redeemed this identity? Also a no-op, also free — the gate
  // charges per NEW copy, never per attempt. Two checks: the code id
  // (exact re-entry) and the salted fingerprint (same identity through
  // a re-minted code).
  const expectedFingerprint = source.fingerprint
    ? copyFingerprint(source.fingerprint, user.id)
    : null;
  const priorFilters = expectedFingerprint
    ? `inherited_from_code_id.eq.${codeRow.id},fingerprint.eq.${expectedFingerprint}`
    : `inherited_from_code_id.eq.${codeRow.id}`;
  // NO deleted_at filter — deliberately. The fingerprint unique index
  // does not exclude soft-deleted rows, so a recipient who deleted
  // their copy (one Contacts swipe) and re-enters the code used to
  // fall through this check, get sent to Stripe, PAY $5 A SECOND
  // TIME, and then hit 23505 on the invisible deleted row — "Couldn't
  // bring them in. Try again in a moment", forever, until the purge
  // freed the fingerprint. A deleted copy found here is RESTORED
  // instead: they already paid for this archive once, and they're
  // holding the code that proves it. The 0136 trigger clears the
  // purge countdown on the restore automatically.
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
        redirectWithError(
          "/identity/inherit",
          "Couldn't bring them back. Try again in a moment.",
          restoreErr,
        );
      }
    }
    redirect(`/dashboard?welcomed=${priorCopy.id}`);
  }

  // Every NEW redemption requires a purchased credit — flat $5 per
  // code, every tier, no exceptions (admins skip the till, as
  // everywhere else). Fail-closed: an unreadable balance reads as 0
  // and creates a Stripe checkout session inline.
  //
  // Wilson's ask 2026-07-28: no /upgrade detour. Recipient enters the
  // code → we go straight to Stripe → they pay $5 → land back on
  // /identity/inherit?purchased=1 → re-enter the code (or continue
  // from consent state) → this branch's balance check passes → the
  // full redemption completes. Same shape as the other-identity mint
  // gate (legacy/new/actions.ts).
  // RESERVE THE CREDIT ATOMICALLY, don't check-then-spend.
  //
  // This read the balance here and decremented ~200 lines later, after
  // the copy persisted. Two redemptions running at once both saw the
  // same "1 credit", both passed, and both got an archive — one of them
  // free, because increment_profile_counter floors at zero.
  //
  // consume_profile_credit does the check and the decrement in ONE
  // statement (UPDATE ... WHERE credits > 0 RETURNING), so exactly one
  // caller can win. It fails CLOSED: a database error returns false and
  // sends them to the payment screen rather than handing out a free
  // archive, which is the safe direction to be wrong in.
  //
  // Everything between here and the insert is the avatar copy, which is
  // explicitly best-effort and never blocks — so the ONLY way to hold a
  // spent credit with nothing to show for it is a failed insert, and
  // that path refunds below.
  const usingCredit = !isAdmin(user.email);
  if (usingCredit && !(await reserveInheritedSlotCredit(user.id))) {
    const priceId = process.env.STRIPE_PRICE_ID_INHERITED_SLOT;
    if (!priceId) {
      redirectWithError(
        "/identity/inherit",
        "The payment step isn't set up yet. Try again in a bit.",
      );
    }
    const headerList = await headers();
    const host = headerList.get("host") ?? "chapter3five.app";
    const proto = headerList.get("x-forwarded-proto") ?? "https";
    const origin = `${proto}://${host}`;

    // Dedupe against a session already in flight — the credit is
    // granted by the webhook, so a user bounced back before it lands
    // still reads 0 here and would be charged a second $5. See
    // findReusableCheckout for the full story.
    const reusable = await findReusableCheckout({
      admin: createAdminClient(),
      stripe: getStripe(),
      userId: user.id,
      purpose: "inherited_slot_purchase",
    });
    if (reusable.kind === "paid_pending_grant") {
      redirectWithError(
        "/identity/inherit",
        "Your payment went through — it's being applied right now. Give it a few seconds and enter the code again.",
      );
    }
    if (reusable.kind === "open") {
      redirect(reusable.url);
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
        line_items: [{ price: priceId as string, quantity: 1 }],
        metadata: {
          user_id: user.id,
          purpose: "inherited_slot_purchase",
          purchase_kind: "inherited_slot",
        },
        // CARRY THE CODE BACK (2026-08-04). Without it the return trip
        // dropped the user on a freshly-mounted form: consent gate
        // un-checked, code field empty. They had to re-read the consent
        // copy, re-tick the box, and RETYPE the code from the card —
        // after paying, at the worst moment of their life.
        //
        // The code is already in their text messages and on a card in
        // their hand; having it in their own URL for one redirect is a
        // negligible addition, and the alternative is making a grieving
        // person type it twice.
        success_url: `${origin}/identity/inherit?purchased=1&code=${encodeURIComponent(code)}`,
        cancel_url: `${origin}/identity/inherit?cancelled=1`,
      });
      // H2 fix: throw on insert failure so the surrounding catch
      // redirects to a graceful "try again" instead of leaving an
      // unfulfilled Stripe session open. Helper also expires the
      // session and logs loudly. Do the insert BEFORE assigning
      // checkoutUrl so a ledger failure keeps checkoutUrl null and
      // the fallback error path fires.
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
      checkoutUrl = session.url;
    } catch (err) {
      redirectWithError(
        "/identity/inherit",
        "Couldn't open the payment page. Try again in a moment.",
        err,
      );
    }
    if (!checkoutUrl) {
      redirectWithError(
        "/identity/inherit",
        "Couldn't open the payment page. Try again in a moment.",
      );
    }
    redirect(checkoutUrl);
  }

  // Copy the avatar FILE into the recipient's own namespace so the
  // creator deleting their storage objects can't blank the face the
  // family knows. Best-effort: if the source object is already gone
  // (or the URL never pointed into our bucket), the copy proceeds
  // with no avatar and the letter fallback takes over — losing the
  // photo must never block inheriting the person.
  let newAvatarUrl: string | null = null;
  const sourcePath = avatarsObjectPath(source.avatar_url);
  if (sourcePath) {
    // Random, not a timestamp — the destination is as sensitive as
    // the source. This is the inherited photograph of the person who
    // died, landing on a PUBLIC bucket; a millisecond key is
    // enumerable by anyone holding the recipient's user id.
    const destPath = `legacy/${user.id}/inherited-${randomUUID()}.jpg`;
    const { error: copyError } = await admin.storage
      .from("avatars")
      .copy(sourcePath, destPath);
    if (!copyError) {
      const { data: pub } = admin.storage
        .from("avatars")
        .getPublicUrl(destPath);
      newAvatarUrl = `${pub.publicUrl}?v=${Date.now()}`;
    } else {
      // This action already logged; the API twin did not, and that is
      // where the silence lived.
      console.error(
        "[redeemInheritCode] avatar copy failed (continuing without photo):",
        copyError,
      );
    }
  }

  // The copy itself. Frozen snapshot — no pointer back to the source
  // row, so nothing the creator does later can reach it. Server-only
  // columns (is_legacy, creation_source, inherited_*) pass because
  // this is the service-role client; the protect_oracle_state trigger
  // blocks the same insert from any PostgREST role.
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
      legacy_answers: rehomeArchivePhoto(source.legacy_answers, newAvatarUrl),
      preferred_language: source.preferred_language ?? "en",
      avatar_url: newAvatarUrl,
      fingerprint: expectedFingerprint,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      // The fingerprint index rejected us: either a concurrent
      // double-submit won the race, or a SOFT-DELETED copy still holds
      // the fingerprint (the index doesn't exclude deleted rows).
      // Search with the same OR-filter as the pre-check — a re-minted
      // code has a different code id but the same fingerprint — and
      // with no deleted_at filter, restoring if needed. No charge
      // either way. This fallback finding nothing was the "paid twice,
      // wedged forever" dead end.
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
        // They already have this person — the credit reserved a moment
        // ago bought nothing, so give it back before handing them over.
        if (usingCredit) await refundInheritedSlotCredit(user.id);
        redirect(`/dashboard?welcomed=${racedCopy.id}`);
      }
    }
    // The insert failed and there is no copy to show for it. Put the
    // credit back so "try again in a moment" is actually possible —
    // without this they paid $5, got nothing, and had nothing left to
    // retry with.
    if (usingCredit) await refundInheritedSlotCredit(user.id);
    redirectWithError(
      "/identity/inherit",
      "Couldn't bring them in. Try again in a moment.",
      insertError,
    );
  }

  // The credit was spent up front by reserveInheritedSlotCredit and
  // refunded on every failure path above, so there is nothing to
  // consume here. Spending it twice was the other way to get this
  // wrong.

  // The quiet arrival note — and the only record of the $5 unlock
  // (2026-08-21). Fired before the redirect below, which throws by
  // design; best-effort so mail trouble can't derail the handoff.
  if (user.email) {
    void sendInheritRedeemedEmail({
      to: user.email,
      userId: user.id,
      name: (source.name as string | null) ?? "Someone",
      hook: (source.one_line_hook as string | null) ?? null,
    }).catch((err) =>
      console.error("[identity/inherit] arrival email failed:", err),
    );
  }

  // Redirect BACK to the dashboard, not straight into the chat. The
  // dashboard renders a "X is now in your contacts" banner with a
  // "Say hi" CTA — Wilson's spec. Landing in the chat mid-motion skips
  // that beat and the redeem feels transactional instead of warm.
  redirect(`/dashboard?welcomed=${inserted.id}`);
}
