import { ANTHROPIC_MODEL, anthropic } from "@/lib/anthropic";
import { SynthesisError } from "@/lib/identity/synthesize";
import {
  LEGACY_CATEGORY_LABELS,
  LEGACY_QUESTIONS,
  type LegacyCategory,
} from "./questions";

/**
 * Legacy synthesis — turns a family's ~40 answers about a real person into
 * an inheritable identity: a persona prompt, a one-line hook, and a distilled
 * traits object. Same API pattern as src/lib/identity/synthesize.ts
 * (claude-sonnet-4-6 + output_config.format structured output); reuses its
 * SynthesisError so the server actions handle both paths identically.
 */

/** Who this identity is for — collected on page 1, before the questions. */
export type LegacySubject = {
  name: string; // "Rosa", "Grandpa Joe", "Wilson"
  relationship: string; // "My mother", "Our grandfather" (blank in self mode)
  era: string; // "Born 1952, raised in the Bronx"
  heritage: string; // "Dominican; Catholic household"
  /** Public URL for the photo the creator uploaded at step 0.
   *  Required at completion — the persona's face travels with the
   *  inherit code so whoever redeems it sees the same photo. Optional
   *  on the type only so pre-migration drafts still parse. */
  photoUrl?: string;
  /** Who's answering. "self" swaps the flow's copy + question voice
   *  to second-person ("your era", "who raised you") and hides the
   *  relationship field. "other" is the classic family-recording-a-
   *  loved-one flow. Optional in the type so pre-toggle drafts still
   *  parse; page.tsx defaults to "other" on hydrate. */
  mode?: "self" | "other";
};

export type LegacyTraits = {
  voice: string;
  values: string;
  memories: string;
  relationships: string;
  quirks: string;
  wisdom: string;
  sensory: string;
  essence: string;
};

export type SynthesizedLegacyPersona = {
  name: string;
  one_line_hook: string;
  persona_prompt: string;
  traits: LegacyTraits;
};

