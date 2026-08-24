import type { SupabaseClient } from "@supabase/supabase-js";
import { generateInheritCode } from "./code";

const MAX_MINT_ATTEMPTS = 5;

/**
 * Mint an inherit code for a legacy oracle. Retries on unique-constraint
 * collision (~2.05B-combination space since the three-word widening, so
 * effectively never more than once).
 *
 * Returns the code, or null if every attempt failed. Callers MUST check
 * the return value: a null used to be dropped on the floor with the
 * comment "the share page offers a retry", which was false — that page
 * is linked from nowhere. The user paid, answered thirty-plus questions,
 * and landed on a Settings page that looked as though none of it had
 * happened. Recovery now lives in Settings, which detects a legacy
 * archive with no live code from state and offers an ungated
 * retryMintInheritCode.
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
    if (error.code !== "23505") {
      console.error("[mintInheritCode] insert failed", error);
      return null;
    }
    // 23505 has TWO meanings now. A collision on the code column means
    // roll again (2.05B-combination space — effectively never twice).
    // A collision on inherit_codes_one_live_per_oracle means a
    // concurrent mint for the SAME archive won the race — rerolling
    // would just hit it again five times and fail the user whose code
    // already exists. Hand back the winner instead: the user wants THE
    // code, and there is exactly one.
    const { data: winner } = await supabase
      .from("inherit_codes")
      .select("code")
      .eq("oracle_id", oracleId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ code: string }>();
    if (winner?.code) return winner.code;
  }
  return null;
}
