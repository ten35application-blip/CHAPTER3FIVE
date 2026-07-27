import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  coerceTextFirstFrequency,
  DEFAULT_TEXT_FIRST_FREQUENCY,
} from "@/lib/identity/formula";
import { detectCrisis } from "@/lib/crisis";
import { moderateText } from "@/lib/moderation";
import { moodOfTheDay, moodToPromptBlock } from "@/lib/identity/mood";
import { sendWebPushToUser } from "@/lib/webPush";

/**
 * Hourly persona-outreach worker. For each opted-in user we pick at
 * most ONE identity to reach out first from — the one with the biggest
 * pull relative to its own text-first-frequency threshold. Distinct
 * from /api/cron/proactive (daily, single active oracle) — this
 * worker is per-persona-tuned and drives the push-notification loop.
 *
 * Throttles:
 *   - Skip user if any user-sent message in the last 48h (they're
 *     already conversing; a nudge would be spammy).
 *   - Skip user if ANY persona reached out for them in the last 24h.
 *   - Per-persona: silence >= (28 - textFirstFrequency*2.5) days AND
 *     THIS persona hasn't reached out in the last (threshold) days.
 *
 * Local-time gate: 8am–10pm in the user's tz (falls back to a 10am–8pm
 * UTC window when the profile has no timezone).
 *
 * Auth: CRON_SECRET Bearer, matching the sibling crons.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MIN_HOUR_LOCAL = 8;
const MAX_HOUR_LOCAL = 22; // exclusive — sends between 8:00 and 21:59
const FALLBACK_MIN_HOUR_UTC = 10;
const FALLBACK_MAX_HOUR_UTC = 20;
const BATCH_LIMIT = 200;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  const now = new Date(startedAt);

  // Candidate users: opted in, onboarded, alive, undeleted, with a push
  // subscription (no point pinging someone who won't hear it). Batch-
  // limit so we don't burn through Anthropic in a single hour.
  const { data: candidates, error } = await admin
    .from("profiles")
    .select("id, preferred_language, timezone, push_subscription, oracle_name")
    .eq("outreach_enabled", true)
    .eq("onboarding_completed", true)
    .is("deceased_at", null)
    .is("deleted_at", null)
    .not("push_subscription", "is", null)
    .limit(BATCH_LIMIT);

  if (error) {
    await admin.from("cron_runs").insert({
      job: "persona_outreach",
      status: "error",
      error: error.message,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    await admin.from("cron_runs").insert({
      job: "persona_outreach",
      processed: 0,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  const nowIso = now.toISOString();
  const sixHoursAgo = new Date(startedAt - 6 * HOUR).toISOString();
  const fortyEightAgo = new Date(startedAt - 48 * HOUR).toISOString();
  const twentyFourAgo = new Date(startedAt - 24 * HOUR).toISOString();

  for (const profile of candidates) {
    try {
      // Local-time gate.
      if (!withinLocalWindow(now, profile.timezone as string | null)) continue;

      // User-recency gate. Fable humanization #2 opened the window:
      // the fresh-memory-callback pathway wants users whose last
      // message was 6-48h ago (recent enough for a callback to feel
      // natural, quiet enough not to interrupt an active chat). So
      // we skip only if user chatted in the LAST 6 HOURS. Long-
      // silence outreach still fires for users who've been quiet
      // for days — the eligibility scoring below sorts both pathways
      // into one queue and picks the best-fitting oracle.
      const { count: veryRecentUserMsgCount } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("role", "user")
        .is("deleted_at", null)
        .gte("created_at", sixHoursAgo);
      if ((veryRecentUserMsgCount ?? 0) > 0) continue;

      // Fresh-callback window: the user's most recent USER message
      // 6-48h old. If present, this drives a persona to say "earlier
      // when you said…" — much more human than a cold "hey stranger."
      // Empty for users who've been silent longer than 48h; those
      // still qualify for the long-silence pathway below.
      const { data: freshTurn } = await admin
        .from("messages")
        .select("id, oracle_id, content, created_at")
        .eq("user_id", profile.id)
        .eq("role", "user")
        .is("deleted_at", null)
        .gte("created_at", fortyEightAgo)
        .lte("created_at", sixHoursAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      // If the source turn tripped our crisis detector, DO NOT frame
      // a chirpy "earlier when you said…" callback around it. A
      // callback would re-surface a crisis moment in casual-chat
      // framing, which is exactly what we don't want. Falling back to
      // null lets the outreach either use long-silence framing on a
      // different oracle or skip this user entirely for the day —
      // both are safer than a warm-toned callback to a crisis line.
      // Also cap the injected payload at 500 chars so a prompt-
      // injection attempt in the source can't dominate the prompt.
      const freshCallback =
        freshTurn &&
        typeof freshTurn.oracle_id === "string" &&
        typeof freshTurn.content === "string" &&
        freshTurn.content.trim().length >= 40 &&
        !detectCrisis(freshTurn.content).triggered
          ? {
              oracleId: freshTurn.oracle_id as string,
              text: freshTurn.content.slice(0, 500),
            }
          : null;

      // Any-persona-24h gate.
      const { count: recentOutreachCount } = await admin
        .from("persona_outreach_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .gte("sent_at", twentyFourAgo);
      if ((recentOutreachCount ?? 0) > 0) continue;

      // Pull the user's active (non-deleted, non-archived-conversation,
      // non-blocked) identities. Archived conversations are hidden from
      // the dashboard; the persona shouldn't cold-open a thread the
      // user just tucked away. persona_prompt is server-side only and
      // required for the opener, so this admin-client read is
      // deliberate.
      const { data: oracles } = await admin
        .from("oracles")
        .select(
          "id, name, persona_prompt, traits, one_line_hook, significant_events, memory_style",
        )
        .eq("user_id", profile.id)
        .is("deleted_at", null)
        .is("conversation_archived_at", null)
        .is("blocked_at", null);
      if (!oracles || oracles.length === 0) continue;

      // Pull per-oracle timing state in one shot for this user.
      const oracleIds = oracles.map((o) => o.id as string);

      // Latest message per oracle (any direction, non-deleted) to
      // compute silence per thread.
      const { data: lastMsgs } = await admin
        .from("messages")
        .select("oracle_id, created_at")
        .eq("user_id", profile.id)
        .in("oracle_id", oracleIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      const latestByOracle = new Map<string, string>();
      for (const row of lastMsgs ?? []) {
        const oid = row.oracle_id as string;
        if (!latestByOracle.has(oid)) {
          latestByOracle.set(oid, row.created_at as string);
        }
      }

      // Latest outreach per oracle for this user (self-throttle).
      const { data: lastOutreach } = await admin
        .from("persona_outreach_events")
        .select("oracle_id, sent_at")
        .eq("user_id", profile.id)
        .in("oracle_id", oracleIds)
        .order("sent_at", { ascending: false });
      const latestOutreachByOracle = new Map<string, string>();
      for (const row of lastOutreach ?? []) {
        const oid = row.oracle_id as string;
        if (!latestOutreachByOracle.has(oid)) {
          latestOutreachByOracle.set(oid, row.sent_at as string);
        }
      }

      // Score every eligible identity and pick the one with the
      // highest overshoot — the biggest natural pull to reach out.
      type Candidate = {
        oracleId: string;
        overshootDays: number;
        oracle: (typeof oracles)[number];
      };
      const eligible: Candidate[] = [];
      for (const oracle of oracles) {
        const oid = oracle.id as string;
        const freq = coerceTextFirstFrequency(
          readTextFirstFrequency(oracle.traits),
        );
        const thresholdDays = 28 - freq * 2.5;

        const latestMsg = latestByOracle.get(oid);
        if (!latestMsg) {
          // Never-messaged threads still qualify — treat as maximally
          // silent so brand-new identities can send the first ping.
          const overshoot = 999;
          const lastOutreach = latestOutreachByOracle.get(oid);
          if (lastOutreach) {
            const daysSinceOutreach =
              (startedAt - Date.parse(lastOutreach)) / DAY;
            if (daysSinceOutreach < thresholdDays) continue;
          }
          eligible.push({ oracleId: oid, overshootDays: overshoot, oracle });
          continue;
        }
        const daysSilent = (startedAt - Date.parse(latestMsg)) / DAY;
        if (daysSilent < thresholdDays) continue;

        const lastOutreach = latestOutreachByOracle.get(oid);
        if (lastOutreach) {
          const daysSinceOutreach =
            (startedAt - Date.parse(lastOutreach)) / DAY;
          if (daysSinceOutreach < thresholdDays) continue;
        }

        eligible.push({
          oracleId: oid,
          overshootDays: daysSilent - thresholdDays,
          oracle,
        });
      }

      // Fresh-callback augmentation: an oracle with a recent (6-48h)
      // callback-worthy user turn qualifies EVEN IF long-silence
      // scoring would have excluded it. Add as its own candidate
      // marked with overshootDays=999 so it wins the sort below and
      // beats any long-silence pick.
      let callbackText: string | null = null;
      if (freshCallback) {
        const existing = eligible.find(
          (e) => e.oracleId === freshCallback.oracleId,
        );
        // Also gate on the 24h same-oracle throttle so a callback
        // can't re-fire on the same oracle repeatedly.
        const lastOutreach = latestOutreachByOracle.get(freshCallback.oracleId);
        const withinOracle24h =
          lastOutreach &&
          (startedAt - Date.parse(lastOutreach)) / HOUR < 24;
        const callbackOracle = oracles.find(
          (o) => o.id === freshCallback.oracleId,
        );
        if (callbackOracle && !withinOracle24h) {
          callbackText = freshCallback.text;
          if (!existing) {
            eligible.push({
              oracleId: freshCallback.oracleId,
              overshootDays: 999,
              oracle: callbackOracle,
            });
          } else {
            existing.overshootDays = Math.max(existing.overshootDays, 999);
          }
        }
      }

      if (eligible.length === 0) continue;
      eligible.sort((a, b) => b.overshootDays - a.overshootDays);
      const pick = eligible[0];
      // Only carry the callback text if the picked oracle actually
      // matches the freshCallback source. Any other winner falls back
      // to the plain long-silence framing.
      if (callbackText && pick.oracleId !== freshCallback?.oracleId) {
        callbackText = null;
      }

      // Compose the opener. Persona prompt is the authoritative voice
      // — we tag it with the outreach framing so Claude writes an
      // opener, not a reply.
      const language = (profile.preferred_language ?? "en") as "en" | "es";
      const langInstruction =
        language === "es" ? "Respond in Spanish." : "Respond in English.";

      const memories = await fetchMemoryHooks(profile.id, pick.oracleId);
      const events = extractSignificantEvents(pick.oracle.significant_events);
      const anchorsBlock = buildAnchorsBlock(memories, events);

      // Same mood the chat stream will use if the user replies today.
      // Guards against distracted × sharp memory just like the stream
      // route does — outreach and reply are the same person, same day.
      const outreachAvoid =
        (pick.oracle.memory_style as string | null) === "sharp"
          ? (["distracted"] as const)
          : [];
      const outreachMood = moodOfTheDay(
        pick.oracleId,
        new Date().toISOString(),
        { avoid: outreachAvoid },
      );
      const moodBlock = moodToPromptBlock(outreachMood) ?? "";

      // Fresh-callback vs long-silence framing. Callback references the
      // user's actual recent message so it lands as "I've been thinking
      // about what you said" rather than a generic reach-out.
      const contextBlock = callbackText
        ? `CONTEXT: You are texting FIRST — a short follow-up about something the user said a few hours ago that stayed with you. Their exact recent message:\n\n"""\n${callbackText}\n"""\n\nWrite ONE short message as this character reacting to that specific thing — a question, a thought, a small offering. One sentence ideal, never more than two. Do NOT quote their message back verbatim. Do NOT explain that you're following up. Do NOT announce you're an AI. Match the character's texting rules exactly (no emojis, tone, cadence). ${langInstruction}`
        : `CONTEXT: You are texting FIRST. The user hasn't messaged you in a while and something small made you think of them — a memory, a moment, a passing thought. Write ONE short opener as this character (one sentence is ideal, never more than two). Hook a specific detail from what you already know about them when possible; if there's nothing specific to grab, a warm "hey stranger — how you holding up?" is fine. Do NOT explain that you're reaching out proactively. Do NOT announce that you're an AI. Do NOT ask how their day is in a generic way. Match the character's texting rules exactly (no emojis, tone, cadence). ${langInstruction}`;

      const systemPrompt = `${pick.oracle.persona_prompt}\n\n---\n\n${contextBlock}\n\n${anchorsBlock}${moodBlock ? `\n\n${moodBlock}` : ""}`;

      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 200,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content:
              "(system) Send your short opener now. Don't reply to this line — just write the message you'd send.",
          },
        ],
      });

      const reply = response.content
        .filter((b) => b.type === "text")
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();
      if (!reply) continue;

      // Safety net — moderate the persona's own output. Persona-
      // initiated messages have no user turn for the block detector to
      // hook onto; this is the substitute.
      const mod = await moderateText(reply);
      if (mod.flagged) {
        console.warn(
          `[persona-outreach] flagged for user=${profile.id} oracle=${pick.oracleId} cats=${mod.categories.join(",")}`,
        );
        continue;
      }

      // Persist as an assistant message via service role — RLS
      // policies restrict clients to inserting user rows only.
      const { data: msgRow, error: msgErr } = await admin
        .from("messages")
        .insert({
          user_id: profile.id,
          oracle_id: pick.oracleId,
          role: "assistant",
          content: reply,
          initiated_by_oracle: true,
          initiated_by: "persona",
        })
        .select("id")
        .single();
      if (msgErr || !msgRow) {
        console.error(
          `[persona-outreach] message insert failed for ${profile.id}/${pick.oracleId}`,
          msgErr,
        );
        continue;
      }

      // Record the outreach event AFTER the message lands so throttle
      // never records a phantom send.
      await admin.from("persona_outreach_events").insert({
        user_id: profile.id,
        oracle_id: pick.oracleId,
        sent_at: nowIso,
        message_id: msgRow.id,
      });

      // Fire the push (best-effort — never block on it).
      const truncated =
        reply.length > 110 ? `${reply.slice(0, 107)}…` : reply;
      after(async () => {
        await sendWebPushToUser({
          userId: profile.id,
          payload: {
            title: (pick.oracle.name as string) ?? "chapter3five",
            body: truncated,
            url: `/chat/${pick.oracleId}`,
            tag: `persona-outreach-${pick.oracleId}`,
          },
        }).catch((e) =>
          console.error(`[persona-outreach] push failed for ${profile.id}`, e),
        );
      });

      sent++;
    } catch (err) {
      console.error(`[persona-outreach] failed for ${profile.id}`, err);
    }
  }

  await admin.from("cron_runs").insert({
    job: "persona_outreach",
    processed: sent,
    duration_ms: Date.now() - startedAt,
  });

  return NextResponse.json({ sent });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function withinLocalWindow(now: Date, tz: string | null): boolean {
  if (tz && typeof tz === "string") {
    try {
      const hourStr = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: tz,
      }).format(now);
      const hour = parseInt(hourStr, 10);
      if (Number.isFinite(hour)) {
        return hour >= MIN_HOUR_LOCAL && hour < MAX_HOUR_LOCAL;
      }
    } catch {
      // fall through to UTC fallback
    }
  }
  const utcHour = now.getUTCHours();
  return utcHour >= FALLBACK_MIN_HOUR_UTC && utcHour < FALLBACK_MAX_HOUR_UTC;
}

function readTextFirstFrequency(traits: unknown): unknown {
  if (typeof traits !== "object" || traits === null) {
    return DEFAULT_TEXT_FIRST_FREQUENCY;
  }
  const t = traits as Record<string, unknown>;
  if ("textFirstFrequency" in t) return t.textFirstFrequency;
  return DEFAULT_TEXT_FIRST_FREQUENCY;
}

type SignificantEvent = { ageAtEvent?: number; summary?: string };
function extractSignificantEvents(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (e): e is SignificantEvent => typeof e === "object" && e !== null,
    )
    .map((e) => (typeof e.summary === "string" ? e.summary.trim() : ""))
    .filter((s): s is string => s.length > 0)
    .slice(0, 5);
}

async function fetchMemoryHooks(
  userId: string,
  oracleId: string,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("persona_memories")
    .select("content, weight, kind")
    .eq("user_id", userId)
    .eq("oracle_id", oracleId)
    .order("weight", { ascending: false })
    .order("last_referenced_at", { ascending: false })
    .limit(10);
  return (data ?? [])
    .map((m) => (typeof m.content === "string" ? m.content : ""))
    .filter((s) => s.length > 0);
}

function buildAnchorsBlock(memories: string[], events: string[]): string {
  const lines: string[] = [];
  if (memories.length > 0) {
    lines.push(
      "WHAT YOU REMEMBER ABOUT THEM (pick ONE if any is timely; do NOT recite):",
    );
    for (const m of memories.slice(0, 8)) lines.push(`- ${m}`);
  }
  if (events.length > 0) {
    lines.push(
      "\nYOUR OWN DEFINING MOMENTS (draw on your voice, not narration):",
    );
    for (const e of events) lines.push(`- ${e}`);
  }
  if (lines.length === 0) {
    return "You don't have a specific hook — that's fine. A warm 'hey stranger — how you holding up?' beats a generic 'how are you.'";
  }
  return lines.join("\n");
}
