import { NextResponse, type NextRequest } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAnthropicSpend } from "@/lib/spendGovernor";
import { startCronBudget } from "@/lib/cron/budget";
import {
  MEMORY_JSON_SCHEMA,
  coerceMemories,
  upsertMemories,
} from "@/lib/memory/extract";

export const runtime = "nodejs";
// Literal, not the shared constant: Next reads segment config
// statically, so an imported value fails the build with
// "Invalid segment configuration export detected". Keep in sync
// with CRON_MAX_DURATION in lib/cron/budget.ts.
export const maxDuration = 300;

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
  const budget = startCronBudget(startedAt);
  let skippedForTime = 0;
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

  // One reflection per COMPANION, not one per user. This loop used to
  // read profile.active_oracle_id, so whichever thread the person
  // happened to open last was the only relationship that got thought
  // about all week — every other companion they have went blank while
  // that one kept deepening. Expand each candidate into one job per
  // living companion. The concierge is excluded: Adrian is support, he
  // doesn't reflect on you, and he's one shared row owned by an
  // operator account (so user_id alone wouldn't filter him out of that
  // operator's own run).
  //
  // Same "live thread" filter set persona-outreach already uses: not
  // deleted, not mid-provisioning, conversation not archived, not
  // blocked. Reflection is billed to the owner via chat_spend_events,
  // and sumMonthlySpendCents counts every route against the free
  // monthly cap — so a shelved or blocked thread must not quietly eat
  // someone's chat allowance.
  //
  // Field names deliberately match the old profile shape so the body
  // below is unchanged; `active_oracle_id` here means "the companion
  // this job reflects on".
  type ReflectJob = {
    id: string;
    oracle_name: string | null;
    active_oracle_id: string;
    preferred_language: string | null;
  };
  const perUser: ReflectJob[][] = [];
  for (const profile of candidates ?? []) {
    const { data: oracleRows } = await admin
      .from("oracles")
      .select("id, name")
      .eq("user_id", profile.id)
      .eq("is_concierge", false)
      .eq("provisioning", false)
      .is("deleted_at", null)
      .is("conversation_archived_at", null)
      .is("blocked_at", null)
      .order("created_at", { ascending: true })
      .limit(25);
    const forUser: ReflectJob[] = [];
    for (const o of oracleRows ?? []) {
      forUser.push({
        id: profile.id,
        // This companion's own name, not the profile-level legacy
        // field — the prompt speaks as this persona, so a multi-
        // companion user was previously getting reflections written
        // in the wrong one's voice.
        oracle_name: o.name ?? profile.oracle_name ?? null,
        active_oracle_id: o.id,
        preferred_language: profile.preferred_language ?? null,
      });
    }
    if (forUser.length > 0) perUser.push(forUser);
  }

  // Interleave round-robin instead of grouping user-by-user. This job
  // stops at the 240s budget, and one Sonnet reflection per companion
  // is seconds each — grouped, a truncated run gave the first few
  // people every companion and everyone after them nothing, which is
  // worse than the one-each they got before. Round-robin means nobody
  // gets a second reflection until everybody has had a first.
  const jobs: ReflectJob[] = [];
  const deepest = perUser.reduce((n, u) => Math.max(n, u.length), 0);
  for (let i = 0; i < deepest; i++) {
    for (const u of perUser) {
      if (i < u.length) jobs.push(u[i]);
    }
  }

  let reflected = 0;
  const errors: string[] = [];

  for (const profile of jobs) {
    // Stop on our own terms rather than being killed mid-loop. See
    // lib/cron/budget.ts — a truncated run used to write no heartbeat
    // at all, so nobody could tell it had been cut short.
    if (budget.exhausted()) {
      skippedForTime++;
      continue;
    }
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

  return NextResponse.json({ reflected, errors, skippedForTime });
}
