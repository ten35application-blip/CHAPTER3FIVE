import { anthropic, ANTHROPIC_MODEL } from "./anthropic";
import { createAdminClient } from "./supabase/admin";

export type MemoryKind =
  | "fact"
  | "relationship"
  | "preference"
  | "event"
  | "topic"
  | "feeling";

export type PersonaMemory = {
  id: string;
  kind: MemoryKind;
  content: string;
  weight: number;
  last_referenced_at: string | null;
};

const MEMORIES_FOR_PROMPT = 25;
const MAX_TOTAL_MEMORIES_PER_RELATIONSHIP = 200;

/**
 * Pull the most-relevant memories for a (oracle, user) relationship to
 * inject into the system prompt. Ordered by weight (importance) then
 * recency. Capped so the prompt doesn't balloon.
 */
export async function loadMemoriesForPrompt(
  oracleId: string,
  userId: string,
): Promise<PersonaMemory[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("persona_memories")
    .select("id, kind, content, weight, last_referenced_at")
    .eq("oracle_id", oracleId)
    .eq("user_id", userId)
    .order("weight", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MEMORIES_FOR_PROMPT);

  return (data ?? []) as PersonaMemory[];
}

/**
 * Format memories into a system-prompt block. Returns "" if none — caller
 * just concatenates.
 */
export function memoriesToPromptBlock(
  memories: PersonaMemory[],
  characterName: string,
  language: "en" | "es",
): string {
  if (memories.length === 0) return "";

  const grouped: Record<MemoryKind, string[]> = {
    fact: [],
    relationship: [],
    preference: [],
    event: [],
    topic: [],
    feeling: [],
  };
  for (const m of memories) {
    grouped[m.kind].push(m.content);
  }

  const sections: string[] = [];
  if (grouped.fact.length)
    sections.push(`Facts about them:\n- ${grouped.fact.join("\n- ")}`);
  if (grouped.relationship.length)
    sections.push(`People in their life:\n- ${grouped.relationship.join("\n- ")}`);
  if (grouped.event.length)
    sections.push(`Things that happened:\n- ${grouped.event.join("\n- ")}`);
  if (grouped.feeling.length)
    sections.push(`How they feel about things:\n- ${grouped.feeling.join("\n- ")}`);
  if (grouped.preference.length)
    sections.push(`What they like and don't like:\n- ${grouped.preference.join("\n- ")}`);
  if (grouped.topic.length)
    sections.push(`What you've been talking about:\n- ${grouped.topic.join("\n- ")}`);

  const header =
    language === "es"
      ? `\n\nLO QUE RECUERDAS sobre la persona con quien hablas — esto persiste entre conversaciones, incluso si los mensajes se borran. Trátalo como conocimiento real. Refiérete naturalmente, no lo recites.\n\n`
      : `\n\nWHAT YOU REMEMBER about the person you're talking to — this persists across conversations, even if messages get deleted. Treat it as real knowledge. Reference naturally, don't recite it back at them.\n\n`;

  return header + sections.join("\n\n");
}

/**
 * After a chat exchange, send the recent turn(s) to Claude with a small
 * extraction prompt. Asks for structured memories worth keeping. Stores
 * what comes back. Fire-and-forget from /api/chat — failure here doesn't
 * affect the user's reply.
 *
 * To keep latency + cost down, this only runs every Nth message
 * (controlled by caller). Skips if the recent text is trivial (< 20 chars).
 */
