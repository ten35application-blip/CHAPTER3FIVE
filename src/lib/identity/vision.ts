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
  let parsed: VisionAnalysis;
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
    parsed = JSON.parse(raw) as VisionAnalysis;
  } catch {
    throw new VisionAnalysisError("response was not valid JSON", "malformed");
  }

  // Safety gate #2: person must be a discernible adult.
  if (parsed.apparentMinor) {
    throw new VisionAnalysisError("person appears to be a minor", "minor");
  }
  if (!parsed.isUsablePortrait) {
    throw new VisionAnalysisError(
      "no clear human face in the photo",
      "not_a_portrait",
    );
  }

  return parsed;
}
