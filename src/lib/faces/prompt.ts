/**
 * Face-prompt builder — turns a rolled trait bundle into a FLUX portrait
 * prompt with hard anatomy grounding.
 *
 * Wilson's rule, verbatim: "the faces have to be perfect and match
 * identity, we can't have missing a nose or eyes or something that
 * doesn't look legit." Every prompt therefore spells out complete facial
 * anatomy explicitly instead of hoping the model infers it.
 *
 * NOTE on negativePrompt: FLUX models on Replicate (1.1 Pro, Dev,
 * Schnell) accept NO negative_prompt input — verified against the live
 * flux-1.1-pro OpenAPI schema. We still build and return it so the
 * contract survives a future model swap (SDXL-family models do take it),
 * but generate.ts does NOT send it to FLUX, and we deliberately do NOT
 * fold it into the positive prompt: mentioning "missing nose" in a
 * diffusion prompt can INDUCE a missing nose. Anatomy safety on FLUX
 * comes from the positive grounding below + safety_tolerance 1.
 */

import {
  ageFromBirthday,
  type Place,
  type Traits,
} from "@/lib/identity/formula";
import { stableSeed } from "@/lib/replicate";

export type FacePrompt = {
  prompt: string;
  negativePrompt: string;
  /** Deterministic per-oracle: same id → same seed → same face on
      regeneration (barring model version drift). */
  seed: number;
};

/**
 * Style aesthetic → what the camera actually sees: hair, clothing,
 * accessories. Keyed on the formula's literal strings so tsc breaks the
 * build if the STYLE_AESTHETICS pool drifts.
 */
const STYLE_HINTS: Record<Traits["styleAesthetic"], string> = {
  "Jeans and a good t-shirt":
    "wearing a well-fitting plain t-shirt, low-effort natural hairstyle, relaxed everyday look",
  "Sundresses and denim jackets":
    "wearing a light sundress layered with a denim jacket, soft casual hairstyle",
  "All-black everything":
    "dressed in all black with a sleek modern edge, sharply kept hair",
  "Business casual but with sneakers":
    "wearing a business-casual blazer over a collared shirt, neat professional hairstyle",
  "Thrifted vintage":
    "wearing a thrifted vintage outfit with retro fabrics and an individualistic haircut",
  "Athleisure head to toe":
    "wearing a clean athletic zip-up, hair pulled back practical and sporty",
  "Buttoned-up preppy":
    "wearing a pressed button-down collared shirt, tidy preppy grooming",
  "Boho, layered, lots of rings":
    "wearing layered boho clothing with earthy jewelry and several rings, loose natural hair",
  "Workwear — boots, canvas, function first":
    "wearing a rugged canvas work jacket, practical no-nonsense haircut",
  "Minimalist neutrals":
    "wearing minimalist neutral-toned clothing, clean simple grooming",
  "Sunday best even on Tuesday":
    "dressed in elegant Sunday-best church attire, carefully styled hair, tasteful modest jewelry",
  "Team gear year-round":
    "wearing a sports-team jacket in team colors, casual devoted-fan look",
  "Cardigans and reading glasses on a chain":
    "wearing a cozy cardigan with reading glasses hanging on a chain around the neck, warm bookish look",
  "Loud shirts, no apologies":
    "wearing a boldly patterned colorful shirt, confident expressive look",
};

const HEIGHT_HINTS: Record<Traits["heightRange"], string> = {
  "Petite (under 5'4\")": "petite frame",
  "Average (5'4\"–5'9\")": "average height and build",
  "Tall (5'10\"+)": "tall frame",
};

/**
 * Verbatim per spec. Not consumed by FLUX (no negative_prompt input) —
 * kept for the contract and for any future model that accepts one.
 */
const NEGATIVE_PROMPT =
  "cartoon, illustration, painting, 3d render, cgi, anime, distorted face, deformed anatomy, missing features, missing nose, missing eyes, extra fingers, extra limbs, blurry, uncanny valley, plastic skin, waxy skin, over-smoothed, airbrushed, low quality, watermark, text, signature, multiple people, split face, two faces, mannequin, doll, mask, wrong ethnicity, wrong age";

/**
 * Build the portrait prompt for one identity.
 *
 * @param traits   The rolled trait bundle (oracles.traits).
 * @param oracleId Stable id — hashed into the deterministic seed.
 */
export function buildFacePrompt(traits: Traits, oracleId: string): FacePrompt {
  const age = ageFromBirthday(traits.birthday);

  // "Prefer not to disclose" → neutral noun; the model decides.
  const noun =
    traits.gender === "Male"
      ? "man"
      : traits.gender === "Female"
        ? "woman"
        : "person";

  // Formula v3 added the `place` trait, but bundles rolled before v3 and
  // stored in oracles.traits won't have it — read defensively and skip
  // the setting cue when absent.
  const place = traits.place as Place | undefined;

  const parts: string[] = [
    `Photorealistic portrait photograph of a ${age}-year-old ${noun} of ${traits.cultural} heritage.`,
    `Realistic skin tone, hair texture, and facial features authentic to their ${traits.cultural} background.`,
    `${capitalize(STYLE_HINTS[traits.styleAesthetic])}; ${HEIGHT_HINTS[traits.heightRange]}.`,
    // Anatomy grounding — Wilson's hard rule, stated positively.
    "A single person alone, head-and-shoulders composition, facing the camera.",
    "Complete facial features clearly visible: both eyes, nose, mouth, both ears, symmetric face.",
    "Warm, natural lighting, shallow depth of field, photojournalistic portrait, sharp focus on face, professional headshot quality, photorealistic, film grain, gentle authentic expression appropriate to their personality.",
  ];

  if (place) {
    const article = place.urbanness === "urban" ? "an" : "a";
    parts.push(
      `Softly blurred background suggesting ${place.city}, ${place.stateAbbrev} — ${article} ${place.urbanness} setting.`,
    );
  }

  return {
    prompt: parts.join(" "),
    negativePrompt: NEGATIVE_PROMPT,
    seed: stableSeed(oracleId),
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
