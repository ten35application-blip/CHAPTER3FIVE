"use server";

import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { mintInheritCode } from "@/lib/legacy/mint";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Fallback mint — completion already mints a code, but if that best-effort
 * insert ever failed, the share page renders a "Create the code" button that
 * calls this. Idempotent enough: if a live code appeared in the meantime we
 * just redirect back and the page shows it.
 */
export async function mintCodeForOracle(oracleId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const sharePath = `/identity/legacy/${oracleId}/share`;

  // PRO GATE REMOVED 2026-08-04. The comment it replaced said "minting
  // is the Pro feature" — true before the July 2026 flat-fee rework,
  // which made the legacy flow open to every tier and left this gate
  // behind. The effect was that a Free user whose mint failed at
  // creation got redirected to /upgrade to pay for the recovery from a
  // failure we caused, on the archive of a person who died.
  //
  // Ownership below is the real gate. The canonical recovery now lives
  // in Settings (retryMintInheritCode); this page stays reachable by
  // direct link and must not contradict it.

  // Ownership check via RLS: only the creator's own legacy oracle
  // resolves. Inherited copies (0111) are excluded — a redeemed
  // identity is not the recipient's to mint new codes for.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id")
    .eq("id", oracleId)
    .eq("user_id", user.id)
    .eq("is_legacy", true)
    .is("inherited_at", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oracle) {
    redirect("/dashboard");
  }

  // Already have a live code? Nothing to do.
  const { data: existing } = await supabase
    .from("inherit_codes")
    .select("id")
    .eq("oracle_id", oracleId)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();

  if (!existing) {
    // Service-role client on purpose — 0065 made minting server-only.
    // Ownership was verified above with the user-scoped client.
    const code = await mintInheritCode(createAdminClient(), oracleId, user.id);
    if (!code) {
      redirectWithError(
        sharePath,
        "Couldn't create the code just now. Try again in a moment.",
      );
    }
  }

  redirect(sharePath);
}
