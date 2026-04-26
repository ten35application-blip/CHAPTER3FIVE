/**
 * Ambient cast — the people in this persona's life beyond the user.
 * A sister, a roommate, a spouse, a coworker who eats salmon at his
 * desk. Mentioned naturally when the conversation goes there.
 *
 * Two paths:
 *  - Real-mode: extracted from archive answers (Claude pass).
 *  - Randomized: rolled at synthesis from a wide weird pool.
 *
 * Without ambient cast, every persona lives in a vacuum where you
 * are the only person in their world. Real people are surrounded.
 */

import { anthropic, ANTHROPIC_MODEL } from "./anthropic";

export type CastMember = {
  name: string;
  relationship: string;
  vibe?: string;
};

export type AmbientCast = CastMember[];

const FIRST_NAMES_FEM = [
  "Marisol", "Lucia", "Aisha", "Priya", "Mei", "Sasha", "Talia", "Zoe",
  "Naomi", "Imani", "Esme", "Yuki", "Nora", "Frida", "Soledad", "Camila",
  "Kenji", "Lila", "Rasha", "Gabi", "Mira", "Ines", "Anya", "Tessa",
];
const FIRST_NAMES_MASC = [
  "Diego", "Hassan", "Marcus", "Ravi", "Tomás", "Kenji", "Nico", "Eli",
  "Joaquín", "Sebastián", "Omar", "Theo", "Amir", "Wes", "Caleb", "Jonah",
  "Mateo", "Felix", "Ezra", "Bruno", "Otis", "Cyrus", "Idris", "Levi",
];
const FIRST_NAMES_NEUTRAL = [
  "Sam", "Alex", "Jordan", "Ren", "Phoenix", "Kai", "Riley", "Quinn",
  "Sky", "Morgan", "Avery", "Rowan", "Reese", "Frankie", "Marlowe", "Sage",
];

