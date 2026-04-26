import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedText, toPgVector } from "@/lib/embeddings";
import type { MemoryKind } from "@/lib/memory";

export const runtime = "nodejs";

/**
 * Weekly reflection cron — Sundays 09:00 UTC.
 *
 * Per-turn extraction (in /api/chat) catches concrete facts: "her
 * daughter is named Maya," "he's allergic to penicillin." Reflection
 * catches the *higher-order patterns* — what's been on this person's
 * mind across many turns. The kind of thing a real person notices
 * when they think back over a week of conversations:
 *
 *   "Sarah has been preoccupied with her mother's diagnosis for the
 *    last three weeks, even when she doesn't bring it up directly."
 *
 *   "Mike keeps circling back to whether he should leave his job —
 *    he says he's decided, then walks it back, then comes back to it."
 *
 * Stored as memories with kind='topic' or 'feeling' and weight 0.8,
 * so they show up prominently in future conversations and the
 * persona feels like it's been *thinking about you* between sessions.
 */

const ONE_DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * ONE_DAY;
const BATCH = 30;
const MIN_TURNS_TO_REFLECT = 6; // skip relationships without enough recent activity

type ReflectionMemory = { kind: MemoryKind; content: string; weight: number };

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  const sevenAgo = new Date(startedAt - SEVEN_DAYS).toISOString();

  // Eligibility: profile not soft-deleted, not deceased, has an
  // active oracle, and has been active in the last week.
  const { data: candidates } = await admin
    .from("profiles")
    .select("id, oracle_name, active_oracle_id, preferred_language")
    .is("deleted_at", null)
    .is("deceased_at", null)
    .gte("last_active_at", sevenAgo)
    .not("active_oracle_id", "is", null)
    .limit(BATCH);

  let reflected = 0;
  const errors: string[] = [];

  for (const profile of candidates ?? []) {
    if (!profile.active_oracle_id) continue;
    try {
      // Pull the last week of messages for this (user, oracle).
      const { data: rows } = await admin
        .from("messages")
        .select("role, content, created_at")
        .eq("oracle_id", profile.active_oracle_id)
        .eq("user_id", profile.id)
        .gte("created_at", sevenAgo)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!rows || rows.length < MIN_TURNS_TO_REFLECT) continue;

      // Existing memories the persona already holds — feed them in so
      // the reflection writes new patterns, not duplicates.
      const { data: existingMemories } = await admin
        .from("persona_memories")
        .select("content")
        .eq("oracle_id", profile.active_oracle_id)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(80);

      const existingBlock =
        (existingMemories ?? []).map((m, i) => `${i + 1}. ${m.content}`).join(
          "\n",
        ) || "(none)";

      const transcript = rows
        .map(
          (m) =>
            `${m.role === "user" ? "Them" : profile.oracle_name ?? "You"}: ${m.content}`,
        )
        .join("\n");

      const prompt = `You are reflecting on a week of conversations between ${profile.oracle_name ?? "the persona"} and the person they're talking to. Your job: identify HIGHER-ORDER patterns worth remembering. Not concrete facts (those are already captured) — patterns. What has this person been preoccupied with? What do they keep returning to? What's the emotional weather of their week?

EXISTING MEMORIES (do not duplicate or paraphrase):
${existingBlock}

TRANSCRIPT (last week):
${transcript}

Return ONLY a JSON array of new high-order memories. Empty array if nothing notable. NO prose. Schema:
[{"kind": "topic", "content": "She's been quietly preoccupied with her mother's diagnosis — comes up obliquely even in unrelated conversations", "weight": 0.85}]

Use kind = "topic" for recurring themes, "feeling" for emotional patterns, "event" for one-off significant moments. Weight 0.7-0.9 for these higher-order memories (they should outrank concrete facts in retrieval). Prefer 0-3 high-quality patterns over many shallow ones. Skip anything that's just a restatement of an existing memory. NEVER record crisis content.`;

      const resp = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 800,
        system:
          "You extract durable higher-order memories from conversation transcripts. Output ONLY a valid JSON array, never prose.",
        messages: [{ role: "user", content: prompt }],
      });

      const text = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();

      const jsonStart = text.indexOf("[");
      const jsonEnd = text.lastIndexOf("]");
      if (jsonStart === -1 || jsonEnd === -1) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) continue;

      const reflections: ReflectionMemory[] = parsed
        .filter(
          (m): m is ReflectionMemory =>
            typeof m === "object" &&
            m !== null &&
            typeof (m as ReflectionMemory).content === "string" &&
            (m as ReflectionMemory).content.trim().length > 0 &&
            ["fact", "relationship", "preference", "event", "topic", "feeling"]
              .includes((m as ReflectionMemory).kind),
        )
        .filter(
          (m) => (typeof m.weight === "number" ? m.weight : 0.5) >= 0.5,
        );

      if (reflections.length === 0) continue;

      const memoryRows = await Promise.all(
        reflections.map(async (m) => {
          const content = m.content.trim();
          const vec = await embedText(content);
          return {
            oracle_id: profile.active_oracle_id,
            user_id: profile.id,
            kind: m.kind,
            content,
            weight: Math.min(1, Math.max(0.5, m.weight ?? 0.7)),
            embedding: vec ? toPgVector(vec) : null,
          };
        }),
      );

      await admin.from("persona_memories").insert(memoryRows);
      reflected++;
    } catch (err) {
      errors.push(
        `${profile.id}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  await admin.from("cron_runs").insert({
    job: "reflect",
    processed: reflected,
    duration_ms: Date.now() - startedAt,
    status: errors.length > 0 ? "error" : "ok",
    error: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
  });

  return NextResponse.json({ reflected, errors });
}
