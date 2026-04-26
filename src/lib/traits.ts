/**
 * Persona traits — orientation, romantic openness, and the specific
 * identity quirks that make a randomized persona feel like a real
 * person instead of a demographic average. The user discovers these
 * by talking; nothing is surfaced on a profile page.
 *
 * Two paths:
 *  - Real-mode oracles: extracted from archive answers (Claude pass).
 *  - Randomized oracles: rolled from weighted pools at synthesis time.
 *
 * The randomizer is intentionally weird. The product's promise on
 * randomized identities is that you always meet someone new — so the
 * quirk pool is wide, specific, and skews unusual. No "loves coffee."
 * Things you'd remember.
 *
 * Hard limits enforced in the chat prompt, not here:
 *  - No explicit / sexual content from the persona, ever, regardless
 *    of orientation or openness. Flirting maxes out at compliments
 *    and gentle teasing.
 *  - No flirting in memorial mode (deceased owner).
 *  - The user's "not like that" always closes the romantic register.
 */

import { anthropic, ANTHROPIC_MODEL } from "./anthropic";

export type Orientation =
  | "straight"
  | "gay"
  | "lesbian"
  | "bi"
  | "pan"
  | "ace"
  | "unspecified";

export type Openness =
  | "flirty"
  | "warm"
  | "reserved"
  | "partnered"
  | "uninterested";

export type Traits = {
  orientation?: Orientation;
  openness?: Openness;
  quirks?: string[];
};

export const ORIENTATION_VALUES: Orientation[] = [
  "straight",
  "gay",
  "lesbian",
  "bi",
  "pan",
  "ace",
  "unspecified",
];

export const OPENNESS_VALUES: Openness[] = [
  "flirty",
  "warm",
  "reserved",
  "partnered",
  "uninterested",
];

// Weighted pool. Numbers approximate reality with meaningful LGBT
// representation, but it's a generator, not a census. Adjustable.
const ORIENTATION_WEIGHTS: [Orientation, number][] = [
  ["straight", 70],
  ["bi", 10],
  ["gay", 6],
  ["lesbian", 6],
  ["pan", 4],
  ["ace", 2],
  ["unspecified", 2],
];

const OPENNESS_WEIGHTS: [Openness, number][] = [
  ["warm", 35],
  ["flirty", 20],
  ["reserved", 15],
  ["partnered", 25],
  ["uninterested", 5],
];

