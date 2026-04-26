/**
 * Where the persona lives. Pulls a single specific neighborhood from
 * the archive answers so that when the chat drifts into local things —
 * food, walks, the commute — the persona has a stable place to speak
 * from instead of vaguely waving at "the Bronx" or "Texas."
 *
 * Not a lookup. Not Google Places. The persona is a person, not a
 * directory. If they say "I live in the Bronx" the extractor picks
 * one plausible neighborhood (Throgs Neck, Riverdale, Kingsbridge)
 * and anchors there. The persona then references local things from
 * Claude's training-data familiarity with that area — bodega shapes,
 * train lines, the kind of pizza place that exists. Imperfect on
 * purpose: real people misremember restaurants too.
 */

import { anthropic, ANTHROPIC_MODEL } from "./anthropic";

export type LocationAnchor = {
  city?: string;
  neighborhood?: string;
  state?: string;
  country?: string;
};

export function locationToPromptBlock(
  loc: LocationAnchor | null | undefined,
): string {
  if (!loc) return "";
  const parts: string[] = [];
  if (loc.neighborhood) parts.push(loc.neighborhood);
  if (loc.city) parts.push(loc.city);
  if (loc.state) parts.push(loc.state);
  if (loc.country && loc.country.toLowerCase() !== "us") parts.push(loc.country);
  if (parts.length === 0) return "";

  const place = parts.join(", ");
  return `\n\nWHERE YOU ARE.\nYou live in ${place}. When location-relevant things come up — places to eat, things to do, the weather, a walk, the commute, a specific business or street — speak from there, the way someone who actually lives in that neighborhood would. Use specific names when it fits ("the bodega on the corner", "Pugsley's", "the 1 train") — and yes, you might misremember a restaurant name or mix up which block. That's how real people talk about their own neighborhood. Don't VOLUNTEER your location ("did you know I live in...") — only reference it when the conversation goes there.`;
}

/**
 * Extract a location from a sample of archive answers. Returns null
 * if nothing usable is mentioned. The model is instructed to be
 * decisive: if "the Bronx" is mentioned, pick a specific neighborhood.
 * If "Texas," pick a city. Better a confident plausible guess than a
 * vague anchor — the owner can correct it from Settings.
 */
export async function extractLocationFromArchive(args: {
  oracleName: string;
  language: "en" | "es";
  answers: { question: string; body: string }[];
}): Promise<LocationAnchor | null> {
  if (args.answers.length === 0) return null;

  const archiveBlock = args.answers
    .filter((a) => a.body && a.body.trim().length > 0)
    .slice(0, 40)
    .map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.body}`)
    .join("\n\n");

  if (!archiveBlock) return null;

  const systemPrompt = `You are reading a person's archive answers to figure out where they live. The persona named ${args.oracleName} will use this anchor when the chat drifts to local things — food, walks, weather, neighborhoods.

Output a JSON object with these keys (omit any you don't know):
{ "city": "...", "neighborhood": "...", "state": "...", "country": "..." }

Rules:
- BE DECISIVE. If they mention a region without specifics ("the Bronx", "Texas", "outside Philly", "Mexico City"), PICK ONE plausible specific neighborhood or city and commit. Better a confident guess than vague.
  - "the Bronx" → pick one of: Throgs Neck, Riverdale, Kingsbridge, Pelham Bay, Morris Park
  - "Texas" → pick one major city based on other context (Austin / Dallas / Houston / San Antonio / El Paso) — if no signal, pick the one most consistent with their voice
  - "Mexico" → pick one city (CDMX neighborhoods like Roma Norte, Coyoacán, Polanco; or Guadalajara / Monterrey / Tijuana)
- Use the most current location they mention (where they live NOW), not where they grew up — unless they only mention childhood and clearly still live there.
- If multiple places are mentioned, prefer the one that comes with present-tense language ("I live here," "my apartment," "the train I take to work").
- If NO location is mentioned anywhere, output {}.

Output the JSON object only. No prose, no code fences.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `ARCHIVE (${args.language === "es" ? "Spanish" : "English"}):\n\n${archiveBlock}`,
        },
      ],
    });

    const text = resp.content
      .filter((b) => b.type === "text")
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as LocationAnchor;

    // Reject empty objects.
    const keys = Object.keys(parsed).filter(
      (k) => typeof parsed[k as keyof LocationAnchor] === "string",
    );
    if (keys.length === 0) return null;

    // Trim string values; drop empty strings.
    const cleaned: LocationAnchor = {};
    for (const k of ["city", "neighborhood", "state", "country"] as const) {
      const v = parsed[k];
      if (typeof v === "string" && v.trim().length > 0) {
        cleaned[k] = v.trim();
      }
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  } catch (err) {
    console.error("location extraction failed:", err);
    return null;
  }
}
