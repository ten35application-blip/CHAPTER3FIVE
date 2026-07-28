"use server";

import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { isAdmin } from "@/lib/admin/allowlist";
import {
  isInheritCodeShaped,
  normalizeInheritCode,
} from "@/lib/legacy/code-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  consumeInheritedSlotCredit,
  getInheritedSlotCredits,
} from "@/lib/subscription";

/**
 * One friendly message for every invalid outcome — wrong shape, unknown
 * code, revoked code, deleted oracle. Never reveals whether a code exists.
 */
const INVALID_CODE_MESSAGE =
  "That code didn't open anything. Check it letter by letter and try again.";

/**
 * Redeem an inherit code.
 *
 * GATE MODEL (July 2026, flat-fee rework): redemption is paid PER
 * CODE, not per tier — and the price is the same for EVERY code.
 * Any signed-in account (Free included) can redeem; every redemption
 * consumes one purchased inherit-slot credit
 * (profiles.inherited_slot_credits, $5 one-time via Stripe). No
 * credit → bounce to /upgrade?reason=inherited-slot, which sells
 * exactly one. There is NO memorial waiver — Wilson: "it is NOT free
 * to inherit a code and it's not our place to verify someone died."
 *
 * The credit is consumed AFTER the share row persists
 * (consumePackCredit pattern) and only when the share is genuinely
 * NEW — re-redeeming a code you already hold, or your own code,
 * never charges.
 *
 * Anti-probing note: a credit-less user can distinguish "invalid
 * code" from "valid code" (the latter bounces them to purchase).
 * Accepted: codes are 128-bit-ish random strings; the enumeration
 * surface is the same one every gift-code system carries.
 *
 * The lookup + share insert run through the service-role client on
 * purpose: inherit_codes has no authenticated-read policy, so codes
 * can't be probed from the client, and oracle_shares has no user
 * insert policy, so the only way in is through this action.
 */
export async function redeemInheritCode(rawCode: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const code = normalizeInheritCode(rawCode ?? "");
  if (!isInheritCodeShaped(code)) {
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
  if (!codeRow || codeRow.revoked_at) {
    redirectWithError("/identity/inherit", INVALID_CODE_MESSAGE);
  }

  const { data: oracle } = await admin
    .from("oracles")
    .select("id, user_id, deleted_at")
    .eq("id", codeRow.oracle_id)
    .maybeSingle();

  if (!oracle || oracle.deleted_at) {
    redirectWithError("/identity/inherit", INVALID_CODE_MESSAGE);
  }

  // The creator redeeming their own code is a no-op — they already
  // have them. Straight to the welcome, no charge.
  if (oracle.user_id === user.id) {
    redirect(`/dashboard?welcomed=${oracle.id}`);
  }

  // Already redeemed this identity? Also a no-op, also free — the gate
  // charges per NEW share, never per attempt.
  const { data: existingShare } = await admin
    .from("oracle_shares")
    .select("id")
    .eq("oracle_id", oracle.id)
    .eq("user_id", user.id)
    .maybeSingle<{ id: string }>();
  if (existingShare) {
    redirect(`/dashboard?welcomed=${oracle.id}`);
  }

  // Every NEW redemption requires a purchased credit — flat $5 per
  // code, every tier, no exceptions (admins skip the till, as
  // everywhere else). Fail-closed: an unreadable balance reads as 0
  // and bounces to purchase rather than minting a free redemption.
  const usingCredit = !isAdmin(user.email);
  if (usingCredit && (await getInheritedSlotCredits(user.id)) < 1) {
    redirect(
      `/upgrade?next=${encodeURIComponent("/identity/inherit")}&reason=inherited-slot`,
    );
  }

  const { error: shareError } = await admin.from("oracle_shares").upsert(
    {
      oracle_id: oracle.id,
      user_id: user.id,
      code_id: codeRow.id,
    },
    { onConflict: "oracle_id,user_id", ignoreDuplicates: true },
  );
  if (shareError) {
    redirectWithError(
      "/identity/inherit",
      "Couldn't bring them in. Try again in a moment.",
      shareError,
    );
  }

  // Consume the credit AFTER the share persisted — a failed insert
  // must never eat a paid credit (same post-persist contract as the
  // message/image pack credits). Best-effort, never throws.
  if (usingCredit) {
    await consumeInheritedSlotCredit(user.id);
  }

  // Redirect BACK to the dashboard, not straight into the chat. The
  // dashboard renders a "X is now in your contacts" banner with a
  // "Say hi" CTA — Wilson's spec. Landing in the chat mid-motion skips
  // that beat and the redeem feels transactional instead of warm.
  redirect(`/dashboard?welcomed=${oracle.id}`);
}
