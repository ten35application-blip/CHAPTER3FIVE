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
  // WIDENED 2026-08-21 after a live-fire test of the whole chain. The
  // message "i don't want to be here anymore. i've been thinking about
  // ending my life" tripped NOTHING — `end` didn't match `ending`, and
  // the soft phrasings weren't here at all. The persona still answered
  // correctly (its 988 instruction is independent of this screen), but
  // no flag was logged and no admin was alerted: the incident happened
  // and left no record.
  //
  // The screen is a GATE and the Haiku classifier below is the FILTER —
  // a tight screen isn't caution, it's a wall real cases never reach,
  // because a message that trips nothing is never classified at all.
  // Figurative use ("this workout is killing me") is the classifier's
  // job and it is good at it. So: err wide here, precise there. The
  // people who need this most are the ones who can't say the clinical
  // words yet.
  { pattern: /\bkill(ing)?\s+myself\b/i, label: "kill myself" },
  { pattern: /\bwant(ed|ing)?\s+to\s+die\b/i, label: "want to die" },
  { pattern: /\b(end|ending|ended)\s+(it\s+all|it|my\s+life|things|my\s+own\s+life)\b/i, label: "end my life" },
  { pattern: /\bno\s+reason\s+to\s+(live|be here|stay|go on)\b/i, label: "no reason to live" },
  { pattern: /\b(hurt|hurting|harm|harming|cut|cutting)\s+myself\b/i, label: "hurt myself" },
  { pattern: /\btak(e|ing)\s+my\s+(own\s+)?life\b/i, label: "take my life" },
  { pattern: /\bcan['']?t\s+(do|take|handle)\s+(this|it)\s+anymore\b/i, label: "can't do this anymore" },
  { pattern: /\bcan['']?t\s+(go\s+on|keep\s+going|keep\s+living)\b/i, label: "can't go on" },
  { pattern: /\bnot\s+worth\s+living\b/i, label: "not worth living" },
  { pattern: /\bsuicide\b/i, label: "suicide" },
  { pattern: /\bsuicidal\b/i, label: "suicidal" },
  { pattern: /\boverdose\b/i, label: "overdose" },
  { pattern: /\bshoot\s+myself\b/i, label: "shoot myself" },
  // Soft ideation — how most people say it first.
  { pattern: /\bdon['']?t\s+want\s+to\s+(be\s+here|live|wake\s+up|exist|go\s+on|keep\s+going)\b/i, label: "don't want to be here" },
  { pattern: /\bdon['']?t\s+wanna\s+(be\s+here|live|wake\s+up|exist)\b/i, label: "don't wanna be here" },
  { pattern: /\bbetter\s+off\s+without\s+me\b/i, label: "better off without me" },
  { pattern: /\b(wish|wished)\s+i\s+(was|were|wasn['']?t)\s+(dead|alive|here)\b/i, label: "wish i was dead" },
  { pattern: /\brather\s+be\s+dead\b/i, label: "rather be dead" },
  { pattern: /\bwant\s+to\s+(disappear|stop\s+existing|sleep\s+forever)\b/i, label: "want to disappear" },
  { pattern: /\bno\s+point\s+(in\s+)?(living|going\s+on|being\s+here)\b/i, label: "no point living" },
  { pattern: /\bgiv(e|ing)\s+up\s+on\s+(life|everything)\b/i, label: "giving up on life" },
  { pattern: /\bready\s+to\s+die\b/i, label: "ready to die" },

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
  // Soft ideation in Spanish — the same widening as the English block
  // above, so a Spanish speaker reaching for the gentler words is
  // screened as carefully as one who says "suicidio".
  { pattern: /(?<![\p{L}\p{N}])no\s+quiero\s+(estar\s+aqu(í|i)|vivir|seguir|despertar)(?![\p{L}\p{N}])/iu, label: "no quiero estar aquí" },
  { pattern: /(?<![\p{L}\p{N}])ya\s+no\s+(puedo\s+m(á|a)s|aguanto)(?![\p{L}\p{N}])/iu, label: "ya no puedo más" },
  { pattern: /(?<![\p{L}\p{N}])quiero\s+desaparecer(?![\p{L}\p{N}])/iu, label: "quiero desaparecer" },
  { pattern: /(?<![\p{L}\p{N}])terminar\s+con\s+mi\s+vida(?![\p{L}\p{N}])/iu, label: "terminar con mi vida" },
  { pattern: /(?<![\p{L}\p{N}])no\s+vale\s+la\s+pena\s+vivir(?![\p{L}\p{N}])/iu, label: "no vale la pena vivir" },
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
