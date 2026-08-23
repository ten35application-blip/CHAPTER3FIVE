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
 * Split into two tiers by how far a fact is allowed to travel.
 *
 * SHARED tier — how to ADDRESS someone. The name they go by, their
 * pronouns, their gender (es/zh replies need it for agreement). These
 * carry across the user's own LIVING companions so nobody has to
 * introduce themselves five separate times.
 *
 * PRIVATE tier — who they love and how they're oriented. Stays in the
 * relationship it was shared in, full stop. Telling one companion
 * about your husband is not telling all of them.
 *
 * Neither tier crosses a SEALED row in either direction — see
 * fetchMemoryPolicy. Both tiers render in the "About them" block
 * rather than the per-oracle memories list, and they're what the
 * flirt-consent test keys off.
 */
const SHARED_IDENTITY_KEYS = ["goes_by", "pronouns", "gender"] as const;

const PRIVATE_IDENTITY_KEYS = [
  "orientation",
  "relationship_status",
  "spouse_name",
  "partner_name",
] as const;

/** Render order, and the exclusion list for the per-oracle block. */
const ABOUT_THEM_KEYS: readonly string[] = [
  ...SHARED_IDENTITY_KEYS,
  ...PRIVATE_IDENTITY_KEYS,
];

const ABOUT_THEM_KEY_SET = new Set<string>(ABOUT_THEM_KEYS);

/** Every identity key, exported so writers can refuse them. */
export const IDENTITY_MEMORY_KEYS: ReadonlySet<string> = ABOUT_THEM_KEY_SET;

/** The tier that never leaves the relationship it was shared in. */
export const PRIVATE_IDENTITY_MEMORY_KEYS: ReadonlySet<string> =
  new Set<string>(PRIVATE_IDENTITY_KEYS);

/**
 * A row is SEALED when it isn't a living relationship: a legacy
 * archive, an inherited copy, the user's own self-archive, or the
 * concierge. Sealed rows neither give identity facts to the user's
 * other companions nor receive them. A grandfather's archive must not
 * learn the visitor's partner's name because it was mentioned in
 * another room — and what someone says sitting with that archive must
 * not follow them out of it.
 *
 * The inherited test mirrors the stream route: inherited_at,
 * inherited_from_code_id and creation_source are stamped at different
 * points in the redeem flow, so any one of them counts.
 */
type SealFlags = {
  is_legacy: boolean | null;
  is_concierge: boolean | null;
  is_self_archive: boolean | null;
  inherited_at: string | null;
  inherited_from_code_id: string | null;
  creation_source: string | null;
};

const SEAL_COLUMNS =
  "is_legacy, is_concierge, is_self_archive, inherited_at, inherited_from_code_id, creation_source";

function sealedFromFlags(row: SealFlags | null | undefined): boolean {
  if (!row) return true;
  return (
    row.is_legacy === true ||
    row.is_concierge === true ||
    row.is_self_archive === true ||
    row.inherited_at != null ||
    row.inherited_from_code_id != null ||
    row.creation_source === "inherited"
  );
}

export type MemoryPolicy = { sealed: boolean; concierge: boolean };

/** Unknown row, or a lookup that failed: seal it. Fail CLOSED. */
const CLOSED_POLICY: MemoryPolicy = { sealed: true, concierge: false };

/**
 * What this oracle is allowed to do with identity memory. Never
 * throws; every failure path returns CLOSED_POLICY, because the cost
 * of wrongly sealing is one re-introduction and the cost of wrongly
 * opening is a dead relative reciting your partner's name.
 */
export async function fetchMemoryPolicy(
  oracleId: string,
): Promise<MemoryPolicy> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("oracles")
      .select(SEAL_COLUMNS)
      .eq("id", oracleId)
      .maybeSingle<SealFlags>();
    if (error) {
      console.error("[memory retrieve] seal lookup failed:", error);
      return CLOSED_POLICY;
    }
    if (!data) return CLOSED_POLICY;
    return {
      sealed: sealedFromFlags(data),
      concierge: data.is_concierge === true,
    };
  } catch (err) {
    console.error("[memory retrieve] seal lookup threw:", err);
    return CLOSED_POLICY;
  }
}

/**
 * Which rows the SHARED tier may pool across for this turn.
 *
 * A sealed room pools with nobody: it reads only what was said inside
 * it and never receives a fact from another relationship. An open room
 * pools with the user's other living companions.
 *
 * The current oracle is ALWAYS in the returned list, so a failed scan
 * collapses the pool to the current relationship rather than to
 * nothing. Losing the pool costs one re-introduction; returning an
 * empty list would make a companion forget the name of the person
 * sitting in front of it, which is the crueller failure.
 */
export async function fetchOpenOracleIds(
  userId: string,
  currentOracleId: string,
): Promise<string[]> {
  try {
    const policy = await fetchMemoryPolicy(currentOracleId);
    if (policy.sealed) return [currentOracleId];

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("oracles")
      .select(`id, ${SEAL_COLUMNS}`)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .limit(200);
    if (error || !data) {
      if (error) {
        console.error("[memory retrieve] open-oracle scan failed:", error);
      }
      return [currentOracleId];
    }
    const open = (data as Array<SealFlags & { id: string }>)
      .filter((row) => !sealedFromFlags(row))
      .map((row) => row.id);
    return open.includes(currentOracleId) ? open : [...open, currentOracleId];
  } catch (err) {
    console.error("[memory retrieve] open-oracle scan threw:", err);
    return [currentOracleId];
  }
}

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
      "\nThis is who you're talking to. Let it shape how you read them — don't recite it back, and don't tell them how you came to know it."
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