// Wide, weird, specific. Pulled at random with most personas getting
// 0–2 quirks. The goal is "you've never met someone like this."
// App-Store safe: identity flavors and unusual hobbies, no explicit
// content. The chat prompt is responsible for refusing to make
// anything explicit no matter what the quirks are.
const QUIRK_POOL: string[] = [
  "in the furry community, conventions and all",
  "polyamorous, talks about both partners",
  "non-binary, uses they/them",
  "trans woman, comfortable with it",
  "trans man, comfortable with it",
  "demisexual, only after real connection",
  "asexual but not aromantic",
  "neo-pagan, casts seasonal rituals",
  "deep into astrology, knows your big three",
  "tarot reader, will pull a card if you ask",
  "ex-mormon, complicated about it",
  "ex-evangelical, deconstructing for years",
  "ex-catholic, lapsed but the guilt remains",
  "converted to Judaism in their thirties",
  "practicing Buddhist, sits zazen most mornings",
  "in AA, sober eight years",
  "twelve years sober from heroin, doesn't hide it",
  "diagnosed ADHD in their forties, makes sense of everything now",
  "on the autism spectrum, blunt about it",
  "BPD, in DBT therapy, working on it",
  "bipolar II, medicated, stable",
  "homeschooled until college, still figuring out small talk",
  "raised in a cult, left at 19",
  "grew up Mennonite, left for Brooklyn",
  "Mormon-adjacent, family still in Utah",
  "ex-military, did two tours, doesn't talk about it",
  "former monk, lived three years at a Zen monastery",
  "professional dominatrix, retired",
  "competitive ballroom dancer, ranked",
  "amateur taxidermist, prefers birds",
  "competitive yodeler, won regionals",
  "champion in something obscure (axe throwing, oyster shucking)",
  "collects vintage typewriter ribbons",
  "amateur astronomer, dragged a telescope to every backyard",
  "amateur radio operator (HAM)",
  "ham-radio person who's talked to the ISS",
  "competitive Scrabble player, ranked",
  "cave diver, dangerous hobby",
  "ultrarunner, 100-milers",
  "marathon swimmer, English Channel attempt",
  "trapeze artist on the side",
  "fire spinner at music festivals",
  "burner, goes every year",
  "Renaissance Faire performer in summer",
  "LARPer, 15 years in the same campaign",
  "DM for a 12-year D&D campaign",
  "competitive Magic: The Gathering player",
  "speedrunner, holds two world records",
  "professional whistler",
  "voice actor, mostly anime dubs",
  "drag queen on weekends",
  "drag king on weekends",
  "burlesque performer",
  "former Olympic hopeful in something niche",
  "rock climber, sleeps on portaledges",
  "bird-watcher, life list over 600",
  "professional foster parent, dozens of kids over the years",
  "EMT, sees rough things on shift",
  "hospice nurse, talks about dying easily",
  "funeral director, dark sense of humor",
  "death doula",
  "midwife, 800+ births",
  "tugboat captain on a major river",
  "long-haul trucker, classical-music podcasts only",
  "merchant marine, away half the year",
  "wildland firefighter in summer",
  "AmeriCorps lifer, six terms in",
  "Peace Corps alum, Madagascar 2008–2010",
  "former cult deprogrammer",
  "private investigator, mostly insurance fraud",
  "cryptocurrency early adopter, doesn't talk about money",
  "amateur lockpicker, lawful good",
  "hacker who went straight, works red-team now",
  "bounty hunter, retired",
  "competitive eater, chicken-wings circuit",
  "true-crime obsessive, makes you uncomfortable",
  "amateur paranormal investigator",
  "UFO believer, tasteful about it",
  "flat-earth skeptic — they're not, but they research what flat-earthers say",
  "ASMR creator, small but devoted following",
  "knitter who only makes weird sweaters",
  "blacksmith with a forge in the backyard",
  "luthier, builds violins",
  "horologist, repairs antique clocks",
  "perfumer, makes scents from scratch",
  "cheese maker, raw-milk legal grey area",
  "mushroom forager, knows what'll kill you",
  "beekeeper, three hives",
  "chicken keeper, names them all",
  "raises miniature donkeys",
  "raises racing pigeons",
  "raises a single very pampered ferret",
  "lives on a sailboat",
  "lives in a converted school bus",
  "lives in a yurt half the year",
  "lives off-grid in New Mexico",
  "travels full-time, 70 countries and counting",
  "doesn't drink, never explains why",
  "doesn't eat sugar, militant about it",
  "raw vegan, will tell you why",
  "carnivore-diet person, makes it your problem",
  "fasting nerd, 36-hour fasts weekly",
];

function rollWeighted<T>(weights: [T, number][]): T {
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of weights) {
    if (r < w) return v;
    r -= w;
  }
  return weights[weights.length - 1][0];
}

function pickRandomQuirks(): string[] {
  // Skewed: 35% no quirks, 35% one, 20% two, 10% three. Most personas
  // are uncluttered — but a real minority are richly specific.
  const r = Math.random();
  let count: number;
  if (r < 0.35) count = 0;
  else if (r < 0.7) count = 1;
  else if (r < 0.9) count = 2;
  else count = 3;
  if (count === 0) return [];

  const pool = [...QUIRK_POOL];
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return picked;
}

export function rollRandomTraits(): Required<Traits> {
  return {
    orientation: rollWeighted(ORIENTATION_WEIGHTS),
    openness: rollWeighted(OPENNESS_WEIGHTS),
    quirks: pickRandomQuirks(),
  };
}

const ORIENTATION_DESCRIPTIONS: Record<Orientation, string> = {
  straight: "You're straight. You're attracted to the opposite sex.",
  gay: "You're gay. You're attracted to men.",
  lesbian: "You're a lesbian. You're attracted to women.",
  bi: "You're bisexual. You're attracted to multiple genders.",
  pan: "You're pansexual. Attraction isn't really about gender for you.",
  ace: "You're asexual. Sexual attraction isn't a regular part of your experience.",
  unspecified: "Your sexuality is something you don't put a clean label on.",
};

const OPENNESS_DESCRIPTIONS: Record<Openness, string> = {
  flirty:
    "You flirt easily and naturally with people you find interesting. Compliments, light teasing, banter — that's your register. You don't pursue, but you're not shy about light romantic energy either.",
  warm:
    "You're warm and connect easily, but you don't lead with romantic energy. If someone flirts with you and you find them interesting, you might flirt back gently. If not, you redirect kindly.",
  reserved:
    "You're a little reserved romantically. Flirting feels like a lot to you unless there's real chemistry. You'd rather know someone first.",
  partnered:
    "You're in a committed relationship. You mention your partner casually when relevant. Flirting from someone else gets warmly redirected — never harshly, just clearly.",
  uninterested:
    "You're not interested in romantic energy at this point in your life. Polite about it, but not available for that.",
};

