import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAnthropicSpend } from "@/lib/spendGovernor";
import {
  MEMORY_JSON_SCHEMA,
  coerceMemories,
  upsertMemories,
} from "@/lib/memory/extract";

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
 * Stored in the formula-v4 persona_memories shape (key/value/importance,
 * upserted on stable slug keys like `current_preoccupation`), importance
 * 7-9 so they surface prominently in retrieval and the persona feels
 * like it's been *thinking about you* between sessions. Because keys
 * are stable, next week's reflection on the same thread updates the
 * row in place instead of piling up duplicates.
 */

const ONE_DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * ONE_DAY;
const BATCH = 30;
const MIN_TURNS_TO_REFLECT = 6; // skip relationships without enough recent activity

/** Reflections should outrank concrete facts; drop anything weaker. */
const MIN_REFLECTION_IMPORTANCE = 5;

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
      // Pull the last week of messages for this (user, oracle). Skip
      // soft-deleted rows so the reflection doesn't learn from what the
      // user asked to forget.
      const { data: rows } = await admin
        .from("messages")
        .select("role, content, created_at")
        .eq("oracle_id", profile.active_oracle_id)
        .eq("user_id", profile.id)
        .is("deleted_at", null)
        .gte("created_at", sevenAgo)
        .order("created_at", { ascending: true })
        .limit(200);

      if (!rows || rows.length < MIN_TURNS_TO_REFLECT) continue;

      // Existing memories the persona already holds — feed them in so
      // the reflection writes new patterns, not duplicates.
      const { data: existingMemories } = await admin
        .from("persona_memories")
        .select("key, value")
        .eq("oracle_id", profile.active_oracle_id)
        .eq("user_id", profile.id)
        .order("importance", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(80);

      // Defense-in-depth scrub — user-derived strings that get
      // interpolated into a model prompt (even in the user role) can
      // otherwise carry `==` / underscore runs that forge headers or
      // dominate framing. Same pattern retrieve.ts / residue.ts /
      // outreach.ts apply. Cheap; never worse than a no-op.
      const scrub = (v: string) =>
        v.replace(/\s+/g, " ").replace(/[=_*#`]{2,}/g, " ").trim();
      const existingBlock =
        (existingMemories ?? [])
          .map((m) => `- ${m.key}: ${scrub(String(m.value ?? ""))}`)
          .join("\n") || "(none)";

      const transcript = rows
        .map(
          (m) =>
            `${m.role === "user" ? "Them" : profile.oracle_name ?? "You"}: ${scrub(String(m.content ?? ""))}`,
        )
        .join("\n");

      const prompt = `You are reflecting on a week of conversations between ${profile.oracle_name ?? "the persona"} and the person they're talking to. Your job: identify HIGHER-ORDER patterns worth remembering. Not concrete facts (those are already captured) — patterns. What has this person been preoccupied with? What do they keep returning to? What's the emotional weather of their week?

EXISTING MEMORIES (do not duplicate or paraphrase; if a pattern continues an existing one, reuse its exact key so it updates in place):
${existingBlock}

TRANSCRIPT (last week):
${transcript}

Return 0-3 high-quality patterns; empty when nothing notable. Each memory:
- key: a stable snake_case slug that names the THREAD, not the week — e.g. current_preoccupation, recurring_theme, ongoing_decision, emotional_pattern, upcoming_event — invent one in that style when none fit. Same thread next week must land on the same key.
- value: one short plain-text sentence, e.g. "quietly preoccupied with her mother's diagnosis — comes up obliquely even in unrelated conversations"
- importance: 7-9 (these should outrank concrete facts in retrieval)

Skip anything that's just a restatement of an existing memory. NEVER record crisis content.`;

      const resp = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 800,
        system:
          "You extract durable higher-order memories from conversation transcripts.",
        output_config: {
          format: { type: "json_schema", schema: MEMORY_JSON_SCHEMA },
        },
        messages: [{ role: "user", content: prompt }],
      });

      void recordAnthropicSpend({
        userId: profile.id,
        model: ANTHROPIC_MODEL,
        usage: resp.usage as unknown as Parameters<
          typeof recordAnthropicSpend
        >[0]["usage"],
        route: "cron_reflect",
      });

      if (resp.stop_reason === "refusal") continue;

      const textBlock = resp.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") continue;

      let parsed: { memories?: unknown };
      try {
        parsed = JSON.parse(textBlock.text) as { memories?: unknown };
      } catch {
        continue;
      }

      const reflections = coerceMemories(parsed.memories).filter(
        (m) => m.importance >= MIN_REFLECTION_IMPORTANCE,
      );
      if (reflections.length === 0) continue;

      const ok = await upsertMemories(
        profile.active_oracle_id,
        profile.id,
        reflections,
        "extracted",
      );
      if (!ok) {
        errors.push(`${profile.id}: memory upsert failed`);
        continue;
      }
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