export async function extractAndStoreMemories(opts: {
  oracleId: string;
  userId: string;
  characterName: string;
  language: "en" | "es";
  recentTurns: { role: "user" | "assistant"; content: string }[];
}): Promise<void> {
  const userTurnsText = opts.recentTurns
    .filter((t) => t.role === "user")
    .map((t) => t.content)
    .join("\n");
  if (userTurnsText.trim().length < 20) return;

  const admin = createAdminClient();

  // Load existing memories so we don't ask the extractor to re-record
  // things we already know.
  const { data: existing } = await admin
    .from("persona_memories")
    .select("content")
    .eq("oracle_id", opts.oracleId)
    .eq("user_id", opts.userId)
    .order("created_at", { ascending: false })
    .limit(50);
  const existingContent = (existing ?? [])
    .map((m, i) => `${i + 1}. ${m.content}`)
    .join("\n");

  const transcript = opts.recentTurns
    .map((t) => `${t.role === "user" ? "Them" : opts.characterName}: ${t.content}`)
    .join("\n");

  const extractorPrompt = `You are extracting memories for a persona called ${opts.characterName} who is having an ongoing relationship with a person. Your job: identify NEW things from this transcript that are worth ${opts.characterName} remembering for future conversations. These memories persist even if the conversation messages are later deleted.

EXISTING MEMORIES (don't re-record these or paraphrases of them):
${existingContent || "(none yet)"}

RECENT TRANSCRIPT:
${transcript}

Extract NEW memories only. For each, choose a kind:
- fact: a stable truth ("their daughter is named Maya", "they live in Brooklyn")
- relationship: a person in their life ("married to Tom for 12 years", "best friend Lucy")
- preference: what they like / hate ("hates small talk", "loves bourbon old fashioneds")
- event: something that happened ("dad died last year", "got the job at Pixar")
- topic: a recurring theme worth tracking ("worried about her mom's health")
- feeling: how they feel about something ("ambivalent about moving back home")

Return ONLY a JSON array. Empty array if nothing new is worth recording. NO prose, NO markdown, NO code fences. Schema:
[{"kind": "fact", "content": "their daughter is named Maya, born March 2024", "weight": 0.9}]

Weight 0-1: 0.9+ identity-defining; 0.5-0.8 important context; 0.2-0.4 worth knowing; under 0.2 don't record. Skip anything trivial, transient, or already known. Prefer 0-3 high-quality memories over many shallow ones. NEVER record crisis content or anything the person seemed to share in confidence about hurting themselves.`;

  let extracted: { kind: MemoryKind; content: string; weight: number }[] = [];
  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
      system:
        "You extract durable memories from conversation transcripts. You output ONLY a valid JSON array, never prose.",
      messages: [{ role: "user", content: extractorPrompt }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const jsonStart = text.indexOf("[");
    const jsonEnd = text.lastIndexOf("]");
    if (jsonStart === -1 || jsonEnd === -1) return;
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
    if (!Array.isArray(parsed)) return;
    extracted = parsed
      .filter(
        (m): m is { kind: MemoryKind; content: string; weight: number } =>
          typeof m === "object" &&
          m !== null &&
          typeof m.content === "string" &&
          m.content.trim().length > 0 &&
          [
            "fact",
            "relationship",
            "preference",
            "event",
            "topic",
            "feeling",
          ].includes(m.kind),
      )
      .filter((m) => (typeof m.weight === "number" ? m.weight : 0.5) >= 0.2);
  } catch (err) {
    console.error("memory extraction failed:", err);
    return;
  }

  if (extracted.length === 0) return;

  const rows = extracted.map((m) => ({
    oracle_id: opts.oracleId,
    user_id: opts.userId,
    kind: m.kind,
    content: m.content.trim(),
    weight: Math.min(1, Math.max(0.2, m.weight ?? 0.5)),
  }));

  await admin.from("persona_memories").insert(rows);

  // Cap total memories per relationship: drop lowest-weight oldest if
  // we exceed the cap. Quick to compute, prevents unbounded growth.
  const { count } = await admin
    .from("persona_memories")
    .select("id", { count: "exact", head: true })
    .eq("oracle_id", opts.oracleId)
    .eq("user_id", opts.userId);

  const overage = (count ?? 0) - MAX_TOTAL_MEMORIES_PER_RELATIONSHIP;
  if (overage > 0) {
    const { data: prunable } = await admin
      .from("persona_memories")
      .select("id")
      .eq("oracle_id", opts.oracleId)
      .eq("user_id", opts.userId)
      .order("weight", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(overage);
    const ids = (prunable ?? []).map((r) => r.id);
    if (ids.length > 0) {
      await admin.from("persona_memories").delete().in("id", ids);
    }
  }
}
