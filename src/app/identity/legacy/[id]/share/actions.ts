"use server";

import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { mintInheritCode } from "@/lib/legacy/mint";
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

  // Ownership check via RLS: only the creator's own legacy oracle resolves.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id")
    .eq("id", oracleId)
    .eq("user_id", user.id)
    .eq("is_legacy", true)
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
    const code = await mintInheritCode(supabase, oracleId, user.id);
    if (!code) {
      redirectWithError(
        sharePath,
        "Couldn't create the code just now. Try again in a moment.",
      );
    }
  }

  redirect(sharePath);
}
