/**
 * Thin wrapper around Replicate for image generation.
 *
 * Two uses:
 *  - Identity avatars (one-time per identity, opt-in)
 *  - In-chat persona photos ("send me a photo of the pizza" → image)
 *
 * Requires REPLICATE_API_TOKEN in env (Vercel project settings).
 * Returns a public-https URL to the generated image. Caller is
 * responsible for downloading + persisting to Supabase storage if
 * we want long-term ownership.
 */

const REPLICATE_API = "https://api.replicate.com/v1";

// Avatars (no reference image): FLUX schnell. Fast, ~$0.003/image.
const FLUX_SCHNELL = "black-forest-labs/flux-schnell";

// In-chat persona photos (WITH reference image for face consistency):
// FLUX Kontext Pro takes an input image + prompt and preserves the
// subject identity across the new scene. ~$0.04/image.
// Reference: https://replicate.com/black-forest-labs/flux-kontext-pro
const FLUX_KONTEXT_PRO = "black-forest-labs/flux-kontext-pro";

type GenerateOptions = {
  prompt: string;
  /** 1:1 for avatars, 4:3 / 3:4 for in-chat photos. */
  aspectRatio?: "1:1" | "4:3" | "3:4" | "16:9";
  /** Replicate runs deterministically when seed is given. */
  seed?: number;
  /** If provided, uses Kontext Pro (face-preserving) instead of
      schnell. The model conditions generation on this reference. */
  inputImageUrl?: string;
  /** Safety tolerance: 0 (strictest) to 6 (most permissive). We
      run at 1 — very strict, near-zero NSFW pass-through. */
  safetyTolerance?: number;
};

async function runPrediction(
  model: string,
  input: Record<string, unknown>,
): Promise<string | null> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    console.error(
      "[replicate] REPLICATE_API_TOKEN not set; skipping generation",
    );
    return null;
  }
  const res = await fetch(
    `${REPLICATE_API}/models/${model}/predictions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({ input }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(
      `[replicate] generation failed: ${res.status} ${text.slice(0, 400)}`,
    );
    return null;
  }
  const data = (await res.json()) as {
    status?: string;
    output?: string[] | string | null;
    error?: string | null;
  };
  if (data.status !== "succeeded") {
    console.error(
      "[replicate] prediction not succeeded:",
      data.status,
      data.error,
    );
    return null;
  }
  const output = data.output;
  if (Array.isArray(output) && output.length > 0) return output[0];
  if (typeof output === "string") return output;
  return null;
}

export async function generateImage(
  opts: GenerateOptions,
): Promise<string | null> {
  // With a reference image → use Kontext Pro for face preservation.
  if (opts.inputImageUrl) {
    return runPrediction(FLUX_KONTEXT_PRO, {
      prompt: opts.prompt,
      input_image: opts.inputImageUrl,
      aspect_ratio: opts.aspectRatio ?? "1:1",
      output_format: "webp",
      safety_tolerance: opts.safetyTolerance ?? 1,
      ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
    });
  }

  // No reference → fast schnell for the one-time avatar gen.
  return runPrediction(FLUX_SCHNELL, {
    prompt: opts.prompt,
    aspect_ratio: opts.aspectRatio ?? "1:1",
    output_format: "webp",
    output_quality: 88,
    num_outputs: 1,
    ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
  });
}

/**
 * Stable seed derived from a stable string (oracle id, etc.) so
 * the same persona keeps a consistent visual style across photos.
 */
export function stableSeed(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  // Keep positive 31-bit so Replicate accepts it.
  return Math.abs(h) % 2147483647;
}
