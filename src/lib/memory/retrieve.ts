import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Memory retrieval — formula v4.
 *
 * Builds the "== What I know about you ==" block the stream route prepends
 * to the system prompt (AFTER the cached persona_prompt breakpoint — this
 * block changes often and must never invalidate the cached prefix).
 */

/** Top-N memories to surface per turn. */
const MEMORY_LIMIT = 15;

/** Hard cap on the rendered block so it can't crowd the context. */
const MAX_BLOCK_CHARS = 800;

/**
 * Fetch the most important memories for this (oracle, user) pair and
 * render them as a system-prompt block. Returns "" when there are no
 * memories (or on any failure — never throws; the reply must ship).
 */
export async function fetchMemoriesForContext(
  oracleId: string,
  userId: string,
): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("persona_memories")
      .select("key, value")
      .eq("oracle_id", oracleId)
      .eq("user_id", userId)
      .order("importance", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(MEMORY_LIMIT);

    if (error) {
      console.error("[memory retrieve] fetch failed:", error);
      return "";
    }
    if (!data || data.length === 0) return "";

    const header = "== What I know about you ==\n";
    let body = "";
    for (const row of data) {
      const sentence = renderMemory(row.key, row.value);
      if (header.length + body.length + sentence.length + 1 > MAX_BLOCK_CHARS) {
        break;
      }
      body += (body ? " " : "") + sentence;
    }
    if (!body) return "";
    return header + body;
  } catch (err) {
    console.error("[memory retrieve] unexpected failure:", err);
    return "";
  }
}

/**
 * Render one memory as a short natural sentence. The key is a stable slug
 * ("kid_1_birthday"); humanize it so the persona reads prose, not a table.
 */
function renderMemory(key: string, value: string): string {
  const label = key.replace(/_/g, " ").trim();
  const v = value.trim().replace(/\s+/g, " ");
  // Longer values already read as facts ("trying to quit smoking") —
  // frame them as "You ...". Bare facts get "Your {label} is {value}."
  // (the block addresses the persona about the user: "Your spouse is
  // named Ana. Your daughter Rita turns 8 on March 4th.").
  if (/[.!?]$/.test(v) || v.split(" ").length > 6) {
    const sentence = /[.!?]$/.test(v) ? v : `${v}.`;
    return /^you\b/i.test(sentence) ? sentence : `You: ${sentence}`;
  }
  return `Your ${label.replace(/^your\s+/i, "")} is ${v}.`;
}
