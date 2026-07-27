/**
 * Fable humanization #5 — session emotional residue.
 *
 * On every chat turn's after() block, quickly classify the emotional
 * temperature of the recent exchange in one short phrase, and stash
 * it under a reserved key on persona_memories. At the next chat load
 * the stream route reads it back and injects "== Since last time ==\n
 * Our last chat ended {residue}." so the persona opens the next
 * session carrying some emotional continuity — the residue a real
 * friend would carry from Tuesday's conversation into Wednesday's.
 *
 * Reserved key is prefixed with '_' so the retrieve.ts render pass
 * can filter it out of the "What I know about you" block — it's a
 * separate signal, not a fact about the user.
 */

import { anthropic } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";

const RESIDUE_KEY = "_session_residue";
const RESIDUE_MODEL = "claude-haiku-4-5-20251001";
const MAX_RESIDUE_CHARS = 200;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    residue: {
      type: "string",
      description:
        "One short phrase describing the emotional temperature the exchange ends on. Examples: 'warm, easy', 'tense and unresolved', 'tender, they were vulnerable', 'light banter', 'heavy — grief came up'. Under 20 words.",
      minLength: 3,
      maxLength: 200,
    },
  },
  required: ["residue"],
  additionalProperties: false,
} as const;

export type TurnForResidue = { role: "user" | "assistant"; content: string };

/**
 * Extract + persist residue for one exchange. Never throws — fires
 * from after() and a failure just skips the residue for this turn.
 * Idempotent overwrite: latest residue wins. Cheap Haiku call.
 */
export async function extractAndSaveResidue(
  oracleId: string,
  userId: string,
  turns: TurnForResidue[],
): Promise<void> {
  const recent = turns.slice(-6);
  if (recent.length < 2) return;

  const transcript = recent
    .map((t) => `${t.role === "user" ? "USER" : "PERSONA"}: ${t.content}`)
    .join("\n");

  try {
    const response = await anthropic.messages.create({
      model: RESIDUE_MODEL,
      max_tokens: 200,
      system:
        "You classify the emotional temperature of a chat exchange in one short phrase. NOT a summary of what was said — an emotional read of where they left it. Return only the JSON object.",
      output_config: {
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      messages: [{ role: "user", content: transcript }],
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return;
    let parsed: { residue?: unknown };
    try {
      parsed = JSON.parse(textBlock.text);
    } catch {
      return;
    }
    const residue =
      typeof parsed.residue === "string"
        ? parsed.residue.trim().slice(0, MAX_RESIDUE_CHARS)
        : "";
    if (!residue) return;

    const admin = createAdminClient();
    await admin.from("persona_memories").upsert(
      {
        oracle_id: oracleId,
        user_id: userId,
        key: RESIDUE_KEY,
        value: residue,
        importance: 0, // never surfaces in the top-N memory retrieval
        updated_at: new Date().toISOString(),
      },
      { onConflict: "oracle_id,user_id,key" },
    );
  } catch (err) {
    console.warn("[residue] extract failed:", err);
  }
}

/**
 * Fetch the most recent residue for this pair, if any. Rendered by the
 * stream route as a separate "== Since last time ==" block, above the
 * memory block, so the persona opens the session carrying the last
 * exchange's temperature.
 */
export async function fetchResidueBlock(
  oracleId: string,
  userId: string,
): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("persona_memories")
      .select("value")
      .eq("oracle_id", oracleId)
      .eq("user_id", userId)
      .eq("key", RESIDUE_KEY)
      .maybeSingle<{ value: string }>();
    if (!data?.value) return "";
    return `== Since last time ==\nOur last chat ended: ${data.value}. If they open with something light, meet them there — don't force a callback. If they seem to want to pick up where you left off, do.`;
  } catch {
    return "";
  }
}

export const RESIDUE_MEMORY_KEY = RESIDUE_KEY;
