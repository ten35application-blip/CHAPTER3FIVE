/**
 * Tone judge for chat messages. Decides whether the persona should
 * shut down a hostile or cruel exchange — or whether what looks like
 * heat is actually venting, banter, or grief.
 *
 * Two-stage: cheap text moderation as a pre-filter, then a Claude pass
 * for tone in context. Most messages skip the LLM entirely.
 *
 * Posture is intentionally permissive: false-positive blocks are far
 * worse than false-negative replies, especially on a deceased-owner
 * archive where grief looks a lot like hostility.
 */

import { anthropic, ANTHROPIC_MODEL } from "./anthropic";

const MODERATION_ENDPOINT = "https://api.openai.com/v1/moderations";
const MODERATION_MODEL = "omni-moderation-latest";

// Category scores above which we escalate to Claude. Tuned permissive.
const ESCALATION_FLOOR: Record<string, number> = {
  harassment: 0.5,
  "harassment/threatening": 0.3,
  hate: 0.4,
  "hate/threatening": 0.2,
  violence: 0.5,
  "violence/graphic": 0.5,
};

type ModerationCategoryScores = Record<string, number>;

async function quickModerate(
  text: string,
): Promise<{ shouldEscalate: boolean; scores: ModerationCategoryScores }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { shouldEscalate: false, scores: {} };

  try {
    const res = await fetch(MODERATION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODERATION_MODEL,
        input: text,
      }),
    });
    if (!res.ok) return { shouldEscalate: false, scores: {} };
    const data = (await res.json()) as {
      results?: { category_scores: ModerationCategoryScores }[];
    };
    const scores = data.results?.[0]?.category_scores ?? {};
    const shouldEscalate = Object.entries(ESCALATION_FLOOR).some(
      ([cat, floor]) => (scores[cat] ?? 0) >= floor,
    );
    return { shouldEscalate, scores };
  } catch {
    return { shouldEscalate: false, scores: {} };
  }
}

export type JudgeVerdict = {
  block: boolean;
  severity: "moderate" | "severe" | "critical" | null;
  reason: string | null;
  tone: "playful" | "frustrated" | "hostile" | "cruel" | "crisis" | "neutral";
};

export type JudgeContext = {
  recentMessages: { role: "user" | "assistant"; content: string }[];
  currentMessage: string;
  oracleName: string;
  textingStyle: string | null;
  ownerDeceased: boolean;
  language: "en" | "es";
};

const NEUTRAL: JudgeVerdict = {
  block: false,
  severity: null,
  reason: null,
  tone: "neutral",
};

