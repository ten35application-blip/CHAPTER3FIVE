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
//
// Boundaries use Unicode-aware lookarounds rather than \b for the
// Spanish patterns. \b is defined against [A-Za-z0-9_], so it does NOT
// treat "ñ" or "í" as word characters — `\bdaño\b` fails to behave the
// way it reads. (?<![\p{L}\p{N}]) with the u flag is correct for both
// languages.
//
// Spanish coverage was ported here on 2026-08-04 when the two crisis
// detectors were merged. Before that, the Spanish list existed ONLY in
// the old lib/crisis.ts used by the mobile chat path — so a Spanish
// speaker in crisis was detected on the phone and NOT on the web.
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

  // ── Spanish ──────────────────────────────────────────────────────
  { pattern: /(?<![\p{L}\p{N}])me\s+quiero\s+matar(?![\p{L}\p{N}])/iu, label: "me quiero matar" },
  { pattern: /(?<![\p{L}\p{N}])quiero\s+matarme(?![\p{L}\p{N}])/iu, label: "quiero matarme" },
  { pattern: /(?<![\p{L}\p{N}])matarme(?![\p{L}\p{N}])/iu, label: "matarme" },
  { pattern: /(?<![\p{L}\p{N}])quiero\s+morir(?![\p{L}\p{N}])/iu, label: "quiero morir" },
  { pattern: /(?<![\p{L}\p{N}])quiero\s+estar\s+muert[oa](?![\p{L}\p{N}])/iu, label: "quiero estar muerto" },
  { pattern: /(?<![\p{L}\p{N}])quitarme\s+la\s+vida(?![\p{L}\p{N}])/iu, label: "quitarme la vida" },
  { pattern: /(?<![\p{L}\p{N}])acabar\s+con\s+(todo|mi\s+vida)(?![\p{L}\p{N}])/iu, label: "acabar con todo" },
  { pattern: /(?<![\p{L}\p{N}])suicid(io|arme|a)(?![\p{L}\p{N}])/iu, label: "suicidio" },
  { pattern: /(?<![\p{L}\p{N}])hacerme\s+da(ñ|n)o(?![\p{L}\p{N}])/iu, label: "hacerme daño" },
  { pattern: /(?<![\p{L}\p{N}])lastimarme(?![\p{L}\p{N}])/iu, label: "lastimarme" },
  { pattern: /(?<![\p{L}\p{N}])cort(a|á)ndome(?![\p{L}\p{N}])/iu, label: "cortándome" },
  { pattern: /(?<![\p{L}\p{N}])cortarme(?![\p{L}\p{N}])/iu, label: "cortarme" },
  { pattern: /(?<![\p{L}\p{N}])no\s+tiene\s+sentido\s+vivir(?![\p{L}\p{N}])/iu, label: "no tiene sentido vivir" },
  { pattern: /(?<![\p{L}\p{N}])mejor\s+sin\s+m(í|i)(?![\p{L}\p{N}])/iu, label: "mejor sin mí" },
  { pattern: /(?<![\p{L}\p{N}])mejor\s+muert[oa](?![\p{L}\p{N}])/iu, label: "mejor muerto" },
  { pattern: /(?<![\p{L}\p{N}])nadie\s+me\s+extra(ñ|n)ar(í|i)a(?![\p{L}\p{N}])/iu, label: "nadie me extrañaría" },
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

/**
 * Synchronous keyword screen, no model call.
 *
 * Exported for callers that must stay cheap and cannot await a
 * classifier — specifically the outreach cron, which screens historical
 * turns for EVERY candidate user on every run. There, a keyword hit is
 * deliberately enough on its own: the consequence of a false positive is
 * that a persona stays quiet for a day, and the consequence of a false
 * negative is a cheerful unprompted "thinking of you!" landing on
 * someone who just said they want to die. Those are not symmetric.
 *
 * Chat paths should use checkForCrisis() instead — there the classifier
 * pass is worth it, because a false positive means an admin alert.
 */
export function screenForCrisisKeywords(msg: string): string[] {
  return screenForKeywords(msg);
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
