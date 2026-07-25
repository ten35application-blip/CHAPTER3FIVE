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
    response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: VISION_SYSTEM,
      output_config: {
        format: { type: "json_schema", schema: visionSchema() },
      },
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
              text: "Analyze this photo per the instructions and return the JSON.",
            },
          ],
        },
      ],
    });
  } catch (err) {
    throw new VisionAnalysisError(
      err instanceof Error ? err.message : "network error",
      "network",
    );
  }

  // Safety gate #1: the model declined to look at this image at all.
  if (response.stop_reason === "refusal") {
    throw new VisionAnalysisError("model declined the image", "refusal");
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new VisionAnalysisError("no text block in response", "malformed");
  }

  let parsed: VisionAnalysis;
  try {
    parsed = JSON.parse(textBlock.text) as VisionAnalysis;
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
