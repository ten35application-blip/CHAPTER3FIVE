import { createAdminClient } from "@/lib/supabase/admin";
import type { BlockDecision } from "./block-detector";

/**
 * Applies a positive block decision end-to-end:
 *   - Set oracles.blocked_at + block_reason so the stream route's 403
 *     gate fires on the user's next send.
 *   - Insert a chat_blocks row for the audit trail. severity comes
 *     from the decision; blocked_until stays null for permanent (which
 *     matches Wilson's "no refund, the door stays shut" policy).
 *   - Insert chat_block_events (0062 audit log) with decided_by
 *     = 'automated' so admin review can distinguish auto-blocks from
 *     manual ones.
 *
 * Non-blocking from the stream route's perspective — call inside
 * after() so it never delays the persona's already-persisted reply.
 *
 * Never throws. If the DB writes fail, the user's next send just
 * behaves normally (fail-open on the safety side — better than
 * throwing 500s at a paying customer). Admins can review chat_blocks
 * gaps later.
 */
export async function handleBlockDecision({
  decision,
  oracleId,
  userId,
}: {
  decision: Extract<BlockDecision, { block: true }>;
  oracleId: string;
  userId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Compute the ban window. `permanent` = no unlock; `temporary` = 7 days;
  // `warning` = we log it but don't actually block. The warning tier
  // exists so we can escalate later (2nd warning = temp, 3rd = perm)
  // without shipping a new detector.
  let blockedUntil: string | null = null;
  let shouldSetOracleFlag = true;
  if (decision.severity === "warning") {
    shouldSetOracleFlag = false;
  } else if (decision.severity === "temporary") {
    blockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  // 1) Flip the oracle-level flag so the stream 403s the next send.
  if (shouldSetOracleFlag) {
    const { error } = await admin
      .from("oracles")
      .update({ blocked_at: now, block_reason: decision.reason })
      .eq("id", oracleId);
    if (error) {
      console.error("[safety/block] oracle flag update failed:", error);
      // Continue — the audit rows still matter even if the flag failed.
    }
  }

  // 2) chat_blocks audit row (richer schema: severity + blocked_until).
  // supabase-js returns errors rather than throwing, so check the error
  // field — a bare try/catch here would swallow DB failures silently.
  try {
    const { error } = await admin.from("chat_blocks").insert({
      oracle_id: oracleId,
      user_id: userId,
      blocked_at: now,
      blocked_until: blockedUntil ?? "9999-01-01T00:00:00Z", // sentinel for permanent
      severity: decision.severity,
      reason: decision.reason,
    });
    if (error) console.error("[safety/block] chat_blocks insert failed:", error);
  } catch (err) {
    console.error("[safety/block] chat_blocks insert threw:", err);
  }

  // 3) chat_block_events (0062 audit log — smaller, decided_by column
  //    lets admins distinguish auto/human).
  try {
    const { error } = await admin.from("chat_block_events").insert({
      oracle_id: oracleId,
      user_id: userId,
      reason: decision.reason,
      decided_by: "automated",
    });
    if (error) {
      console.error("[safety/block] chat_block_events insert failed:", error);
    }
  } catch (err) {
    console.error("[safety/block] chat_block_events insert threw:", err);
  }
}