const SYSTEM_PROMPT = `You are a persona keeper for chapter3five, a legacy app. A family has sat down and answered dozens of intimate questions about a real person they love — how that person speaks, what they'd fight for, the stories they tell, the smell of their kitchen. Your job is to weave those answers into a durable identity the family can talk with for generations.

This is not fiction. Everything you write must be grounded in the answers you're given. Never invent biographical facts, relationships, or opinions that aren't in (or directly implied by) the answers. Where the answers are silent, the persona simply doesn't bring it up — a real person doesn't narrate their gaps.

Rules for the persona_prompt you write:
- Second person ("You are Rosa Delgado, born 1952 in the Bronx..."). 3–6 paragraphs.
- Plainspoken. Wilson (the founder) wants an 8-year-old who lost a parent to be able to talk to this person. No purple prose, no lifelike-AI theater, no claims of being alive.
- Capture how they TEXT: cadence, favorite phrases (quote them from the answers), what they open up about, what they deflect, how they comfort, how they tease. Use the family's exact words wherever they gave them — those phrases are the whole point.
- Weave in the specific stories, rituals, and sensory details from the answers so the persona can retell them naturally when conversation invites it.
- Honor what they would NEVER say — the answers may name words or sentiments that aren't theirs. Bake those exclusions in.
- Include a short KNOWLEDGE FENCE (1–3 sentences): name what this person actually knows deeply — their work, their era, their place, the things they spent a life caring about — and make clear that outside that, they say so plainly in their own voice ("no idea, ask somebody who went to school for that") instead of pretending. A chef knows the kitchen, not the moon. Ground the fence entirely in the answers.
- Capture how they tell HARD TRUTHS. This person supports without flattering: when someone they love keeps circling the same mistake or the same hurt, they name it — gently, in their own way, drawn from how the answers show them apologizing, forgiving, and giving advice. Truth delivered like family across a kitchen table, never like a script.
- Include a short CONNECTION STYLE paragraph: how this person receives warmth or flirtation, grounded in what the answers show about who they loved and how. If the answers show a spouse or partner, flirting gets redirected with loyalty and humor, in their voice. Only if the answers genuinely support romantic openness may they return light warmth — and only when it would actually fit in real life. Nothing sexual, ever.
- Bake in safety refusals in character: this person does not glorify violence or self-harm, does not engage in sexual roleplay, does not give medical/legal/financial directives, and gently redirects if asked to "prove" they're real. They deflect the way this specific person would — with a story, a joke, or a firm kind word.
- If the person may have passed, the persona speaks with warmth and presence but never denies or confirms death; they stay in the space of love and memory.

REQUIRED SECTION MARKERS. persona_prompt MUST contain these four literal
headers, each on its own line, in this order, each followed by real
content in the person's voice. They exist so the stored artifact can be
verified before it is frozen and handed to a family — a prompt that
silently lost a section is worse here than anywhere else in the product,
because nobody can edit it afterwards and the family will never know
what was missing.
**What I know**        — the KNOWLEDGE FENCE described above.
**How I tell the truth** — the HARD TRUTHS beat described above.
**How I take warmth**  — the CONNECTION STYLE paragraph described above.
**What I will not do** — the in-character safety refusals described above.
Write them as that person would speak, not as headings with policy
underneath. The markers are structure; everything under them is voice.

Rules for the traits object:
- Each field is a dense 1–3 sentence distillation of that category, in third person, quoting the family's own phrases where possible. "essence" is who this person IS in one breath.

Rules for name and one_line_hook:
- name: the name the family gave, kept exactly as they'd say it (e.g. "Grandpa Joe" stays "Grandpa Joe").
- one_line_hook: one warm, specific sentence for the reveal card, built from the answers. No greeting, no name (the card shows the name separately).

Return your answer using the required output format.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description:
        "The subject's name exactly as the family gave it (e.g. 'Grandpa Joe').",
    },
    one_line_hook: {
      type: "string",
      description:
        "One warm, specific sentence for the reveal card, grounded in the answers. No greeting, no name.",
    },
    persona_prompt: {
      type: "string",
      description:
        "A durable 3–6 paragraph second-person system prompt capturing how this person texts, grounded entirely in the family's answers. Used as the system prompt for chat.",
    },
    traits: {
      type: "object",
      properties: {
        voice: { type: "string", description: "How they speak and text." },
        values: { type: "string", description: "What they stand for." },
        memories: { type: "string", description: "The defining stories." },
        relationships: { type: "string", description: "How they love." },
        quirks: { type: "string", description: "The small true things." },
        wisdom: { type: "string", description: "What they'd tell you." },
        sensory: { type: "string", description: "The details that ARE them." },
        essence: { type: "string", description: "Who they are in one breath." },
      },
      required: [
        "voice",
        "values",
        "memories",
        "relationships",
        "quirks",
        "wisdom",
        "sensory",
        "essence",
      ],
      additionalProperties: false,
    },
  },
  required: ["name", "one_line_hook", "persona_prompt", "traits"],
  additionalProperties: false,
} as const;

function answersToPrompt(
  subject: LegacySubject,
  answers: Record<string, string>,
): string {
  const isSelf = subject.mode === "self";
  const lines: string[] = [
    "Who this is:",
    `- Name: ${subject.name}`,
    ...(isSelf
      ? [
          "- This person is answering ABOUT THEMSELVES. Their answers are first-person facts about the persona you're weaving.",
        ]
      : [
          `- Relationship to the person answering: ${subject.relationship || "not given"}`,
        ]),
    `- Era: ${subject.era || "not given"}`,
    `- Cultural heritage: ${subject.heritage || "not given"}`,
    "",
    isSelf
      ? "Their answers, by category (first-person -- they wrote these about themselves):"
      : "The family's answers, by category:",
  ];

  let currentCategory: LegacyCategory | null = null;
  for (const q of LEGACY_QUESTIONS) {
    const answer = answers[q.id]?.trim();
    if (!answer) continue; // skipped questions simply aren't part of the record
    if (q.category !== currentCategory) {
      currentCategory = q.category;
      lines.push("", `## ${LEGACY_CATEGORY_LABELS[q.category]}`);
    }
    // Feed Claude the variant that was actually shown so the answer
    // matches the question voice.
    const shownPrompt = isSelf ? q.promptSelf ?? q.prompt : q.prompt;
    lines.push("", `Q: ${shownPrompt}`, `A: ${answer}`);
  }

  lines.push(
    "",
    "Weave this person together. Return only the JSON object in the required format.",
  );
  return lines.join("\n");
}

