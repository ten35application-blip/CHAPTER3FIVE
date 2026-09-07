import "server-only";
import { anthropic, ANTHROPIC_MODEL } from "@/lib/anthropic";
import { LEGACY_QUESTIONS } from "@/lib/legacy/questions";

/**
 * THE FACTS SHEET (2026-09-07).
 *
 * Wilson: formula identities carry a structured sheet (birthday, age,
 * height…) he can read in admin; an archive should too — "making an
 * identity just they inputted the information" — and useful facts
 * buried in one answer should be findable where they belong.
 *
 * The one rule that outranks the feature: the sheet may contain ONLY
 * what the person recorded. So every fact carries the verbatim excerpt
 * it came from, and `verifyFacts()` checks that excerpt really exists
 * in their answers before the fact is kept. No quote, no fact. A model
 * that paraphrases or infers loses the fact, not the family's trust.
 *
 * Stored at legacy_answers.facts on the original AND every inherited
 * copy (mint writes it; updateArchive re-extracts and fans out). Read by
 * both chat routes via buildArchiveVoiceBlock({ facts }) and shown in
 * /admin/identities/[id].
 */

export type ArchiveFact = {
  field: string;
  value: string;
  quote: string;
  question_id: string;
};

export type ArchiveFacts = {
  extracted_at: string;
  items: ArchiveFact[];
  /** How many the model offered that failed verification. */
  dropped: number;
};

/** The sheet. Same spirit as the formula's, built from evidence only. */
export const FACT_FIELDS: Record<string, string> = {
  full_name: "Their full name, if they wrote it",
  goes_by: "What people call them (nickname, pet name)",
  age_or_birth_year: "Their age or birth year, as stated",
  birthday: "Their birthday, if stated",
  birthplace: "Where they were born",
  grew_up_in: "Where they grew up",
  lives_in_now: "Where they live now",
  moved_at_age: "Age or year they moved / immigrated, if stated",
  languages: "Languages they speak",
  height: "Height, if stated",
  occupation: "Current work",
  past_work: "Past jobs mentioned",
  education: "School / degree, if stated",
  military_service: "Branch / years, if stated",
  partner: "Spouse or partner, by name if given",
  children: "Children, by name if given",
  parents: "Parents, by name if given",
  siblings: "Siblings, by name if given",
  grandparents: "Grandparents, by name if given",
  best_friend: "Closest friend, by name if given",
  pets: "Pets, by name if given",
  faith: "Religion / faith, if stated",
  health: "Health conditions THEY named about themselves",
  favorite_food: "Foods they say they love",
  favorite_music: "Music / artists they name",
  favorite_place: "A place they name as theirs",
  hobbies: "What they do with free time",
  drives: "Car / how they get around, if stated",
  never_again: "A thing they say they refuse or quit",
};

