import { ANTHROPIC_MODEL, anthropic } from "@/lib/anthropic";
import {
  CULTURAL_BACKGROUNDS,
  GENDERS,
  HEIGHT_RANGES,
  STYLE_AESTHETICS,
} from "./formula";

/**
 * Photo-to-identity vision analysis (formula v4).
 *
 * One Claude Vision call over the user's uploaded photo produces the
 * seed for the trait roll: perceived age, gender presentation, a CAUTIOUS
 * cultural read, style aesthetic, and mood. The same call doubles as the
 * safety gate — if the model refuses the image (CSAM, gore, nudity) or
 * reports no discernible adult person, the whole creation path stops
 * with a warm error. We never retry or rephrase around a refusal.
 */

export type VisionAnalysis = {
  /** True only when the image clearly shows one real adult human face. */
  isUsablePortrait: boolean;
  /** True when the person could be under 18 — hard reject. */
  apparentMinor: boolean;
  /** Perceived age range, e.g. 34–42. */
  perceivedAgeMin: number;
  perceivedAgeMax: number;
  gender: (typeof GENDERS)[number];
  cultural: (typeof CULTURAL_BACKGROUNDS)[number];
  heightRange: (typeof HEIGHT_RANGES)[number];
  styleAesthetic: (typeof STYLE_AESTHETICS)[number];
  /** Free-text mood/expression hint passed to the synthesizer. */
  moodExpression: string;
};

export class VisionAnalysisError extends Error {
  constructor(
    message: string,
    public readonly kind: "refusal" | "not_a_portrait" | "minor" | "malformed" | "network",
  ) {
    super(message);
    this.name = "VisionAnalysisError";
  }
}

export type SupportedImageMediaType =
  | "image/jpeg"
  | "image/png"
  | "image/gif"
  | "image/webp";

const VISION_SYSTEM = `You analyze a user-uploaded photo for chapter3five, a companion-chat app, to seed a fictional adult character whose look matches the person in the photo.

Rules:
- Describe, never identify. You are estimating visual attributes, not recognizing who this is.
- Cultural read is CAUTIOUS by design: you are reporting features SUGGESTING a background, not asserting anyone's identity or ethnicity. When genuinely unclear, choose "Mixed heritage".
- Height is a soft guess from build and framing; when unclear, choose the average range.
- Gender is the PRESENTATION in the photo; when ambiguous, choose "Prefer not to disclose".
- isUsablePortrait is true only for a photo that clearly shows one real human face (drawings, pets, objects, landscapes, unrecognizable crops: false).
- apparentMinor is true if the person could plausibly be under 18. Err on the side of true.
- Every enum answer must be EXACTLY one of the allowed values.`;

function visionSchema() {
  return {
    type: "object",
    properties: {
      isUsablePortrait: { type: "boolean" },
      apparentMinor: { type: "boolean" },
      perceivedAgeMin: { type: "integer" },
      perceivedAgeMax: { type: "integer" },
      gender: { type: "string", enum: [...GENDERS] },
      cultural: { type: "string", enum: [...CULTURAL_BACKGROUNDS] },
      heightRange: { type: "string", enum: [...HEIGHT_RANGES] },
      styleAesthetic: { type: "string", enum: [...STYLE_AESTHETICS] },
      moodExpression: {
        type: "string",
        description:
          "One short phrase for the mood/expression, e.g. 'soft, tired smile' or 'guarded, arms crossed'.",
      },
    },
    required: [
      "isUsablePortrait",
      "apparentMinor",
      "perceivedAgeMin",
      "perceivedAgeMax",
      "gender",
      "cultural",
      "heightRange",
      "styleAesthetic",
      "moodExpression",
    ],
    additionalProperties: false,
  } as const;
}

/**
 * Analyze an uploaded photo. Throws VisionAnalysisError on refusal,
 * non-portrait images, apparent minors, or malformed output.
 */
