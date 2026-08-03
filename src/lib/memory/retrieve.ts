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
 * Identity keys — who the USER is, not what's happening in their life.
 * These are the same person no matter which identity they're talking
 * to, so they're read user-wide (across all the user's oracles: one
 * persona learns their spouse's name, all of them remember) and are
 * rendered in their own "About them" block instead of the per-oracle
 * memories list. They're what the flirt-consent test keys off.
 */
const ABOUT_THEM_KEYS = [
  "goes_by",
  "pronouns",
  "gender",
  "orientation",
  "relationship_status",
  "spouse_name",
  "partner_name",
] as const;

const ABOUT_THEM_KEY_SET = new Set<string>(ABOUT_THEM_KEYS);

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
      // Exclude reserved-underscore keys (e.g. _session_residue).
      // Those are internal signals rendered as their own system
      // blocks; they don't belong in the "What I know about you"
      // human-facts list.
      .not("key", "like", "\\_%")
      // Identity keys render in the "About them" block instead
      // (fetchAboutThemBlock, user-wide) — keep them out of the
      // per-oracle list so they never show twice.
      .not("key", "in", `(${ABOUT_THEM_KEYS.join(",")})`)
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
 * "About them" block — who the user is, learned through conversation:
 * the name they go by, pronouns, gender, orientation, relationship
 * status, partner/spouse name. Scoped by user_id ONLY (no oracle
 * filter) — these facts are the same person in every conversation, so
 * every identity remembers them once any identity learns them. Deduped
 * by key, most recently updated row wins. Returns "" when nothing is
 * known (or on any failure — never throws; the reply must ship).
 */
export async function fetchAboutThemBlock(userId: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("persona_memories")
      .select("key, value, updated_at")
      .in("key", [...ABOUT_THEM_KEYS])
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(40);

    if (error) {
      console.error("[memory retrieve] about-them fetch failed:", error);
      return "";
    }
    if (!data || data.length === 0) return "";

    // First occurrence per key wins (rows are newest-first).
    const byKey = new Map<string, string>();
    for (const row of data) {
      if (!ABOUT_THEM_KEY_SET.has(row.key)) continue;
      if (!byKey.has(row.key)) byKey.set(row.key, row.value);
    }
    if (byKey.size === 0) return "";

    const lines: string[] = [];
    for (const key of ABOUT_THEM_KEYS) {
      const value = byKey.get(key);
      if (!value) continue;
      lines.push(renderAboutThem(key, value));
    }
    if (lines.length === 0) return "";

    return (
      "== About them (what they've shared about themselves) ==\n" +
      lines.join(" ") +
      "\nThis is who you're talking to, learned across your conversations. Let it shape how you read them — don't recite it back."
    );
  } catch (err) {
    console.error("[memory retrieve] about-them unexpected failure:", err);
    return "";
  }
}

/** Sanitize a user-derived value for system-block interpolation. */
function scrubValue(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[=_*#`]{2,}/g, " ")
    .trim();
}

/** Render one identity fact as a short natural sentence about the user. */
function renderAboutThem(key: string, value: string): string {
  const v = scrubValue(value);
  switch (key) {
    case "goes_by":
      return `They go by ${v}.`;
    case "pronouns":
      return `Their pronouns are ${v}.`;
    case "gender":
      return `Gender: ${v}.`;
    case "orientation":
      return `Orientation: ${v}.`;
    case "relationship_status":
      return `Relationship status: ${v}.`;
    case "spouse_name":
      return `Their spouse is ${v}.`;
    case "partner_name":
      return `Their partner is ${v}.`;
    default:
      return `Their ${key.replace(/_/g, " ")} is ${v}.`;
  }
}

/**
 * Render one memory as a short natural sentence. The key is a stable slug
 * ("kid_1_birthday"); humanize it so the persona reads prose, not a table.
 */
function renderMemory(key: string, value: string): string {
  const label = key.replace(/_/g, " ").trim();
  // The value is user-derived and ends up inside the system block: collapse
  // whitespace (no newlines) and defuse the "== ... ==" run that the block's
  // own headers use, so a memory can't forge one.
  const v = value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[=_*#`]{2,}/g, " ")
    .trim();
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
