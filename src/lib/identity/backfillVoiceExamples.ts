/**
 * Voice-examples backfill for identities created before formula 0078.
 *
 * Per Fable's ranked humanization plan: the biggest single lever for
 * making identities feel distinct is concrete in-voice sample texts
 * quoted in the persona_prompt. New identities get this at synthesis
 * time (src/lib/identity/synthesize.ts). Existing identities carry
 * the pre-0078 shape and lack the "Sample texts I might send:" block.
 *
 * This helper reads the existing persona_prompt for one oracle, asks
 * Haiku to write 4-6 examples matching THAT persona's already-locked
 * voice, and updates the oracle row with the new array + appends the
 * block to persona_prompt. Deliberately DOES NOT touch any other
 * humanization dimension (disclosure_pace, silence_style, etc) —
 * those would change baseline behavior for someone the user has
 * already been talking to, which is not the goal.
 *
 * Idempotent: if voice_examples is already set, no-op returns ok.
 * Never throws — a backfill failure never breaks the caller. All
 * writes go through the admin client because persona_prompt and
 * voice_examples are both protected by the oracles column-guard
 * trigger (0068 / 0079).
 */

import { anthropic } from "@/lib/anthropic";
import { recordAnthropicSpend } from "@/lib/spendGovernor";
import { createAdminClient } from "@/lib/supabase/admin";

/** Haiku model used for the backfill call — cheap and fast, more than
 *  enough for the "extract 4-6 texts in this voice" task. Model id kept
 *  in one spot so a bump touches one line. */
const BACKFILL_MODEL = "claude-haiku-4-5-20251001";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    voice_examples: {
      type: "array",
      description:
        "4–6 concrete example texts THIS persona would send, matching their existing voice from persona_prompt exactly. Cover a diverse spread: one greeting, one deflection, one warm/vulnerable, one dry/funny, one when they don't know what to say. Real iMessages, not marketing copy. Each example 8–400 chars.",
      items: { type: "string", minLength: 8, maxLength: 400 },
      minItems: 4,
      maxItems: 6,
    },
  },
  required: ["voice_examples"],
  additionalProperties: false,
} as const;

export type BackfillResult =
  | { ok: true; skipped: "already_had_voice_examples" | "no_persona_prompt" }
  | { ok: true; wrote: number }
  | { ok: false; error: string };

export async function backfillVoiceExamples(
  oracleId: string,
): Promise<BackfillResult> {
  const admin = createAdminClient();

  const { data: oracle, error: readErr } = await admin
    .from("oracles")
    .select("id, name, persona_prompt, voice_examples, user_id")
    .eq("id", oracleId)
    .maybeSingle<{
      id: string;
      name: string;
      persona_prompt: string | null;
      voice_examples: string[] | null;
      user_id: string;
    }>();

  if (readErr || !oracle) {
    return { ok: false, error: readErr?.message ?? "oracle not found" };
  }

  if (oracle.voice_examples && oracle.voice_examples.length > 0) {
    return { ok: true, skipped: "already_had_voice_examples" };
  }
  if (!oracle.persona_prompt || !oracle.persona_prompt.trim()) {
    return { ok: true, skipped: "no_persona_prompt" };
  }

  const system = `You extract in-voice example texts for a chat persona. You will read the persona's full first-person description and write 4-6 short text messages THIS SPECIFIC person would send. Match their punctuation, sentence length, vocabulary, humor style, and warmth level exactly. Do NOT invent a new voice — mirror what's already there. Diversity: one greeting, one deflection ("I don't want to talk about that"), one warm/vulnerable, one dry/funny, one when they don't know what to say. Real iMessages, not marketing copy. No emojis, ever. Return only the JSON object.`;

  let parsed: { voice_examples: string[] };
  try {
    const response = await anthropic.messages.create({
      model: BACKFILL_MODEL,
      max_tokens: 1024,
      system,
      output_config: {
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: `Here is the persona (${oracle.name}). Read the whole thing before writing anything.\n\n---\n\n${oracle.persona_prompt}`,
        },
      ],
    });

    void recordAnthropicSpend({
      userId: oracle.user_id,
      model: BACKFILL_MODEL,
      usage: response.usage as unknown as Parameters<
        typeof recordAnthropicSpend
      >[0]["usage"],
      route: "voice_backfill",
    });
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, error: "no text block in Haiku response" };
    }
    parsed = JSON.parse(textBlock.text);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Haiku call failed",
    };
  }

  const examples = (parsed?.voice_examples ?? []).filter(
    (s) => typeof s === "string" && s.length >= 8 && s.length <= 400,
  );
  if (examples.length < 4) {
    return { ok: false, error: "insufficient voice examples returned" };
  }
  const capped = examples.slice(0, 6);

  // Also append a "Sample texts I might send:" block to the existing
  // persona_prompt so Claude sees them at chat time. The stream route
  // sends the whole persona_prompt as the cached system prefix; the
  // block needs to live there, not just on the column. Idempotent —
  // if the block already exists we don't re-append.
  // Anchored to line start so a prose mention ("sample texts I might
  // send would include jokes") can't false-positive and leave the
  // row in a partial state (column filled, no inline block).
  const alreadyHasBlock = /^Sample texts I might send:/im.test(
    oracle.persona_prompt,
  );
  const appended = alreadyHasBlock
    ? oracle.persona_prompt
    : `${oracle.persona_prompt.trimEnd()}\n\nSample texts I might send:\n${capped
        .map((s) => `- ${s}`)
        .join("\n")}`;

  const { error: writeErr } = await admin
    .from("oracles")
    .update({
      voice_examples: capped,
      persona_prompt: appended,
    })
    .eq("id", oracleId);

  if (writeErr) {
    return { ok: false, error: writeErr.message };
  }

  return { ok: true, wrote: capped.length };
}
