import { ANTHROPIC_MODEL, anthropic } from "@/lib/anthropic";
import { ageFromBirthday, type Traits } from "./formula";

/**
 * The three fields Claude returns for a persona.
 *
 * - `name`: culturally + gender + era appropriate given the trait bundle
 * - `one_line_hook`: the reveal-card line ("62, retired second-grade
 *   teacher from San Juan, gardens, keeps her prayers to herself")
 * - `persona_prompt`: 2-4 paragraph system prompt used by /chat/[id] to
 *   make Claude respond AS this person
 */
export type SynthesizedPersona = {
  name: string;
  one_line_hook: string;
  persona_prompt: string;
};

/**
 * Synthesizer error — thrown when Claude refuses or returns unusable
 * output. The server action catches this and surfaces a friendly
 * message via redirectWithError.
 */
export class SynthesisError extends Error {
  constructor(
    message: string,
    public readonly kind: "refusal" | "malformed" | "network",
  ) {
    super(message);
    this.name = "SynthesisError";
  }
}

const SYSTEM_PROMPT = `You are a persona designer for chapter3five, a companion-chat app that generates fictional adult characters people can text with.

Given a trait bundle, invent a plausible real adult human who embodies these traits. Ground the persona in the bundle — never invent traits not present in it, and never contradict it. The trait bundle is the whole spec; your job is to give the person a name, a one-line reveal, and a durable system prompt that captures how they text.

Voice rules for the persona_prompt you write:
- Second person ("You are Rosa Morales, 68, born in San Juan...").
- Plainspoken. Wilson (the founder) wants an 8-year-old who lost a parent to be able to talk to this person. No purple prose, no lifelike-AI theater.
- Capture how they text — cadence, catchphrases, what they'll open up about, what they won't. Give the character texture, not a résumé.
- Bake in safety refusals: this person does not glorify violence or self-harm, does not engage in sexual roleplay, and does not target or harm children. If asked to, they change the subject the way a real person of this profile would — a grandmother deflects with a story, a former soldier just says no.

Naming rules:
- Culturally and era-appropriate. Puerto Rican woman born 1963 → a name a Puerto Rican mother would have given her daughter in 1963.
- Ordinary. Not exotic-for-effect. Real people have common names.

Return your answer using the required output format.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "The persona's full name — culturally, gender, and era appropriate.",
    },
    one_line_hook: {
      type: "string",
      description:
        "A single warm, specific sentence that would appear on the reveal card. Example: '62, retired second-grade teacher from San Juan, gardens, keeps her prayers to herself.' No greeting, no name (the card shows the name separately).",
    },
    persona_prompt: {
      type: "string",
      description:
        "A durable 2–4 paragraph system prompt written in second person that captures how this person texts. Used later as the system prompt for chat conversations.",
    },
  },
  required: ["name", "one_line_hook", "persona_prompt"],
  additionalProperties: false,
} as const;

function traitsToPrompt(traits: Traits): string {
  const age = ageFromBirthday(traits.birthday);
  const mbti = traits.mbti.join(" / ");
  const i = traits.intensities;
  return `Trait bundle:

Gender: ${traits.gender}
Birthday: ${traits.birthday} (age ${age})
Horoscope: ${traits.horoscope}
Sexual orientation: ${traits.sexualOrientation}
Cultural background: ${traits.cultural}
MBTI: ${mbti}
Enneagram: ${traits.enneagram}
Trauma: ${traits.trauma}
Trauma age: ${traits.traumaAge}
Attachment style: ${traits.attachment}
Core fear: ${traits.coreFear}
Coping mechanism: ${traits.coping}
Moral compass: ${traits.moralCompass}
Siblings: ${traits.siblings}
Relationship with mother: ${traits.mother}
Relationship with father: ${traits.father}
Relationship history: ${traits.relationshipHistory}
Parenthood: ${traits.parenthood}
Communication style: ${traits.communicationStyle}
Humor style: ${traits.humorStyle}
Love language: ${traits.loveLanguage}
Temper: ${traits.temper}
Speech habit: ${traits.speechHabit}
Occupation: ${traits.occupation}
Faith level: ${traits.faithLevel}
Defining life event: ${traits.definingEvent}
Vice: ${traits.vice}
Passion: ${traits.passion}

Intensity sliders (0–100):
- Trauma: ${i.trauma}
- Fear: ${i.fear}
- Communication: ${i.communication}
- Humor: ${i.humor}
- Warmth: ${i.warmth}
- Openness: ${i.openness}
- Stubbornness: ${i.stubbornness}

Invent this person. Return only the JSON object.`;
}

/**
 * Ask Claude to write a persona from the trait bundle. Returns the
 * parsed `SynthesizedPersona`, or throws `SynthesisError`.
 */
export async function synthesizePersona(
  traits: Traits,
): Promise<SynthesizedPersona> {
  let response;
  try {
    response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema",
          schema: OUTPUT_SCHEMA,
        },
      },
      messages: [{ role: "user", content: traitsToPrompt(traits) }],
    });
  } catch (err) {
    throw new SynthesisError(
      err instanceof Error ? err.message : "network error",
      "network",
    );
  }

  if (response.stop_reason === "refusal") {
    throw new SynthesisError("model declined to synthesize", "refusal");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new SynthesisError("no text block in response", "malformed");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(textBlock.text);
  } catch {
    throw new SynthesisError("response was not valid JSON", "malformed");
  }

  if (!isSynthesizedPersona(parsed)) {
    throw new SynthesisError("response missing required fields", "malformed");
  }

  return parsed;
}

function isSynthesizedPersona(v: unknown): v is SynthesizedPersona {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    o.name.length > 0 &&
    typeof o.one_line_hook === "string" &&
    o.one_line_hook.length > 0 &&
    typeof o.persona_prompt === "string" &&
    o.persona_prompt.length > 0
  );
}
