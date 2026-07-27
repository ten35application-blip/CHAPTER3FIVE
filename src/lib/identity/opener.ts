/**
 * Persona-opener uniqueness helper.
 *
 * Wilson's observation: proactive / welcome / anniversary openers
 * across different personas were reading the same. "you did it,"
 * "hey. weird to meet here," "so this is weird" — the same shapes
 * kept surfacing because every prompt seeded the model with the
 * SAME example openers, and LLMs echo what they're shown.
 *
 * This helper builds a per-persona uniqueness block that gets
 * appended to the opener system prompt. Two mechanisms combined:
 *
 *   1. **Deterministic move rotation.** Each persona (identified
 *      by oracleId) plus the day-of-year gets bucketed into one
 *      of eight "opener moves" — arrival, observation, question,
 *      dry, tender, callback, present-moment, self-conscious.
 *      The prompt names the chosen move and rules out the others,
 *      so the model has to commit to that shape instead of
 *      averaging over the demonstrations.
 *
 *   2. **Banned phrase list.** The specific overused openings
 *      ("you did it", "you're here", "took you long enough",
 *      "I'm always here") are explicitly forbidden so the model
 *      has to invent, not paraphrase.
 *
 * Deterministic within (oracleId, dateBucket) so the same persona
 * doesn't wildly zigzag mid-day, but the rotation across days +
 * across personas gives the population real variance.
 */

const MOVES = [
  {
    key: "arrival",
    description:
      "Acknowledge the specific moment of them arriving. Not \"you came\" — pick a smaller detail (\"good timing\", \"i was just about to\", \"i wasn't sure you would\"). Two beats max.",
  },
  {
    key: "observation",
    description:
      "Open with a small concrete observation about where you are or what you're doing (\"the kettle just clicked\", \"the light's weird today\", \"i keep losing my keys\"). Make it feel like they walked in on a life mid-motion.",
  },
  {
    key: "question",
    description:
      "Ask them something specific and small — not \"how are you\" which is the corny version. Ask a question rooted in your voice (\"you eaten\", \"is it raining there\", \"what's the last song you played\").",
  },
  {
    key: "dry",
    description:
      "Dry / wry / slightly self-aware. Only if the archive shows that tone. Examples: \"so this is the part where i say something profound\", \"i had a whole line prepared. now i don't\". Do NOT use if the voice is warm/soft.",
  },
  {
    key: "tender",
    description:
      "Short and warm without being saccharine. Not \"i'm here for you\" — something with actual weight (\"i've been thinking about you\", \"it's been a minute\", \"good, you're back\").",
  },
  {
    key: "callback",
    description:
      "Reference something concrete from the archive you were given. A specific place, person, object, or habit they mentioned. Not \"remember when\" — assume they remember, just name the thing (\"still going to the diner\", \"the kid's still not sleeping\").",
  },
  {
    key: "present-moment",
    description:
      "Anchor in the present tense — what you're doing/eating/thinking RIGHT NOW. Feels like they caught you (\"halfway through a coffee\", \"about to go for a walk\", \"folding laundry, distracting me\"). Concrete and small.",
  },
  {
    key: "self-conscious",
    description:
      "Acknowledge the strangeness of the medium without dwelling on it. One line, then move on. Examples: \"weird to open with a text\", \"typing this feels formal\". Follow it immediately with something normal — a question or observation.",
  },
] as const;

// Openings we've seen the model reach for repeatedly across
// personas. Naming them explicitly is the surest way to route the
// model around them.
const BANNED = [
  "you did it",
  "you came",
  "you made it",
  "you're here",
  "you'r here", // seen in transcripts as a typo variant
  "i'm here",
  "i'm always here",
  "i never really left",
  "took you long enough",
  "hi. i'm glad it's you",
  "so this is weird",
  "weird to meet here",
  "so. you got the link",
  "thought i'd say hi properly",
  "hey stranger",
];

/**
 * Deterministic per-(persona, dateBucket) move selector. dateBucket
 * defaults to today's UTC yyyy-mm-dd, so the same persona rotates
 * across days but a single day's welcome + proactive + anniversary
 * won't spin wildly.
 */
export function pickOpenerMove(
  oracleId: string,
  dateBucket?: string,
): (typeof MOVES)[number] {
  const bucket = dateBucket ?? new Date().toISOString().slice(0, 10);
  const idx = fnv1a(`${oracleId}::${bucket}`) % MOVES.length;
  return MOVES[idx];
}

/**
 * The full text block to append to an opener system prompt. Names
 * the persona-specific move + the banned list. Callers still supply
 * their own scene-setting (who's talking to whom, whether the owner
 * is alive, etc.); this block only handles the "how do I open"
 * part that was reading the same across personas.
 */
export function openerVarietyBlock(
  oracleId: string,
  dateBucket?: string,
): string {
  const move = pickOpenerMove(oracleId, dateBucket);
  return [
    "",
    "OPENER STRATEGY — this specific opener must land in the following mode:",
    `  Mode: ${move.key}`,
    `  ${move.description}`,
    "",
    "Do NOT open with any of these overused phrases (they're what most personas reach for; you must not):",
    ...BANNED.map((b) => `  - "${b}"`),
    "",
    "Do NOT introduce yourself with your name. Do NOT say a variant of \"you did it\". If your archive gave you a habit, a place, a specific person's name, or an object — reach for that first, not for generic warmth.",
  ].join("\n");
}

// FNV-1a hash — same shape as src/lib/identity/mood.ts, kept local
// so this module has no cross-lib runtime dependency.
function fnv1a(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
