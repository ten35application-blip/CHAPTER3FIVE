/**
 * Image + text content moderation via OpenAI's free Moderation API.
 *
 * Run on user-attached chat photos before we forward them to Anthropic
 * vision. Catches: sexual content (incl. minors), graphic violence,
 * self-harm, hate. App Store 1.2 (UGC moderation) wants this surface
 * present and demonstrable; the moderation endpoint is free, so it's
 * pure upside.
 *
 * No-op (returns ok=true) when OPENAI_API_KEY isn't set, so the chat
 * doesn't break in dev. In production we should set the key.
 */

const ENDPOINT = "https://api.openai.com/v1/moderations";
const MODEL = "omni-moderation-latest";

export type ModerationResult = {
  ok: boolean;
  flagged: boolean;
  categories: string[];
};

export async function moderateImage(
  imageUrl: string,
): Promise<ModerationResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: true, flagged: false, categories: [] };

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: [{ type: "image_url", image_url: { url: imageUrl } }],
      }),
    });
    if (!res.ok) {
      // If moderation itself errors, don't block the chat — log and
      // pass through. Better UX than a false rejection.
      console.error("moderation http error:", res.status, await res.text());
      return { ok: true, flagged: false, categories: [] };
    }
    const data = (await res.json()) as {
      results?: {
        flagged: boolean;
        categories: Record<string, boolean>;
      }[];
    };
    const result = data.results?.[0];
    if (!result) return { ok: true, flagged: false, categories: [] };

    const tripped = Object.entries(result.categories)
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    return { ok: !result.flagged, flagged: result.flagged, categories: tripped };
  } catch (err) {
    console.error("moderation exception:", err);
    return { ok: true, flagged: false, categories: [] };
  }
}