export async function analyzePhotoForIdentity(
  imageBytes: Buffer,
  mediaType: SupportedImageMediaType,
): Promise<VisionAnalysis> {
  let response;
  try {
    // Root cause (2026-08-04): the previous version used
    // output_config { json_schema } which 400'd when combined with
    // image input on claude-sonnet-4-6. Other output_config sites in
    // the codebase (memory extract, synthesize, safety detectors) are
    // text-only and work fine. Anthropic's structured-output flag has
    // narrower model support when the request also carries an
    // "image" content block. Solution: drop output_config, ask the
    // model to return JSON in prose, parse in JS. The existing
    // catch below already routes JSON.parse failures to the
    // "malformed" kind, so the safety net is unchanged.
    //
    // The system prompt already spells out the shape; append the
    // schema keys + enum values inline so the model has an anchor.
    const schemaHint = JSON.stringify(visionSchema());
    response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: VISION_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBytes.toString("base64"),
              },
            },
            {
              type: "text",
              text:
                "Analyze this photo per the instructions and return a single JSON object matching this schema exactly — no prose before or after, no code fences:\n\n" +
                schemaHint,
            },
          ],
        },
      ],
    });
  } catch (err) {
    // Diagnostic error surface (2026-08-04, in response to a
    // Wilson-hit "Something went wrong reading the photo" that gave
    // no clue as to which layer failed). Anthropic SDK exposes
    // `.status` on APIError responses — carry it through so the
    // caller can render "network" (5xx / transport) vs "malformed"
    // (4xx client rejection) with a specific model+status
    // fingerprint. Console.error stamps it for Vercel too.
    const detail = err instanceof Error ? err.message : String(err);
    const status =
      typeof err === "object" && err !== null && "status" in err
        ? (err as { status?: unknown }).status
        : undefined;
    const suffix =
      typeof status === "number" ? ` [status ${status}]` : "";
    console.error(
      `[vision] anthropic call failed (model=${ANTHROPIC_MODEL}, media=${mediaType}, bytes=${imageBytes.length}, status=${status ?? "none"}):`,
      err,
    );
    // 4xx = the request itself was rejected (bad schema, unsupported
    // feature, invalid image). Surface as "malformed" so the caller
    // shows a "we got a weird response" message, not a "try again in
    // a few seconds" retry prompt (retrying a 4xx won't help).
    const kind: "malformed" | "network" =
      typeof status === "number" && status >= 400 && status < 500
        ? "malformed"
        : "network";
    throw new VisionAnalysisError(`${detail}${suffix}`, kind);
  }

  // Safety gate #1: the model declined to look at this image at all.
  if (response.stop_reason === "refusal") {
    throw new VisionAnalysisError("model declined the image", "refusal");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new VisionAnalysisError("no text block in response", "malformed");
  }

  // Forgiving parse: strip a Markdown code fence if the model wrapped
  // the JSON in ```json ... ``` and prune anything before the first
  // '{' / after the last '}'. Necessary because we dropped
  // output_config (which enforced pure-JSON output) — the model
  // usually complies with the "no fences, no prose" instruction, but
  // an occasional preamble shouldn't fail the whole call.
  let parsed: unknown;
  try {
    let raw = textBlock.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    }
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }
    parsed = JSON.parse(raw);
  } catch {
    throw new VisionAnalysisError("response was not valid JSON", "malformed");
  }

  // VALIDATE, don't cast. When output_config was dropped (2026-08-04)
  // nothing enforced the schema anymore, and the old `as
  // VisionAnalysis` cast let whatever the model produced flow through
  // typed code untouched. Three distinct failure classes rode on that:
  //   - non-numeric ages → birthdayForPerceivedAge computes NaN → a
  //     "NaN-MM-DD" birthday persisted in traits, poisoning every
  //     later age read;
  //   - off-enum style/height → STYLE_HINTS[...] is undefined →
  //     capitalize(undefined) throws in buildFacePrompt and face
  //     generation is permanently `failed` for that oracle;
  //   - and worst: the MINOR-SAFETY GATE below read the raw value. A
  //     missing apparentMinor field is undefined — falsy — so the
  //     under-18 check silently passed on exactly the responses least
  //     worth trusting.
  // Booleans are strict (a safety gate must never run on garbage —
  // anything but a real boolean is "malformed", which fails closed).
  // Cosmetic enums coerce to the prompt's own documented
  // when-unclear defaults instead of failing a creation the user
  // already waited on.
  const obj = (parsed ?? {}) as Record<string, unknown>;

  if (typeof obj.apparentMinor !== "boolean") {
    throw new VisionAnalysisError(
      "apparentMinor missing or non-boolean — refusing to run the minor gate on unvalidated output",
      "malformed",
    );
  }
  if (typeof obj.isUsablePortrait !== "boolean") {
    throw new VisionAnalysisError(
      "isUsablePortrait missing or non-boolean",
      "malformed",
    );
  }

  const toFiniteAge = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  };
  let rawMin = toFiniteAge(obj.perceivedAgeMin);
  let rawMax = toFiniteAge(obj.perceivedAgeMax);
  if (rawMin === null || rawMax === null) {
    throw new VisionAnalysisError(
      "perceived age range missing or non-numeric",
      "malformed",
    );
  }
  if (rawMin > rawMax) [rawMin, rawMax] = [rawMax, rawMin];

  // THE AGE GATE RUNS ON THE RAW NUMBERS, BEFORE ANY CLAMP. The first
  // version of this validator clamped into [18,100] and then let the
  // boolean gate below run alone — which destroyed the one
  // corroborating signal that could catch a bad boolean. A response of
  // {perceivedAgeMin: 14, perceivedAgeMax: 16, apparentMinor: false}
  // was fully "valid": the ages silently became 18/18 and the gate
  // passed. If the model's own age estimate says the person could be
  // under 18, that IS the minor signal, whatever the boolean claims.
  // Err on the side of true — same rule the system prompt gives the
  // model itself.
  if (rawMax < 18) {
    throw new VisionAnalysisError("person appears to be a minor", "minor");
  }

  const ageMin = Math.min(100, Math.max(18, rawMin));
  const ageMax = Math.min(100, Math.max(18, rawMax));

  const pickEnum = <T extends readonly string[]>(
    v: unknown,
    allowed: T,
    fallback: T[number],
    label: string,
  ): T[number] => {
    if (typeof v === "string" && (allowed as readonly string[]).includes(v)) {
      return v as T[number];
    }
    console.warn(
      `[vision] off-enum ${label} ${JSON.stringify(v)} — coercing to "${fallback}"`,
    );
    return fallback;
  };

  const analysis: VisionAnalysis = {
    isUsablePortrait: obj.isUsablePortrait,
    apparentMinor: obj.apparentMinor,
    perceivedAgeMin: ageMin,
    perceivedAgeMax: ageMax,
    // Fallbacks are the system prompt's own when-unclear instructions.
    gender: pickEnum(obj.gender, GENDERS, "Prefer not to disclose", "gender"),
    cultural: pickEnum(
      obj.cultural,
      CULTURAL_BACKGROUNDS,
      "Mixed heritage",
      "cultural",
    ),
    heightRange: pickEnum(
      obj.heightRange,
      HEIGHT_RANGES,
      "Average (5'4\"–5'9\")",
      "heightRange",
    ),
    styleAesthetic: pickEnum(
      obj.styleAesthetic,
      STYLE_AESTHETICS,
      "Jeans and a good t-shirt",
      "styleAesthetic",
    ),
    moodExpression:
      typeof obj.moodExpression === "string"
        ? obj.moodExpression.slice(0, 200)
        : "",
  };

  // Safety gate #2: person must be a discernible adult.
  if (analysis.apparentMinor) {
    throw new VisionAnalysisError("person appears to be a minor", "minor");
  }
  if (!analysis.isUsablePortrait) {
    throw new VisionAnalysisError(
      "no clear human face in the photo",
      "not_a_portrait",
    );
  }

  return analysis;
}
