import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Append more about a memory-mode identity. The user types a chunk
 * of new detail; we:
 *  1. Append it to the oracle's memory_seed (preserves the source)
 *  2. Extract durable memories from it into persona_memories so the
 *     chat persona starts using them right away
 *
 * Limited to oracles in mode='memory' owned by the caller.
 */

type MemoryRow = {
  kind: string;
  content: string;
  weight: number;
};

const VALID_KINDS = new Set([
  "fact",
  "relationship",
  "preference",
  "event",
  "topic",
  "feeling",
]);

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
  const admin = createAdminClient();
  const characterName = oracle.name ?? "they";

  const prompt = `The user is adding more detail to a memory-mode persona called ${characterName}. Extract durable memories about ${characterName} from the text below. Output a JSON array — empty if nothing's worth recording.

Each memory:
- kind: one of fact | relationship | preference | event | topic | feeling
- content: short, third-person ("loved sade", "married to Tom for 12 years", "dad died in 2009")
- weight: 0-1 (0.9 identity-defining, 0.5 important context, 0.2 worth knowing)

Schema:
[{"kind":"fact","content":"...","weight":0.8}]

Only JSON. No prose, no code fences.

NEW TEXT:
${text}`;

  let memories: MemoryRow[] = [];
  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 800,
      system:
        "You extract durable memories from text. You output ONLY a valid JSON array, never prose.",
      messages: [{ role: "user", content: prompt }],
    });
    const out = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const start = out.indexOf("[");
    const end = out.lastIndexOf("]");
    if (start !== -1 && end !== -1) {
      const parsed = JSON.parse(out.slice(start, end + 1)) as MemoryRow[];
      memories = parsed.filter(
        (m) =>
          m &&
          typeof m.content === "string" &&
          m.content.trim().length > 0 &&
          VALID_KINDS.has(m.kind) &&
          typeof m.weight === "number",
      );
    }
  } catch (err) {
    console.error("memory extraction failed:", err);
  }

  let inserted = 0;
  if (memories.length > 0) {
    const rows = memories.map((m) => ({
      user_id: user.id,
      oracle_id: oracleId,
      kind: m.kind,
      content: m.content.trim().slice(0, 500),
      weight: Math.max(0, Math.min(1, m.weight)),
    }));
    const { error } = await admin.from("persona_memories").insert(rows);
    if (!error) inserted = rows.length;
  }

  return NextResponse.json({
    ok: true,
    extracted: inserted,
    seed_length: nextSeed.length,
  });
}
