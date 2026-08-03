import { anthropic } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Memory extraction — formula v4.
 *
 * After each user message is persisted, a lightweight Claude call reads it
 * and pulls out durable facts worth remembering across sessions: names of
 * people who matter, birthdays, jobs, dreams, losses. Candidates are
 * upserted into persona_memories keyed by (oracle_id, user_id, key), so a
 * restated fact updates in place instead of duplicating.
 *
 * Fire-and-forget by design: the caller must NEVER await this on the reply
 * path's critical path. Failures are logged and swallowed — a missed
 * memory costs nothing; a blocked reply costs everything.
 */

export type Memory = {
  key: string;
  value: string;
  importance: number;
};

/** Allowed values for persona_memories.source (0060 check constraint). */
export type MemorySource = "user_stated" | "extracted" | "manual";

/**
 * Haiku-tier: extraction is a cheap classification-shaped task and runs on
 * every user message, so it gets the fastest, cheapest model rather than
 * the synthesis-tier Sonnet in ANTHROPIC_MODEL.
 */
const EXTRACTION_MODEL = "claude-haiku-4-5";

const EXTRACTION_SYSTEM = `You extract long-term memories from a single chat message a user sent to their AI companion.

A memory is a durable personal fact the companion should still know weeks from now:
- Who they are: the name they go by, pronouns, gender, orientation, relationship status
- People: spouse/partner name, kids' names and birthdays, close friends, pets
- Dates that matter: birthdays, anniversaries, the day someone died
- Life facts: job, where they live, health situations they're dealing with
- Ongoing threads: a dream they're chasing, a habit they're quitting, a big event coming up (interview, surgery, wedding)
- Losses and loves: who they've lost, what they care about most

Identity facts (pronouns, gender, orientation, relationship status) only when they state them outright or it's unmistakable in what they wrote ("my husband", "as a trans guy", "I'm single"). Never infer them from a single ambiguous signal — a name, a vibe, a topic. When unsure, skip.

NOT memories (return nothing for these): small talk, opinions about shows or food, moods of the moment, questions to the companion, anything about the companion itself, hypotheticals, trivia.

Keys are stable snake_case slugs so the same fact always lands on the same key: goes_by, pronouns, gender, orientation, relationship_status, spouse_name, partner_name, kid_1_name, kid_1_birthday, kid_2_name, job, employer, city, dream, pet_name, pet_2_name, mother_name, father_name, health_condition, quitting_habit, upcoming_event, lost_parent, wedding_anniversary, best_friend_name — invent a slug in that style when none of these fit.

Values are short plain-text statements ("Ana", "March 4th", "trying to quit smoking", "nervous about Friday's presentation").

Importance 1-10: 9-10 for people and deaths, 8-9 for who-they-are identity facts, 7-8 for birthdays/anniversaries/health, 5-6 for jobs and ongoing threads, 3-4 for softer context. Below 3, don't extract it.

Most messages contain NOTHING memorable. When in doubt, return an empty array. Never invent facts that are not explicitly in the message.`;

/**
 * Structured-output schema for any prompt that emits v4 memories.
 * Shared by per-turn extraction here, the weekly reflection cron, and
 * the identities memory-add route — one contract, one shape.
 */
export const MEMORY_JSON_SCHEMA = {
  type: "object",
  properties: {
    memories: {
      type: "array",
      description:
        "0-N durable facts from the message. Empty array when nothing qualifies.",
      items: {
        type: "object",
        properties: {
          key: {
            type: "string",
            description: "Stable snake_case slug, e.g. spouse_name",
          },
          value: {
            type: "string",
            description: "Short plain-text fact",
          },
          importance: {
            type: "integer",
            description: "1-10; see rubric",
          },
        },
        required: ["key", "value", "importance"],
        additionalProperties: false,
      },
    },
  },
  required: ["memories"],
  additionalProperties: false,
} as const;

/** Slug sanity: lowercase snake_case, bounded length. */
const KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;

function clampImportance(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n)));
}

/**
 * Validate + normalize raw model output into Memory rows: enforce the
 * slug regex, drop empty values, bound value length, clamp importance.
 * Shared by every v4 writer so a malformed candidate can never reach
 * the table from any of them.
 */
export function coerceMemories(candidates: unknown): Memory[] {
  if (!Array.isArray(candidates)) return [];
  return candidates
    .filter(
      (m): m is { key: string; value: string; importance: number } =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as { key?: unknown }).key === "string" &&
        KEY_RE.test((m as { key: string }).key) &&
        typeof (m as { value?: unknown }).value === "string" &&
        (m as { value: string }).value.trim().length > 0 &&
        typeof (m as { importance?: unknown }).importance === "number",
    )
    .map((m) => ({
      key: m.key,
      value: m.value.trim().slice(0, 500),
      importance: clampImportance(m.importance),
    }));
}

/**
 * Service-role upsert of v4 memories for an (oracle, user) pair. The 0060
 * unique index on (oracle_id, user_id, key) is the dedupe surface, so
 * re-running the same extraction (cron retry, double-submit) updates in
 * place instead of duplicating. Returns false on failure — callers treat
 * memory writes as best-effort and must not throw.
 */
export async function upsertMemories(
  oracleId: string,
  userId: string,
  memories: Memory[],
  source: MemorySource,
): Promise<boolean> {
  if (memories.length === 0) return true;
  const admin = createAdminClient();
  const { error } = await admin.from("persona_memories").upsert(
    memories.map((m) => ({
      oracle_id: oracleId,
      user_id: userId,
      key: m.key,
      value: m.value,
      importance: m.importance,
      source,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "oracle_id,user_id,key" },
  );
  if (error) {
    console.error("[memory upsert] failed:", error);
    return false;
  }
  return true;
}

/**
 * Extract memory candidates from one user message and upsert them for the
 * (oracle, user) pair. Returns the accepted memories (empty on no-op or
 * any failure — this function never throws).
 */
export async function extractMemoriesFromMessage(
  userMessage: string,
  oracleId: string,
  userId: string,
): Promise<Memory[]> {
  const trimmed = userMessage.trim();
  // Too short to carry a durable fact — skip the API call entirely.
  if (trimmed.length < 8) return [];

  try {
    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM,
      output_config: {
        format: { type: "json_schema", schema: MEMORY_JSON_SCHEMA },
      },
      messages: [{ role: "user", content: trimmed.slice(0, 4000) }],
    });

    if (response.stop_reason === "refusal") return [];

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return [];

    const parsed = JSON.parse(textBlock.text) as {
      memories?: Array<{ key: string; value: string; importance: number }>;
    };

    const memories = coerceMemories(parsed.memories);
    if (memories.length === 0) return [];

    const ok = await upsertMemories(oracleId, userId, memories, "extracted");
    return ok ? memories : [];
  } catch (err) {
    // Non-fatal by contract: the chat reply must ship regardless.
    console.error("[memory extract] extraction failed:", err);
    return [];
  }
}