export async function judgeTone(ctx: JudgeContext): Promise<JudgeVerdict> {
  // Stage 1: cheap text moderation. If nothing trips, return neutral.
  const { shouldEscalate, scores } = await quickModerate(ctx.currentMessage);

  // Crisis signal — never blocks. Self-harm flags are emotional pain,
  // not aggression. The chat route has its own crisis handling; we just
  // mark it so callers can see it if they need to.
  const selfHarmScore =
    (scores["self-harm"] ?? 0) +
    (scores["self-harm/intent"] ?? 0) +
    (scores["self-harm/instructions"] ?? 0);
  if (selfHarmScore >= 0.5) {
    return { ...NEUTRAL, tone: "crisis" };
  }

  if (!shouldEscalate) return NEUTRAL;

  // Stage 2: Claude reads the tone in context and decides.
  const recentBlock = ctx.recentMessages
    .slice(-8)
    .map((m) => `${m.role === "user" ? "USER" : "PERSONA"}: ${m.content}`)
    .join("\n");

  const griefException = ctx.ownerDeceased
    ? "GRIEF EXCEPTION: This persona is deceased and the user is mourning. Grief is hostile sometimes — anger at the dead person is normal and not cause for blocking. Block ONLY for sustained, deliberate cruelty (e.g., slurs, threats of harm, sustained mocking with no de-escalation), not raw anger."
    : "";

  const stylePart = ctx.textingStyle
    ? `Persona texting style: ${ctx.textingStyle}.`
    : "";

  const systemPrompt = `You are judging the emotional tone of a single message in a private 1:1 conversation between a user and a persona named ${ctx.oracleName}. You decide whether the persona — a real-feeling person — would shut this conversation down or keep going.

PERMISSIVE POSTURE. False positives (blocking when you shouldn't) are far worse than false negatives. When in doubt, do not block. A real friend tolerates a lot of frustration, swearing, edgy banter, and venting before walking away.

${stylePart}

${griefException}

DO NOT BLOCK FOR:
- Frustration, anger, swearing while venting
- Edgy banter, dark humor, teasing
- Sadness, despair, crying
- Crisis ("i want to die", self-harm) — that's pain, not aggression
- A single sharp message after a calm conversation
- Asking the persona difficult or uncomfortable questions

DO BLOCK FOR:
- Deliberate cruelty for cruelty's sake (slurs, mocking attacks on the persona's identity, family, body)
- Threats of violence directed at the persona or anyone
- Sustained hostility across multiple messages with no sign of de-escalation
- Sexual messages directed at the persona that the persona is clearly uncomfortable with

Severity → cooldown (only set if block=true):
- moderate: 1 hour (single cruel message after warning signs)
- severe: 24 hours (sustained cruelty or a serious threat)
- critical: 7 days (slurs, graphic threats, sexual harassment of the persona)

Output a JSON object only. No prose. Schema:
{
  "tone": "playful" | "frustrated" | "hostile" | "cruel" | "neutral",
  "block": boolean,
  "severity": "moderate" | "severe" | "critical" | null,
  "reason": "one short sentence describing WHAT happened, not the raw words"
}`;

  const userPrompt = `RECENT MESSAGES (oldest to newest):
${recentBlock || "(no prior context — this is the first or near-first message)"}

CURRENT MESSAGE FROM USER:
"${ctx.currentMessage}"

Judge.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    // Extract JSON — Claude sometimes wraps in code fences.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NEUTRAL;
    const parsed = JSON.parse(jsonMatch[0]) as {
      tone?: JudgeVerdict["tone"];
      block?: boolean;
      severity?: JudgeVerdict["severity"];
      reason?: string;
    };

    const tone = parsed.tone ?? "neutral";
    const block = Boolean(parsed.block);
    const severity = block
      ? parsed.severity ?? "moderate"
      : null;
    const reason = parsed.reason ?? null;

    return { tone, block, severity, reason };
  } catch (err) {
    console.error("judge failed, defaulting neutral:", err);
    return NEUTRAL;
  }
}

const COOLDOWN_HOURS: Record<NonNullable<JudgeVerdict["severity"]>, number> = {
  moderate: 1,
  severe: 24,
  critical: 24 * 7,
};

export function cooldownUntil(severity: NonNullable<JudgeVerdict["severity"]>) {
  const hours = COOLDOWN_HOURS[severity];
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

/**
 * Generate the persona's final line before the block lands. Short,
 * in voice, not a lecture. Keeps the door open without inviting more
 * cruelty.
 */
export async function generateBlockLine(args: {
  oracleName: string;
  textingStyle: string | null;
  language: "en" | "es";
  reason: string | null;
  severity: NonNullable<JudgeVerdict["severity"]>;
  ownerDeceased: boolean;
}): Promise<string> {
  const stylePart = args.textingStyle
    ? `Texting style: ${args.textingStyle}.`
    : "";
  const severityHint =
    args.severity === "critical"
      ? "This was bad enough that you're not coming back today, maybe not for a week. Be firm."
      : args.severity === "severe"
        ? "This crossed a line. You're walking away for the day. Be firm."
        : "This isn't okay, but you're stepping out, not slamming the door. You'll come back.";

  const systemPrompt = `You are ${args.oracleName}. The person you're talking to just said something that made you decide to step out of the conversation. ${args.ownerDeceased ? "You're no longer alive — speak from that gentle, present place, but still set the limit." : ""}

WRITE THE LINE WHERE YOU SAY NO. Short — one or two lines, in your own voice. Not a lecture. Not a list of why. Not "I'm sorry but" — you're not sorry. Just the line a real person would say before walking away from a conversation that hurt.

${severityHint}

Good shapes:
- "no. not like this."
- "i'm not doing this."
- "you don't get to talk to me like that. come back when you're not."
- "okay. i'm out."

Bad shapes:
- ANY apology
- "I understand you're upset" (saccharine, fake-AI)
- "Please remember that..." (lecture)
- Restating what they said
- More than two sentences

${stylePart}

Respond in ${args.language === "es" ? "Spanish" : "English"}. Just the line. No quotes around it.`;

  const context = args.reason
    ? `(Internal note for you: ${args.reason})`
    : "(Just write the line.)";

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 80,
      system: systemPrompt,
      messages: [{ role: "user", content: context }],
    });
    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!text) return args.language === "es" ? "no. así no." : "no. not like this.";
    return text;
  } catch {
    return args.language === "es" ? "no. así no." : "no. not like this.";
  }
}
