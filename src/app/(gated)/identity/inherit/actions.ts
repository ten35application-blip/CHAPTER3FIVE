"use server";

import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import {
  isInheritCodeShaped,
  normalizeInheritCode,
} from "@/lib/legacy/code-format";
import { PRICING } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isPro } from "@/lib/subscription";

/**
 * One friendly message for every invalid outcome — wrong shape, unknown
 * code, revoked code, deleted oracle. Never reveals whether a code exists.
 */
const INVALID_CODE_MESSAGE =
  "That code didn't open anything. Check it letter by letter and try again.";

/**
 * Redeem an inherit code.
 *
 * The lookup + share insert run through the service-role client on purpose:
 * inherit_codes has no authenticated-read policy, so codes can't be probed
 * from the client, and oracle_shares has no user insert policy, so the only
 * way in is through this action.
 */
export async function redeemInheritCode(rawCode: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // Pro-gate the redeem action BEFORE the code lookup so we never
  // reveal to a non-Pro user whether the code they typed is real.
  // The upgrade page lets them come back to /identity/inherit with
  // the code still in hand once they're on Pro.
  if (!(await isPro(supabase))) {
    redirect(`/upgrade?next=${encodeURIComponent("/identity/inherit")}`);
  }

  const admin = createAdminClient();

  // Slot-gate BEFORE the code lookup, same reasoning as the Pro gate
  // above: a user at their inherited-identity limit learns nothing
  // about whether the code they typed is real. Pro includes one
  // inherited identity; each extra slot is a paid add-on tracked on
  // profiles.extra_inherited_slots (service-role writes only).
  const [{ data: profileRow }, { count: shareCount }] = await Promise.all([
    admin
      .from("profiles")
      .select("extra_inherited_slots")
      .eq("id", user.id)
      .maybeSingle<{ extra_inherited_slots: number | null }>(),
    admin
      .from("oracle_shares")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const allowedSlots =
    PRICING.includedInheritedIdentitiesPerPlan +
    (profileRow?.extra_inherited_slots ?? 0);
  if ((shareCount ?? 0) >= allowedSlots) {
    redirect(
      `/upgrade?next=${encodeURIComponent("/identity/inherit")}&reason=extra-inherited`,
    );
  }

  const code = normalizeInheritCode(rawCode ?? "");
  if (!isInheritCodeShaped(code)) {
    redirectWithError("/identity/inherit", INVALID_CODE_MESSAGE);
  }

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

  // The creator redeeming their own code is a no-op — they already have them.
  if (oracle.user_id !== user.id) {
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
  }

  redirect(`/chat/${oracle.id}`);
}
