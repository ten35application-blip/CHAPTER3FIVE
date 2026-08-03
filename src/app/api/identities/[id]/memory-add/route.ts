import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import {
  MEMORY_JSON_SCHEMA,
  coerceMemories,
  upsertMemories,
} from "@/lib/memory/extract";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Append more about a memory-mode identity. The user types a chunk
 * of new detail; we:
 *  1. Append it to the oracle's memory_seed (preserves the source)
 *  2. Extract durable memories from it into persona_memories (formula-v4
 *     key/value/importance shape, upserted on stable slug keys) so the
 *     chat persona starts using them right away
 *
 * Limited to oracles in mode='memory' owned by the caller.
 */

const MIN_CHARS = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: oracleId } = await params;

  let body: { text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const text = String(body.text ?? "").trim();
  if (text.length < MIN_CHARS) {
    return NextResponse.json(
      { error: `Need at least ${MIN_CHARS} characters.` },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, mode, user_id, memory_seed")
    .eq("id", oracleId)
    .maybeSingle();
  if (!oracle || oracle.user_id !== user.id) {
    return NextResponse.json({ error: "Not your identity" }, { status: 404 });
  }
  if (oracle.mode !== "memory") {
    return NextResponse.json(
      { error: "Only memory-mode identities can be augmented this way." },
      { status: 400 },
    );
  }

  // Append to seed with a separator so we preserve chronology.
  const stamp = new Date().toISOString().slice(0, 10);
  const nextSeed = [
    oracle.memory_seed ?? "",
    `\n\n---\n[added ${stamp}]\n${text}`,
  ]
    .join("")
    .slice(0, 60_000);

  await supabase
    .from("oracles")
    .update({ memory_seed: nextSeed })
    .eq("id", oracleId)
    .eq("user_id", user.id);

  // Extract durable memories from the new chunk via Claude.
  const characterName = oracle.name ?? "they";

  const prompt = `The user is adding more detail to a memory-mode persona called ${characterName}. Extract durable memories about ${characterName} from the text below — the kind of facts ${characterName} should still know about themselves weeks from now. Return an empty array if nothing's worth recording.

Each memory:
- key: a stable snake_case slug so the same fact always lands on the same key — e.g. spouse_name, kid_1_name, job, city, lost_parent, favorite_music, health_condition, best_friend_name — invent a slug in that style when none of these fit
- value: a short plain-text statement ("loved Sade", "married to Tom for 12 years", "dad died in 2009")
- importance: 1-10 — 9-10 for people and deaths, 7-8 for birthdays/anniversaries/health, 5-6 for jobs and ongoing threads, 3-4 for softer context; below 3, don't extract it

NEW TEXT:
${text}`;

  let inserted = 0;
  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system: "You extract durable memories from text.",
      output_config: {
        format: { type: "json_schema", schema: MEMORY_JSON_SCHEMA },
      },
      messages: [{ role: "user", content: prompt }],
    });
    if (resp.stop_reason !== "refusal") {
      const textBlock = resp.content.find((b) => b.type === "text");
      if (textBlock && textBlock.type === "text") {
        const parsed = JSON.parse(textBlock.text) as { memories?: unknown };
        const memories = coerceMemories(parsed.memories);
        if (memories.length > 0) {
          const ok = await upsertMemories(
            oracleId,
            user.id,
            memories,
            "user_stated",
          );
          if (ok) inserted = memories.length;
        }
      }
    }
  } catch (err) {
    console.error("memory extraction failed:", err);
  }

  return NextResponse.json({
    ok: true,
    extracted: inserted,
    seed_length: nextSeed.length,
  });
}