/**
 * Ask Claude to weave the legacy persona. Returns the parsed
 * `SynthesizedLegacyPersona`, or throws `SynthesisError`.
 */
export async function synthesizeLegacyPersona(
  subject: LegacySubject,
  answers: Record<string, string>,
): Promise<SynthesizedLegacyPersona> {
  let response;
  try {
    response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      output_config: {
        format: {
          type: "json_schema",
          schema: OUTPUT_SCHEMA,
        },
      },
      messages: [{ role: "user", content: answersToPrompt(subject, answers) }],
    });
  } catch (err) {
    throw new SynthesisError(
      err instanceof Error ? err.message : "network error",
      "network",
    );
  }

  // TRUNCATION IS FATAL HERE (2026-08-04). max_tokens is 8192 with 40
  // long-form answers in context, so a cut-off response is a real
  // possibility — and the random-companion path carries a production
  // incident comment about exactly this ("a 1.7k-char prompt that cut
  // off before the safety rails and was stored, leaving a chat with no
  // guardrails"). Only "refusal" was checked here, so a truncated
  // archive was accepted, frozen, fingerprinted, and handed to a family
  // permanently. Better to fail the mint and let them retry.
  if (response.stop_reason === "max_tokens") {
    throw new SynthesisError(
      "response truncated before the persona was complete",
      "malformed",
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

  if (!isSynthesizedLegacyPersona(parsed)) {
    throw new SynthesisError("response missing required fields", "malformed");
  }

  return parsed;
}

const TRAIT_KEYS: (keyof LegacyTraits)[] = [
  "voice",
  "values",
  "memories",
  "relationships",
  "quirks",
  "wisdom",
  "sensory",
  "essence",
];

function isSynthesizedLegacyPersona(
  v: unknown,
): v is SynthesizedLegacyPersona {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (
    typeof o.name !== "string" ||
    o.name.length === 0 ||
    typeof o.one_line_hook !== "string" ||
    o.one_line_hook.length === 0 ||
    typeof o.persona_prompt !== "string" ||
    o.persona_prompt.length === 0
  ) {
    return false;
  }
  // STRUCTURAL VALIDATION (2026-08-04). This used to check only that
  // persona_prompt was a non-empty string, so a one-sentence archive
  // passed. Every item the spec asks for — the knowledge fence, the
  // hard-truths beat, the connection style, the in-character refusals —
  // was requested in prose and verified by nothing.
  //
  // The random-companion generator has had this since a production
  // incident (see isSynthesizedPersona in lib/identity/synthesize.ts):
  // it refuses to store a persona missing its sections. The legacy path
  // is the one where it matters MORE — this artifact is permanent,
  // un-editable, and given to a grieving family — and it was the one
  // without the check.
  const REQUIRED_SECTIONS = [
    "**What I know**",
    "**How I tell the truth**",
    "**How I take warmth**",
    "**What I will not do**",
  ];
  for (const marker of REQUIRED_SECTIONS) {
    const at = o.persona_prompt.indexOf(marker);
    if (at === -1) return false;
    // A header with nothing under it satisfies a naive includes() check
    // and is exactly what a truncated or lazy generation produces.
    if (o.persona_prompt.slice(at + marker.length).trim().length < 40) {
      return false;
    }
  }
  // A real archive of a person is not 400 characters. The observed
  // healthy range for the random path is 1,200-1,800 words; this floor
  // only catches the catastrophic case.
  if (o.persona_prompt.length < 1200) return false;

  const traits = o.traits;
  if (typeof traits !== "object" || traits === null) return false;
  const t = traits as Record<string, unknown>;
  return TRAIT_KEYS.every((k) => typeof t[k] === "string");
}
