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
 * Callers must pass the SERVICE-ROLE client (createAdminClient()) and are
 * responsible for the Pro gate + oracle-ownership check first: migration
 * 0065 dropped the user-side insert policy on inherit_codes, so minting
 * only happens through the Pro-gated server actions — a browser with the
 * anon key can no longer insert codes at all.
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
