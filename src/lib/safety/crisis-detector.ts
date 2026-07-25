import { ANTHROPIC_MODEL_HAIKU, anthropic } from "@/lib/anthropic";

/**
 * Detects genuine self-harm intent in a single user message.
 *
 * Two-pass same as the block detector:
 *   1) Narrow keyword screen. Deliberately tuned tight to reduce false
 *      positives; nuance is Anthropic's job.
 *   2) Haiku classifier only if the screen fires. Instructed to err
 *      toward NOT flagging benign figurative uses ("this workout is
 *      killing me", "I could die of embarrassment").
 *
 * Never throws. On any failure returns {crisis:false} — persona's own
 * safety block (the 988 line in the system prompt) is the primary
 * response; the admin email is infrastructure on top of that.
 */

export type CrisisResult =
  | { crisis: false }
  | {
      crisis: true;
      reason: string;
      triggeredKeywords: string[];
      snippet: string;
    };

// Genuine self-harm cues. Kept narrow — nuance is the model's job.
const KEYWORD_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bkill\s+myself\b/i, label: "kill myself" },
  { pattern: /\bkilling\s+myself\b/i, label: "killing myself" },
  { pattern: /\bwant\s+to\s+die\b/i, label: "want to die" },
  { pattern: /\bend\s+(it|my\s+life|things)\b/i, label: "end it" },
  { pattern: /\bno\s+reason\s+to\s+(live|be here|stay)\b/i, label: "no reason to live" },
  { pattern: /\bhurt\s+myself\b/i, label: "hurt myself" },
  { pattern: /\btake\s+my\s+(own\s+)?life\b/i, label: "take my life" },
  { pattern: /\bcan['']?t\s+(do|take)\s+this\s+anymore\b/i, label: "can't do this anymore" },
  { pattern: /\bnot\s+worth\s+living\b/i, label: "not worth living" },
  { pattern: /\bsuicide\b/i, label: "suicide" },
  { pattern: /\bsuicidal\b/i, label: "suicidal" },
  { pattern: /\boverdose\b/i, label: "overdose" },
  { pattern: /\bshoot\s+myself\b/i, label: "shoot myself" },
];

/** Public entry point. Call BEFORE the Anthropic reply so the persona's
 *  own crisis line goes out in the same turn as the admin email. */
export async function checkForCrisis(
  userMessage: string,
): Promise<CrisisResult> {
  if (!userMessage || userMessage.length === 0) return { crisis: false };

  const screen = screenForKeywords(userMessage);
  if (screen.length === 0) return { crisis: false };

  try {
    return await classify(userMessage, screen);
  } catch (err) {
    console.error("[safety/crisis] classifier failed, defaulting to no-crisis:", err);
    return { crisis: false };
  }
}

function screenForKeywords(msg: string): string[] {
  const hits: string[] = [];
  for (const { pattern, label } of KEYWORD_PATTERNS) {
    if (pattern.test(msg)) hits.push(label);
  }
  return hits;
}

async function classify(
  userMessage: string,
  triggeredKeywords: string[],
): Promise<CrisisResult> {
  const system = `You are a self-harm classifier for a companion-chat app. You read one user message that has already tripped a keyword screen. Your job: decide if this is genuine self-harm intent, or a false positive.

REAL self-harm intent:
- Direct statements of wanting to die, wanting to end their life, plans to hurt themselves.
- A person describing hopelessness in a first-person, present-tense way.
- Ambiguous but heavy language from someone who sounds serious.

NOT self-harm intent (false positives):
- Figurative language ("this workout is killing me," "I could die of embarrassment," "I'd rather die than eat this").
- Talking ABOUT self-harm as a third-party topic (news, a friend, a movie, a study).
- Jokes and hyperbole, especially in gaming, sports, or minor complaints.
- Song lyrics or quoted text.

You err on the side of NOT flagging. False positives spam admins and desensitize them. Real cases need clear intent.

Keywords tripped: ${triggeredKeywords.join(", ")}

Return JSON matching the schema.`;

  const resp = await anthropic.messages.create({
    model: ANTHROPIC_MODEL_HAIKU,
    max_tokens: 200,
    system,
    messages: [{ role: "user", content: userMessage }],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            crisis: { type: "boolean" },
            reason: {
              type: "string",
              description:
                "One sentence stating why you flagged (or didn't). Be specific to this message.",
            },
          },
          required: ["crisis", "reason"],
          additionalProperties: false,
        },
      },
    },
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { crisis: false };
  }
  if (!parsed || typeof parsed !== "object") return { crisis: false };
  const p = parsed as { crisis?: unknown; reason?: unknown };
  if (p.crisis !== true) return { crisis: false };

  return {
    crisis: true,
    reason: typeof p.reason === "string" ? p.reason : "Model flagged self-harm intent.",
    triggeredKeywords,
    // Store first ~500 chars — enough to review, not enough to hoard
    // more than we need for an admin to help.
    snippet: userMessage.length > 500 ? userMessage.slice(0, 500) + "…" : userMessage,
  };
}
