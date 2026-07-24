import type { SupabaseClient } from "@supabase/supabase-js";
import { generateInheritCode } from "./code";

const MAX_MINT_ATTEMPTS = 5;

/**
 * Mint an inherit code for a legacy oracle. Retries on unique-constraint
 * collision (~35M-combination space, so effectively never more than once).
 * Returns the code, or null if all attempts failed — callers treat a null
 * as "mint later" (the share page offers a retry) rather than failing the
 * whole creation flow.
 *
 * Uses the caller's user-scoped client: the inherit_codes insert policy
 * requires created_by = auth.uid() AND ownership of the oracle.
 */
export async function mintInheritCode(
  supabase: SupabaseClient,
  oracleId: string,
  userId: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_MINT_ATTEMPTS; attempt++) {
    const code = generateInheritCode();
    const { error } = await supabase.from("inherit_codes").insert({
      oracle_id: oracleId,
      created_by: userId,
      code,
    });
    if (!error) return code;
    // 23505 = unique_violation on code — roll again. Anything else is real.
    if (error.code !== "23505") {
      console.error("[mintInheritCode] insert failed", error);
      return null;
    }
  }
  return null;
}
