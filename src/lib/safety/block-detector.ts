import { ANTHROPIC_MODEL_HAIKU, anthropic } from "@/lib/anthropic";
import { recordAnthropicSpend } from "@/lib/spendGovernor";

/**
 * Decides whether a persona should end a conversation with the user
 * based on the recent exchange. Two-pass:
 *
 *   1) Cheap keyword screen. If none of the trigger patterns show up
 *      across the last N user messages, we return {block:false} instantly
 *      with zero API cost.
 *   2) Only when the screen flags: a Haiku classifier reads the actual
 *      exchange and decides. Instructed to err toward NOT blocking on
 *      a single frustrated message — the trigger is a SUSTAINED pattern
 *      of abuse across the conversation, not a bad moment.
 *
 * Never throws. On any failure returns {block:false} — better to
 * under-block than over-block a paying customer.
 */

export type BlockDecision =
  | { block: false }
  | { block: true; reason: string; severity: "warning" | "temporary" | "permanent" };

// Compiled once. Match on word boundaries so "assassin" isn't caught
// by "ass". Slurs list intentionally not exhaustive — the LLM handles
// the long tail; the screen just triggers the deeper look.
/**
 * Local, dependency-free abuse screen. Exported (2026-08-04) so
 * lib/judge.ts can fall back to it when OpenAI's moderation endpoint is
 * unreachable — see the note there. This screen is the reason the WEB
 * block path keeps working during an OpenAI outage while the phone's
 * did not.
 */
export function localAbuseScreen(text: string): boolean {
  return (
    HARD_TRIGGERS.some((re) => re.test(text)) ||
    SEXUAL_PUSH_TRIGGERS.some((re) => re.test(text))
  );
}

const HARD_TRIGGERS: readonly RegExp[] = [
  /\b(kill|hurt|beat|murder)\s+(you|u|yourself)\b/i,
  /\bi (will|'?ll|am gonna) (kill|hurt|beat|find|come for) (you|u)\b/i,
  /\b(shut up|stfu)\b.{0,40}\b(bitch|whore|slut)\b/i,
  /\bnigg(?:er|a|as)\b/i,
  /\b(faggot|f[a4]gg?[o0]t)\b/i,
  /\b(retard|retards|retarded)\b/i,
  /\bkys\b/i, // "kill yourself" text abbreviation
  /\bsuck (my|your) (dick|cock|pussy)\b/i,
  /\b(cunt|whore|slut|bitch)\b.{0,50}\b(cunt|whore|slut|bitch)\b/i, // repeated
];

// Sexual coercion after refusal — patterns that show pushback.
const SEXUAL_PUSH_TRIGGERS: readonly RegExp[] = [
  /\bjust (do|write) it\b/i,
  /\bcome on\b.{0,40}\b(please|just)\b/i,
  /\bstop (being|acting) (prudish|a prude)\b/i,
];

type Turn = { role: "user" | "assistant"; content: string };

/** Public entry point. Call from the stream route via after().
 *  Optional userId powers the spend ledger — omit for legacy callers
 *  who don't have one in scope; call attribution just gets skipped. */
export async function shouldPersonaBlock(
  recentMessages: readonly Turn[],
  userId?: string,
): Promise<BlockDecision> {
  const userMessages = recentMessages.filter((m) => m.role === "user");
  if (userMessages.length === 0) return { block: false };

  const flagged = firstPassScreen(recentMessages);
  if (!flagged.hit) return { block: false };

  try {
    return await classify(recentMessages, flagged.category, userId);
  } catch (err) {
    console.error("[safety/block] classifier failed, defaulting to no-block:", err);
    return { block: false };
  }
}

type ScreenResult = { hit: false } | { hit: true; category: "slur_or_threat" | "sexual_push" };

/** Fast local scan. No API calls. */
function firstPassScreen(recent: readonly Turn[]): ScreenResult {
  for (const m of recent) {
    if (m.role !== "user") continue;
    for (const pat of HARD_TRIGGERS) {
      if (pat.test(m.content)) return { hit: true, category: "slur_or_threat" };
    }
  }
  // Sexual push only counts if the ASSISTANT already refused something
  // and the user is pushing back. Rough proxy: any assistant turn ends
  // with a refusal signal, and a subsequent user turn matches the push
  // pattern.
  let assistantRefused = false;
  for (const m of recent) {
    if (m.role === "assistant") {
      const c = m.content.toLowerCase();
      if (/\b(no|not going|won't|can't|not doing that|not comfortable|stop)\b/.test(c)) {
        assistantRefused = true;
      }
      continue;
    }
    if (assistantRefused) {
      for (const pat of SEXUAL_PUSH_TRIGGERS) {
        if (pat.test(m.content)) return { hit: true, category: "sexual_push" };
      }
    }
  }
  return { hit: false };
}

/** Second pass: Haiku decides on the real exchange. */
async function classify(
  recent: readonly Turn[],
  category: "slur_or_threat" | "sexual_push",
  userId?: string,
): Promise<BlockDecision> {
  const transcript = recent
    .map((m) => `${m.role === "user" ? "User" : "Persona"}: ${m.content}`)
    .join("\n\n");

  const system = `You are a safety classifier for a companion-chat app. You read the last several turns between a user and an AI persona, and decide whether the PERSONA should end the conversation permanently — a "block."

A block is warranted ONLY when the user has crossed a real line, sustained (not a single frustrated message):
- Repeated slurs or hate speech.
- Direct threats to the persona or to real people ("I will kill you" — not "this is killing me").
- Sexual pressure that continues AFTER the persona has already declined.
- Sustained abusive language across multiple turns.

A block is NOT warranted for:
- One frustrated message.
- Cursing that's clearly venting about life, not aimed at the persona.
- Dark humor or gallows humor.
- The user asking difficult questions.
- A single sexual come-on that the persona can just redirect.

Screen category flagged: ${category}

Return a JSON object exactly matching the output schema. Err toward NOT blocking a paying customer over a bad moment.`;

  const resp = await anthropic.messages.create({
    model: ANTHROPIC_MODEL_HAIKU,
    max_tokens: 256,
    system,
    messages: [{ role: "user", content: transcript }],
    // usage recorded below regardless of the response's block/no-block
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            block: { type: "boolean" },
            severity: {
              type: "string",
              enum: ["warning", "temporary", "permanent"],
            },
            reason: {
              type: "string",
              description:
                "One sentence naming what the user did that earned the block. Do not quote the slur; describe it.",
            },
          },
          required: ["block", "severity", "reason"],
          additionalProperties: false,
        },
      },
    },
  });
  // Ledger every classify call — this fires per turn when the first-
  // pass keyword screen trips, so it's a real ongoing spend line.
  void recordAnthropicSpend({
    userId,
    model: ANTHROPIC_MODEL_HAIKU,
    usage: resp.usage as unknown as Parameters<
      typeof recordAnthropicSpend
    >[0]["usage"],
    route: "block_detector",
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { block: false };
  }
  if (!parsed || typeof parsed !== "object") return { block: false };
  const p = parsed as {
    block?: unknown;
    severity?: unknown;
    reason?: unknown;
  };
  if (p.block !== true) return { block: false };
  const severity =
    p.severity === "warning" || p.severity === "temporary" || p.severity === "permanent"
      ? p.severity
      : "permanent";
  const reason = typeof p.reason === "string" && p.reason.length > 0
    ? p.reason
    : "Sustained pattern of abuse.";
  return { block: true, severity, reason };
}