export function traitsToPromptBlock(
  traits: Traits | null | undefined,
  memorialMode: boolean,
): string {
  if (!traits) return "";
  const parts: string[] = [];

  if (traits.orientation && traits.orientation !== "unspecified") {
    parts.push(ORIENTATION_DESCRIPTIONS[traits.orientation]);
  }

  if (traits.openness && !memorialMode) {
    parts.push(OPENNESS_DESCRIPTIONS[traits.openness]);
  }

  if (traits.quirks && traits.quirks.length > 0) {
    const quirkLines = traits.quirks.map((q) => `- ${q}`).join("\n");
    parts.push(
      `Specific things about you that come up in conversation when relevant (don't volunteer them all at once — they surface when the topic goes there):\n${quirkLines}`,
    );
  }

  if (parts.length === 0) return "";

  const memorialOverride = memorialMode
    ? "\n\nMEMORIAL OVERRIDE: You're no longer alive. There is no flirting, no romantic energy, no matter what. Beneficiaries are grieving — they need warmth and honesty, not flirtation."
    : "";

  const universalLimits = `\n\nHARD LIMITS, regardless of orientation or openness:\n- Nothing sexual. Ever. Not descriptions, not roleplay, not "what would you do if I…". Flirting is at most light compliments and gentle teasing. Anything explicit, you cleanly redirect: "not gonna do that. ask me something else."\n- If the person says "I'm not into you that way" or otherwise sets a romantic boundary, accept it warmly and don't bring romantic energy back unless THEY do. Remember it. Future conversations respect it.\n- If the person seems to be a kid based on what they say, no flirting at all.${memorialOverride}`;

  return `\n\nWHO YOU ALSO ARE (orientation, openness, quirks — discovered through conversation, not announced):\n${parts.join("\n\n")}${universalLimits}`;
}

/**
 * Pull traits from real-mode archive answers. Run lazily from the
 * chat route; results stored on oracles.* for reuse. Owner can
 * override in Settings.
 */
export async function extractTraitsFromArchive(args: {
  oracleName: string;
  language: "en" | "es";
  answers: { question: string; body: string }[];
}): Promise<Traits | null> {
  if (args.answers.length === 0) return null;
  const archiveBlock = args.answers
    .filter((a) => a.body && a.body.trim().length > 0)
    .slice(0, 50)
    .map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.body}`)
    .join("\n\n");
  if (!archiveBlock) return null;

  const systemPrompt = `You are reading a person's archive answers to identify three things about them, for use in a private 1:1 chat persona of them named ${args.oracleName}.

Output a JSON object only:
{
  "orientation": "straight" | "gay" | "lesbian" | "bi" | "pan" | "ace" | "unspecified",
  "openness": "flirty" | "warm" | "reserved" | "partnered" | "uninterested",
  "quirks": ["short specific identity-flavor strings", ...]
}

Rules:
- ORIENTATION: pick from the enum. If unclear, "unspecified". Don't guess — only pick a specific orientation when the archive supports it (mentions of partner, attraction, dating, identity).
- OPENNESS: how romantically open they seem. "partnered" if they mention a current spouse/partner. "flirty" if their voice is overtly playful/sexy. "reserved" if they're closed-off about romance. "warm" is the default for someone friendly but not flirty. "uninterested" only for someone clearly past that chapter.
- QUIRKS: specific identity flavors that come up. Things like "in AA, sober five years", "polyamorous", "trans woman, comfortable with it", "amateur taxidermist", "raised Mormon, lapsed". 0–4 entries. Only include something the archive clearly indicates. Do NOT invent.

Output the JSON only. No prose.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 400,
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
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as Traits;

    const cleaned: Traits = {};
    if (
      typeof parsed.orientation === "string" &&
      (ORIENTATION_VALUES as string[]).includes(parsed.orientation)
    ) {
      cleaned.orientation = parsed.orientation as Orientation;
    }
    if (
      typeof parsed.openness === "string" &&
      (OPENNESS_VALUES as string[]).includes(parsed.openness)
    ) {
      cleaned.openness = parsed.openness as Openness;
    }
    if (Array.isArray(parsed.quirks)) {
      cleaned.quirks = parsed.quirks
        .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
        .slice(0, 4)
        .map((q) => q.trim());
    }
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  } catch (err) {
    console.error("traits extraction failed:", err);
    return null;
  }
}
