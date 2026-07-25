"use server";

import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import {
  isInheritCodeShaped,
  normalizeInheritCode,
} from "@/lib/legacy/code-format";
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
