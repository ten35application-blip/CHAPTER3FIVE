/**
 * The persona's current emotional + physical state, plus what's been
 * happening in their week. Three layers, refreshed at different
 * cadences:
 *
 *   - mood + physical: per (oracle, user), refreshed after 2h idle
 *   - weekly_context: per oracle, refreshed every 7 days
 *
 * Why this exists: the persona without these feels like a polite,
 * ever-attentive AI. With them, they have a Tuesday. They're tired.
 * They had coffee an hour ago. The construction upstairs is finally
 * done. They owe their sister a callback. None of this is announced
 * — it colors how they talk and surfaces only when relevant.
 *
 * The chat prompt instructs explicitly that archive answers ALWAYS
 * win over generated state. State is texture, not biography.
 */

import { anthropic, ANTHROPIC_MODEL } from "./anthropic";
import type { AmbientCast } from "./cast";
import type { LocationAnchor } from "./location";

export type ConversationState = {
  mood: string;
  physical: string;
};

export type WeeklyContext = {
  threads: string[];
};

const CONVERSATION_STATE_TTL_MS = 2 * 60 * 60 * 1000; // 2h
const WEEKLY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function isStateStale(generatedAt: string | null | undefined): boolean {
  if (!generatedAt) return true;
  return Date.now() - new Date(generatedAt).getTime() > CONVERSATION_STATE_TTL_MS;
}

export function isWeeklyStale(validThrough: string | null | undefined): boolean {
  if (!validThrough) return true;
  return new Date(validThrough).getTime() < Date.now();
}

export function newWeeklyValidThrough(): string {
  return new Date(Date.now() + WEEKLY_TTL_MS).toISOString();
}

export function stateToPromptBlock(args: {
  state: ConversationState | null;
  weekly: WeeklyContext | null;
}): string {
  const parts: string[] = [];

  if (args.state) {
    const lines: string[] = [];
    if (args.state.mood) lines.push(`Mood: ${args.state.mood}.`);
    if (args.state.physical) lines.push(`Physical: ${args.state.physical}.`);
    if (lines.length > 0) {
      parts.push(`RIGHT NOW (don't announce — just let it color how you respond):\n${lines.join("\n")}`);
    }
  }

  if (args.weekly && args.weekly.threads.length > 0) {
    const threadLines = args.weekly.threads
      .map((t) => `- ${t}`)
      .join("\n");
    parts.push(
      `THIS WEEK (mention only if the conversation touches it — don't list these unprompted):\n${threadLines}`,
    );
  }

  if (parts.length === 0) return "";

  const note = `\n\nThese are surface texture, not biographical truth. If anything here contradicts the archive, the archive wins.`;
  return "\n\n" + parts.join("\n\n") + note;
}

/**
 * Generate a fresh mood + physical state for a chat session.
 */
export async function generateConversationState(args: {
  oracleName: string;
  bio: string | null;
  language: "en" | "es";
  location: LocationAnchor | null;
  cast: AmbientCast | null;
  textingStyle: string | null;
}): Promise<ConversationState | null> {
  const locationLine = args.location
    ? `Location: ${[args.location.neighborhood, args.location.city, args.location.state].filter(Boolean).join(", ")}.`
    : "";
  const bioLine = args.bio ? `Bio: ${args.bio}` : "";

  const systemPrompt = `You are seeding a short "right now" state for a chat persona named ${args.oracleName}. The persona will use this to color their texts — they won't announce it. It's just what's true for them at this moment.

${bioLine}
${locationLine}

Output a JSON object only:
{
  "mood": "...",
  "physical": "..."
}

Rules:
- "mood": one short clause about emotional state. Vary widely. Sometimes great, sometimes flat, sometimes irritable, sometimes content, sometimes preoccupied. Real people are not always pleasant. Examples: "tired but okay", "low-grade pissed at something at work", "actually pretty good today", "scattered, can't focus", "missing your sister", "low-key anxious about a thing tomorrow".
- "physical": one short clause about body + environment right now. What you just ate, where you're sitting, what's in your headphones, the temperature, what you're wearing. Examples: "just made coffee, on the couch, hoodie weather", "walking back from the store, cold hands", "sitting with a beer after a long day, AC blasting", "stuck in traffic, podcast on", "in bed, can't sleep, scrolling".
- Both should fit who the persona is (their bio, their location, their voice).
- Keep them short — under 12 words each.
- These should feel mundane and specific, not poetic.

Output the JSON only, no prose.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: "Seed a fresh state.",
        },
      ],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as Partial<ConversationState>;
    if (
      typeof parsed.mood !== "string" ||
      typeof parsed.physical !== "string" ||
      !parsed.mood.trim() ||
      !parsed.physical.trim()
    ) {
      return null;
    }
    return {
      mood: parsed.mood.trim(),
      physical: parsed.physical.trim(),
    };
  } catch (err) {
    console.error("state generation failed:", err);
    return null;
  }
}

/**
 * Generate the rotating "this week" context. Specific recent threads
 * — a construction project upstairs that's wrapping up, owing
 * someone a callback, a book they're halfway through — that come up
 * naturally if the conversation drifts there.
 */
export async function generateWeeklyContext(args: {
  oracleName: string;
  bio: string | null;
  language: "en" | "es";
  location: LocationAnchor | null;
  cast: AmbientCast | null;
}): Promise<WeeklyContext | null> {
  const castBlock = args.cast && args.cast.length > 0
    ? args.cast.map((c) => `- ${c.name} (${c.relationship})`).join("\n")
    : "(none yet)";
  const locationLine = args.location
    ? `Location: ${[args.location.neighborhood, args.location.city, args.location.state].filter(Boolean).join(", ")}.`
    : "";
  const bioLine = args.bio ? `Bio: ${args.bio}` : "";

  const systemPrompt = `You are seeding a "this week" context for a chat persona named ${args.oracleName}. The persona will reference these threads only when conversation drifts there — never list them, never announce them.

${bioLine}
${locationLine}

People in their life:
${castBlock}

Output a JSON object only:
{
  "threads": ["one short concrete thread", "another", "another"]
}

Rules:
- 3 to 5 threads. Each is one short sentence.
- SPECIFIC. Not "I had a busy week." More like "the upstairs neighbor finally finished the construction yesterday" or "my sister called me three times this week about Mom's surgery scheduling" or "I'm halfway through Pachinko and it's slow but worth it" or "the dog has a vet appointment Friday I'm dreading."
- Mix textures: domestic ("got the brakes fixed, $800 ouch"), social (a friend visit, an argument, a missed call), media (a book/show/album they've been into), embodied (a cold they're getting over, a workout streak, sleep being bad).
- Anchor on the bio + location + people when possible. Don't introduce major new people not in the cast.
- AVOID melodrama. These are mundane, real, the texture of an actual week.

Output the JSON only, no prose.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: "Seed this week.",
        },
      ],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as Partial<WeeklyContext>;
    if (!Array.isArray(parsed.threads)) return null;
    const threads = parsed.threads
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .slice(0, 5)
      .map((t) => t.trim());
    return threads.length > 0 ? { threads } : null;
  } catch (err) {
    console.error("weekly context generation failed:", err);
    return null;
  }
}