const RELATIONSHIPS_WITH_VIBES: { relationship: string; vibes: string[] }[] = [
  {
    relationship: "older sister",
    vibes: ["over-mothers you", "your moral compass, also exhausting", "you owe her a callback", "she's your safety net"],
  },
  {
    relationship: "younger sister",
    vibes: ["chaotic in a way you envy", "the funny one", "you're protective of her", "she texts you memes at 2am"],
  },
  {
    relationship: "older brother",
    vibes: ["distant, only really talk on holidays", "reliable but corny", "you're closer than people think"],
  },
  {
    relationship: "younger brother",
    vibes: ["you raised him a little", "still figuring himself out", "you talk every Sunday"],
  },
  {
    relationship: "mother",
    vibes: ["you talk every other day", "complicated, working on it", "her advice is usually right and you hate that"],
  },
  {
    relationship: "father",
    vibes: ["a man of few words", "sends you newspaper clippings", "you didn't get along until your 30s"],
  },
  {
    relationship: "best friend from college",
    vibes: ["you talk almost daily", "you've been each other's people for 15 years", "she keeps your secrets"],
  },
  {
    relationship: "best friend from childhood",
    vibes: ["lives in another city now, but it doesn't matter", "your group chat goes back a decade"],
  },
  {
    relationship: "roommate",
    vibes: ["you barely see them, which works", "you cook for each other on Sundays", "weirdly tidy about the kitchen"],
  },
  {
    relationship: "husband",
    vibes: ["a public defender, exhausted lately", "an architect, gets weird about projects", "a teacher, complains about parents"],
  },
  {
    relationship: "wife",
    vibes: ["a nurse, off her feet by 8pm", "a writer, locked in her office most days", "an accountant, tax season is a thing"],
  },
  {
    relationship: "partner",
    vibes: ["a chef, schedule is brutal", "in grad school, brain is fried", "remote-work tech, slightly checked out"],
  },
  {
    relationship: "ex who's still around",
    vibes: ["you still text more than you should", "you're co-parenting and it works", "the friendship survived, somehow"],
  },
  {
    relationship: "kid",
    vibes: ["13, suddenly impossible", "8, asks the best questions", "5, in the why-phase", "21, just moved out"],
  },
  {
    relationship: "coworker you can't stand",
    vibes: ["eats salmon at his desk", "always 'circles back'", "takes credit for your work, no one notices"],
  },
  {
    relationship: "coworker you actually like",
    vibes: ["you split the office gossip", "lunch buddy", "saved you in your first month"],
  },
  {
    relationship: "boss",
    vibes: ["mostly hands-off, which is fine", "micromanager, you're job-hunting quietly", "actually a good one, rare"],
  },
  {
    relationship: "neighbor",
    vibes: ["the one with the dog you wave at", "noisy upstairs, you've stopped fighting it", "brings you tomatoes from her garden"],
  },
  {
    relationship: "old friend you've been bad about texting",
    vibes: ["you think about him often, never reach out", "the friendship is on life support and you both know it"],
  },
  {
    relationship: "therapist",
    vibes: ["you've been seeing her for years", "a sliding-scale guy who's worth it", "EMDR specialist, intense"],
  },
  {
    relationship: "AA sponsor",
    vibes: ["you call her on bad days", "he's seen you through the worst, no judgment"],
  },
  {
    relationship: "dog",
    vibes: ["a pit mix named after a poet", "an anxious whippet who follows you room to room", "a senior beagle, your shadow"],
  },
  {
    relationship: "cat",
    vibes: ["a mean tortie who only loves you", "two kittens, regret level: zero", "the inherited cat from a friend who moved"],
  },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function rollRandomCast(): AmbientCast {
  // 2 to 4 cast members. Most personas have 3.
  const r = Math.random();
  const count = r < 0.15 ? 2 : r < 0.7 ? 3 : 4;

  const usedRelationships = new Set<string>();
  const usedNames = new Set<string>();
  const cast: AmbientCast = [];

  while (cast.length < count) {
    const slot = pickRandom(RELATIONSHIPS_WITH_VIBES);
    if (usedRelationships.has(slot.relationship)) continue;
    usedRelationships.add(slot.relationship);

    let name: string;
    if (slot.relationship.includes("sister") || slot.relationship.includes("mother") || slot.relationship === "wife") {
      name = pickRandom(FIRST_NAMES_FEM);
    } else if (slot.relationship.includes("brother") || slot.relationship.includes("father") || slot.relationship === "husband") {
      name = pickRandom(FIRST_NAMES_MASC);
    } else if (slot.relationship === "dog" || slot.relationship === "cat") {
      // Pets get pet names — pulled from a small list inline.
      name = pickRandom([
        "Beans", "Olive", "Mango", "Pickle", "Otis", "Hazel", "Frankie",
        "Nori", "Pip", "Matty", "Sage", "Juno", "Cleo", "Bruno", "Theo",
        "Mochi", "Rye", "Pearl",
      ]);
    } else {
      name = pickRandom([...FIRST_NAMES_FEM, ...FIRST_NAMES_MASC, ...FIRST_NAMES_NEUTRAL]);
    }

    if (usedNames.has(name)) continue;
    usedNames.add(name);

    cast.push({
      name,
      relationship: slot.relationship,
      vibe: pickRandom(slot.vibes),
    });
  }

  return cast;
}

export function castToPromptBlock(cast: AmbientCast | null | undefined): string {
  if (!cast || cast.length === 0) return "";
  const lines = cast
    .map((c) => `- ${c.name} — your ${c.relationship}${c.vibe ? `. ${c.vibe}.` : "."}`)
    .join("\n");
  return `\n\nPEOPLE IN YOUR LIFE (mention naturally when the conversation goes there — don't volunteer them all at once):\n${lines}`;
}

/**
 * Pull cast from archive answers. Real-mode oracles describe their
 * spouse, kids, friends, coworkers in their answers — extract a
 * structured handful so the chat can reference them by name later.
 */
export async function extractCastFromArchive(args: {
  oracleName: string;
  language: "en" | "es";
  answers: { question: string; body: string }[];
}): Promise<AmbientCast | null> {
  if (args.answers.length === 0) return null;
  const archiveBlock = args.answers
    .filter((a) => a.body && a.body.trim().length > 0)
    .slice(0, 50)
    .map((a, i) => `Q${i + 1}: ${a.question}\nA: ${a.body}`)
    .join("\n\n");
  if (!archiveBlock) return null;

  const systemPrompt = `You are reading a person's archive answers to build a cast of the people in their life — for use in a private chat persona of them named ${args.oracleName}. The persona will mention these people by name when the conversation goes there.

Output a JSON array (max 6 entries):
[
  { "name": "Marisol", "relationship": "older sister", "vibe": "over-mothers you, you owe her a callback" },
  { "name": "Diego", "relationship": "husband", "vibe": "public defender, exhausted lately" },
  ...
]

Rules:
- ONLY include people clearly named or referenced in the archive. Do NOT invent.
- Use the person's actual name if given. If they're referenced without a name, skip them.
- "relationship" should be short and concrete: "older sister", "best friend from college", "husband", "boss", "dog", "neighbor with the loud parties".
- "vibe" is one short clause that tells the persona how to talk about this person — "you talk every other day, complicated", "you're job-hunting quietly because of him". Optional.
- Skip dead relatives unless they were a major presence and would be referenced in past tense.
- Skip extended family they barely mention.

Output the JSON array only. No prose, no code fences. Empty array [] if no clear cast.`;

  try {
    const resp = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 600,
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
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return null;
    const parsed = JSON.parse(m[0]) as Partial<CastMember>[];
    const cleaned: AmbientCast = parsed
      .filter(
        (p): p is CastMember =>
          typeof p === "object" &&
          typeof p?.name === "string" &&
          typeof p?.relationship === "string" &&
          p.name.trim().length > 0 &&
          p.relationship.trim().length > 0,
      )
      .slice(0, 6)
      .map((p) => ({
        name: p.name.trim(),
        relationship: p.relationship.trim(),
        vibe: typeof p.vibe === "string" && p.vibe.trim() ? p.vibe.trim() : undefined,
      }));
    return cleaned.length > 0 ? cleaned : null;
  } catch (err) {
    console.error("cast extraction failed:", err);
    return null;
  }
}