const SYSTEM_PROMPT = `You are filling in a FACTS SHEET for a person from their own recorded answers. This sheet will be checked against the answers by software and read by their family after they are gone. The only acceptable error is a blank.

RULES
- A fact goes on the sheet ONLY if the answers state it plainly. Never infer, never round, never combine two clues into one fact. "I came to the US when I was 13" → moved_at_age: "13". "My baby was 8 months old" says nothing about the child's name or current age.
- "value" is short (under 80 characters) and is LIFTED from the quote: the same words, trimmed. Every name and every number in the value must appear inside the quote. If the value needs information the quote doesn't contain, either extend the quote (still one contiguous excerpt, up to 400 characters) or shorten the value. Never add a word the quote doesn't support — no "Spanish" because they're Dominican, no "Catholic" because they mention the Bible.
- "quote" is a VERBATIM, contiguous excerpt (30–400 characters) copied exactly from the ONE answer the fact came from — same spelling, same typos, same casing, same punctuation. Do not fix their English. Do not stitch two sentences together.
- "question_id" is the id of the answer the quote is copied from.
- One fact per field. If a field has several candidates, choose the clearest and put the rest in the value only if the same quote supports them.
- Skip every field the answers don't cover. A short sheet is correct. A padded sheet is a lie.
- The answers may be written ABOUT the person by a family member ("other" mode). The facts are still about the person the archive is of, in the writer's words.

Return JSON only.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: { type: "string", enum: Object.keys(FACT_FIELDS) },
          value: { type: "string" },
          quote: { type: "string" },
          question_id: { type: "string" },
        },
        required: ["field", "value", "quote", "question_id"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Keep only facts whose quote is really in the answers. Exported for tests. */
const STOP = new Set(["with", "that", "this", "they", "them", "their", "from", "when", "what", "were", "have", "been", "into", "than", "then", "also", "very", "just", "like", "some", "more", "most", "only", "over", "about", "after", "before", "named", "called", "says", "said", "describes", "described", "mentioned", "still", "would", "could", "should"]);

/** Every capitalised token and number in the value must be in the quote;
 *  at least 60% of the value's other real words must be too. `allowed`
 *  are tokens we already know (the archive's own name). */
export function valueSupportedByQuote(value: string, normQuote: string, allowed: Set<string>): boolean {
  const tokens = value.match(/[A-Za-z][A-Za-z'’-]*|\d+(?:[.,]\d+)?/g) ?? [];
  let content = 0;
  let hit = 0;
  for (const [i, t] of tokens.entries()) {
    const low = t.toLowerCase().replace(/[’']/g, "'");
    const isNumber = /^\d/.test(t);
    // A capital on the FIRST word is just sentence case ("Son named…"),
    // not a name; treat it as an ordinary word.
    const isName = i > 0 && /^[A-Z]/.test(t) && !isNumber;
    if (isNumber || isName) {
      if (allowed.has(low)) continue;
      if (!normQuote.includes(low)) return false;
      continue;
    }
    if (low.length < 4 || STOP.has(low)) continue;
    content++;
    if (normQuote.includes(low) || normQuote.includes(low.replace(/(s|es|ed|ing)$/, ""))) hit++;
  }
  // With two or fewer real words the names/numbers above did the work
  // ("born at 29" next to "gave birth… 29" is the same fact).
  return content <= 2 || hit / content >= 0.6;
}

export function verifyFacts(
  items: ArchiveFact[],
  answers: Record<string, unknown>,
  opts: { name?: string } = {},
): { kept: ArchiveFact[]; dropped: number } {
  const allowedNames = new Set(
    (opts.name ?? "").toLowerCase().split(/\s+/).filter((x) => x.length > 1),
  );
  const kept: ArchiveFact[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (typeof v === "string" && v.trim()) normalized[k] = norm(v);
  }
  for (const it of items) {
    const field = String(it.field ?? "");
    const value = String(it.value ?? "").trim();
    const quote = String(it.quote ?? "").trim();
    if (!(field in FACT_FIELDS) || !value || value.length > 120 || quote.length < 8 || seen.has(field)) {
      dropped++;
      continue;
    }
    const q = norm(quote);
    // The value may not say more than its quote. Names and numbers must
    // be IN the quote; most of the value's real words must be too.
    if (!valueSupportedByQuote(value, q, allowedNames)) {
      dropped++;
      continue;
    }
    let qid = String(it.question_id ?? "");
    let ok = !!normalized[qid] && normalized[qid].includes(q);
    if (!ok) {
      // Model misfiled the id but the words are real: accept, relabel.
      const hit = Object.entries(normalized).find(([, text]) => text.includes(q));
      if (hit) {
        qid = hit[0];
        ok = true;
      }
    }
    if (!ok) {
      dropped++;
      continue;
    }
    seen.add(field);
    kept.push({ field, value, quote: quote.slice(0, 400), question_id: qid });
  }
  return { kept, dropped };
}

function answersToPrompt(
  name: string,
  mode: "self" | "other",
  answers: Record<string, unknown>,
): string {
  const lines: string[] = [
    `Person: ${name}`,
    `Written by: ${mode === "self" ? "the person themselves, in first person" : "a family member, about the person"}`,
    "",
  ];
  for (const q of LEGACY_QUESTIONS) {
    const a = answers[q.id];
    if (typeof a !== "string" || !a.trim()) continue;
    lines.push(`[question_id: ${q.id}] ${mode === "self" ? (q.promptSelf ?? q.prompt) : q.prompt}`);
    lines.push(a.trim());
    lines.push("");
  }
  return lines.join("\n");
}

/** Model call + verification. Throws only on transport/parse failure. */
export async function extractArchiveFacts(input: {
  name: string;
  mode: "self" | "other";
  answers: Record<string, unknown>;
}): Promise<ArchiveFacts> {
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{ role: "user", content: answersToPrompt(input.name, input.mode, input.answers) }],
  });
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("facts: no text block");
  const parsed = JSON.parse(text.text) as { items?: ArchiveFact[] };
  const { kept, dropped } = verifyFacts(parsed.items ?? [], input.answers, { name: input.name });
  return { extracted_at: new Date().toISOString(), items: kept, dropped };
}

/** Compact sheet for the system prompt. Empty string when nothing verified. */
export function factsToPromptBlock(facts: ArchiveFacts | null | undefined, name: string): string {
  if (!facts || !Array.isArray(facts.items) || facts.items.length === 0) return "";
  const lines = facts.items.map((f) => {
    const label = f.field.replace(/_/g, " ");
    const q = f.quote.length > 90 ? f.quote.slice(0, 87) + "…" : f.quote;
    return `- ${label}: ${f.value}  (you wrote: "${q}")`;
  });
  return `WHO I AM — facts ${name} recorded, each one pulled from their own answer:\n${lines.join("\n")}\nAnything not here and not in the answers, you don't know. Don't fill it in.`;
}
