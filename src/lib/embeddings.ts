/**
 * OpenAI text embeddings for persona memory semantic search.
 *
 * Why OpenAI: Anthropic doesn't ship a public embeddings API.
 * text-embedding-3-small is 1536 dim, $0.02 per million tokens —
 * negligible cost at our scale. We don't send any user PII through
 * here that we're not already sending to Anthropic; embeddings are
 * just numerical hashes of memory content.
 *
 * Set OPENAI_API_KEY in env. Without it, embeddings is a no-op —
 * memory still works, just falls back to weight-based retrieval.
 */

const ENDPOINT = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";

export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: MODEL,
        input: trimmed.slice(0, 8000), // model context cap, plenty for memories
        encoding_format: "float",
      }),
    });
    if (!res.ok) {
      console.error("openai embed failed:", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as {
      data?: { embedding: number[] }[];
    };
    return data.data?.[0]?.embedding ?? null;
  } catch (err) {
    console.error("openai embed exception:", err);
    return null;
  }
}

/**
 * Format a number array as the pgvector literal Supabase expects when
 * inserting via the REST API: '[0.1,0.2,...]'.
 */
export function toPgVector(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}
