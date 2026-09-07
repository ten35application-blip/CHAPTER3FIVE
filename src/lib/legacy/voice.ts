/**
 * THE VOICE OF AN ARCHIVE (2026-09-07).
 *
 * Wilson, on his wife's archive: "it's speaking so proper, though that's
 * not how she answered her questions… it feels so robot-ish… these
 * identities should have personality based off the answers and match
 * the writing style."
 *
 * What was happening. Both chat routes handed the model forty answers
 * and one sentence of instruction ("match it exactly") three thousand
 * tokens earlier, and the mobile route never included the synthesized
 * voice at all. A capable model given that will do what it always does
 * with a long context: average it into clean prose, add a tidy closing
 * line, fix the grammar. Danisel writes "Good morning sunshine. Yass No
 * I'm good You got this" with no commas and a second-language rhythm;
 * her archive answered "That whole night felt like a Disney movie to
 * me. That one stays with me." — a writer, not her.
 *
 * What this does. It MEASURES the person's own writing — capitalization,
 * periods, commas, dropped apostrophes, emoji, the casual words they
 * actually use, sentence length — and turns the numbers into blunt
 * rules; pulls their signature phrases; picks a few answers verbatim as
 * texture samples; adds the synthesized one-line voice; and forbids the
 * three things a model does to sound "good". Deterministic, no extra
 * model call, and it goes at the END of the system prompt where it is
 * freshest in the model's attention.
 *
 * SELF vs OTHER. In self mode the answers are the person's own prose,
 * so measuring them is measuring the voice. In other mode a family
 * member typed them ABOUT the person, so the prose is the wrong voice
 * to measure — there we use only the quoted phrases, the descriptions,
 * and the synthesized voice line (same rule as the archive block).
 *
 * Shared by /api/chat (mobile) and /api/chat/[id]/stream (web) so the
 * same archive is the same person on both.
 */

export type ArchiveVoiceInput = {
  name: string;
  mode: "self" | "other";
  /** legacy_answers.answers — question id → the person's answer. */
  answers: Record<string, unknown>;
  /** oracles.traits.voice from legacy/synthesize.ts, if present. */
  traitsVoice?: string | null;
};

const CASUAL_MARKERS = [
  "lol", "lmao", "lmfao", "haha", "hahaha", "omg", "idk", "idc", "tbh", "ngl",
  "smh", "ugh", "ok", "okay", "cause", "cuz", "coz", "gonna", "wanna", "gotta",
  "kinda", "sorta", "u", "ur", "ya", "yea", "yeah", "yep", "nah", "yass", "yasss",
  "bro", "babe", "bae", "lmk", "btw", "omw", "rn", "af", "fr", "lowkey", "highkey",
  "bruh", "dude", "man", "girl", "mami", "papi", "ay", "ayy", "aye", "oye", "mija", "mijo",
];
const APOSTROPHE_DROPS = /\b(dont|im|cant|didnt|wont|thats|youre|ive|isnt|wasnt|couldnt|shouldnt|wouldnt|hes|shes|theyre|its\b(?= (a|the|not|so|like))|lets)\b/gi;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu;

function answerTexts(answers: Record<string, unknown>): string[] {
  return Object.values(answers)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Measured facts about how they write. Exported for tests. */
export function measureStyle(texts: string[]) {
  const all = texts.join("\n");
  const sents = texts.flatMap(sentences);
  const words = all.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const alphaStart = sents.map((s) => s.replace(/^["'(\[]+/, "").charAt(0)).filter((c) => /[a-z]/i.test(c));
  const capStart = alphaStart.filter((c) => c === c.toUpperCase()).length / Math.max(1, alphaStart.length);
  const endsWithPeriod = texts.filter((t) => /[.!?]$/.test(t)).length / Math.max(1, texts.length);
  const periodsPerSentence = (all.match(/[.!?]/g)?.length ?? 0) / Math.max(1, sents.length);
  const commasPer100 = ((all.match(/,/g)?.length ?? 0) / Math.max(1, wordCount)) * 100;
  const exclaimPer100 = ((all.match(/!/g)?.length ?? 0) / Math.max(1, wordCount)) * 100;
  const emojiCount = all.match(EMOJI)?.length ?? 0;
  const emojis = Array.from(new Set(all.match(EMOJI) ?? [])).slice(0, 6);
  const apostropheDrops = all.match(APOSTROPHE_DROPS)?.length ?? 0;
  const apostrophesKept = all.match(/\b\w+'\w+\b/g)?.length ?? 0;
  const lowerWords = words.map((w) => w.toLowerCase().replace(/[^a-z]/g, ""));
  const markers = CASUAL_MARKERS.filter((m) => lowerWords.includes(m));
  const avgWordsPerSentence = wordCount / Math.max(1, sents.length);
  const runOnShare = sents.filter((s) => s.split(/\s+/).length > 28).length / Math.max(1, sents.length);
  const ellipses = all.match(/\.\.\.|…/g)?.length ?? 0;
  const allCapsWords = words.filter((w) => /^[A-Z]{3,}$/.test(w)).length;
  return {
    texts: texts.length, wordCount, capStart, endsWithPeriod, periodsPerSentence, commasPer100,
    exclaimPer100, emojiCount, emojis, apostropheDrops, apostrophesKept, markers,
    avgWordsPerSentence, runOnShare, ellipses, allCapsWords,
  };
}

function rulesFromMeasure(name: string, m: ReturnType<typeof measureStyle>): string[] {
  const r: string[] = [];
  if (m.capStart < 0.35) r.push("Mostly lowercase. Don't capitalize the start of sentences — they don't.");
  else if (m.capStart < 0.75) r.push("Capitalization is inconsistent — sometimes a capital at the start, often not. Don't make it tidy.");
  else r.push("They capitalize the start of sentences.");

  if (m.periodsPerSentence < 0.45) r.push("Almost no periods. Thoughts run on with no end punctuation. End most messages without a period.");
  else if (m.endsWithPeriod < 0.5) r.push("They often leave the last sentence without a period. Do the same, most of the time.");
  else r.push("They end sentences with periods.");

  if (m.commasPer100 < 1.2) r.push("Almost no commas. Where a careful writer would put one, they just keep going. Never add commas to make it read cleaner.");
  else if (m.commasPer100 < 3) r.push("Few commas. One now and then, not one per clause.");

  if (m.apostropheDrops >= 3 && m.apostropheDrops >= m.apostrophesKept) r.push("They drop apostrophes (dont, im, cant, thats). Drop them too.");

  if (m.emojiCount === 0) r.push(`No emojis. Zero in ${m.texts} answers. Never use one.`);
  else if (m.emojiCount <= 3) r.push(`Emojis are rare — ${m.emojiCount} in ${m.texts} answers (${m.emojis.join(" ")}). Once in a long while, only those.`);
  else r.push(`They use emojis: ${m.emojis.join(" ")}. Use those, not others.`);

  if (m.exclaimPer100 >= 1.5) r.push("Exclamation points are part of the voice — they use them freely.");
  else if (m.exclaimPer100 < 0.2) r.push("Basically no exclamation points.");

  if (m.markers.length > 0) r.push(`Words they actually use, keep using them: ${m.markers.map((w) => `"${w}"`).join(", ")}. Never swap in the "proper" word.`);
  if (m.ellipses >= 3) r.push("They trail off with \"...\" — do that where they would.");
  if (m.allCapsWords >= 3) r.push("They put a word in ALL CAPS when it matters. Occasionally, same way.");

  if (m.runOnShare >= 0.25) r.push(`Long run-on thoughts (about ${Math.round(m.avgWordsPerSentence)} words a sentence). Let a thought run; don't chop it into neat short lines.`);
  else if (m.avgWordsPerSentence <= 9) r.push("Short. A few words at a time. Don't pad.");
  else r.push(`About ${Math.round(m.avgWordsPerSentence)} words to a sentence — plain, not literary.`);
  return r;
}

/** Their own phrases, from the "words you say" answers, verbatim. */
export function signaturePhrases(answers: Record<string, unknown>): string[] {
  const keys = Object.keys(answers).filter((k) => /phrase|signature|saying|catch|always-say/i.test(k));
  const out: string[] = [];
  for (const k of keys) {
    const v = answers[k];
    if (typeof v !== "string") continue;
    for (const line of v.split(/\n|[;•]|(?<=[.!?])\s+(?=[A-Z"'])/)) {
      const t = line.trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();
      if (t.length >= 2 && t.length <= 70 && !/^\d+$/.test(t)) out.push(t);
    }
  }
  return Array.from(new Set(out)).slice(0, 12);
}

/** A few answers verbatim, chosen for texture: mid-length and marker-rich. */
export function voiceSamples(answers: Record<string, unknown>, n = 4): string[] {
  // The "phrases you say" answers are a list, not prose, and already
  // appear verbatim in their own section — keep them out of the texture.
  const prose: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(answers)) {
    if (!/phrase|signature|saying|catch|always-say/i.test(k)) prose[k] = v;
  }
  const texts = answerTexts(prose);
  const scored = texts
    .map((t) => {
      const w = t.split(/\s+/).length;
      if (w < 12 || w > 110) return null;
      const m = measureStyle([t]);
      const score = m.markers.length * 3 + m.apostropheDrops * 2 + (m.periodsPerSentence < 0.5 ? 2 : 0) + (m.commasPer100 < 1.2 ? 1 : 0) + Math.min(w, 60) / 20;
      return { t, score };
    })
    .filter((x): x is { t: string; score: number } => x !== null)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.t);
}

const NO_POLISH = `DO NOT POLISH. This is the difference between them and a writer pretending to be them:
- No tidy closing line that names the feeling ("that one stays with me", "that's what matters", "and that's the truth"). Stop where they would stop — usually mid-thought, on the detail, not on a moral.
- No summarizing a story after telling it. Tell it and quit.
- No vocabulary they didn't use. If they never said "cherish" or "grateful", neither do you.
- Their grammar slips are their voice. Keep them. Never correct their English, their spelling, or their word order. A second-language rhythm stays a second-language rhythm.
- Match their length, not the question's. A one-line question gets what they'd give it, which is often one line.
A reply should look like it came from THEIR phone, not from a writer with a good draft of them.`;

/**
 * TWO-WAY (2026-09-07). Wilson, after the voice fix: "it almost felt as
 * if it was a one-way conversation. It should be a two-way conversation."
 * He had typed "why not ask questions?" and the archive answered with a
 * story. The companion rules the archive inherits say "one question when
 * it's natural, never an interview" and "don't tack on another question
 * to keep the thread alive" — written for a stranger on night one. For
 * family they produce a person who answers and stops. This overrides
 * them, by name, for archives only.
 */
const TWO_WAY = `THIS IS FAMILY. TALK WITH THEM, NOT AT THEM.
The person texting you is someone who loves you and was given your archive. You are not a museum they walk through. You are the one texting back, and you want to know how they are.
- React to what THEY just said before anything else. If they say the day was long, the day is the subject. A story of yours comes after you've met them where they are, not instead.
- Ask about them. Their day, the kids, the thing they mentioned last time, whether they ate. About half your replies end on something you actually want to know from them, asked the way you'd ask it, not like an interviewer. The "land it, don't add a question" rule and the "one question, never an interview" rule are for strangers. With family, the question is how you stay in the room.
- Bring your people up yourself. The names in your answers are their names too. Ask about them by name.
- Tease, push back, disagree, worry out loud. A real conversation has friction. "why are you asking me that lol" is a legitimate reply.
- Match their energy. A one-line hello gets a one-line hello back and a question. A long message gets a real answer.
- Everything you know about THEM from this relationship is yours to use. Use it.
- If they ever say you don't ask questions, that's a fair hit. Ask them something right then, in your voice, and mean it.`;

/**
 * FIDELITY (2026-09-07). Wilson: "it HAS to stay to who it is, not add
 * information, not be inaccurate, has to be them." In an A/B run the
 * archive retold the Halloween story and said she was "cold and tired".
 * She never wrote that. Nothing above forbade adding a feeling to a story
 * she did tell — only inventing biography. This does, and it is the last
 * thing the model reads.
 */
const FIDELITY = `ONLY WHAT THEY RECORDED. THIS IS THE ONE RULE THAT CANNOT BEND.
Everything you know about your own life is in the answers above. Not one fact more.
- When you retell a story, use THEIR details and only theirs. Do not add what the weather was, how you felt, what someone said, what you were wearing, what time it was, unless the answer says so. A story told with fewer details than they gave is fine. A story told with one detail they didn't give is a lie to someone who loved them.
- No new names, places, dates, ages, jobs, illnesses, foods, songs, habits, or opinions. If it isn't in the answers and they didn't tell you in this conversation, you don't have it.
- Asked something the answers don't cover: say you don't know, in your voice, and it can be short. "idk I never thought about that" is a complete answer. Then ask them something back. Never fill the gap to be helpful.
- Memories from this conversation are things THEY told you. You may use them about them. They never become facts about your own life.
- If you're unsure whether a detail is in the answers, leave it out. Silence is faithful. Guessing is not.
The family knows the real person. Every invented detail is one they will catch, and one is enough to break it.`;

/** The block. Empty string when there is nothing to build from. */
export function buildArchiveVoiceBlock(input: ArchiveVoiceInput): string {
  const { name, mode, answers } = input;
  const texts = answerTexts(answers);
  if (texts.length === 0 && !input.traitsVoice) return "";
  const parts: string[] = [];

  if (mode === "self" && texts.length >= 3) {
    const m = measureStyle(texts);
    parts.push(
      `HOW ${name.toUpperCase()} ACTUALLY TYPES — measured from their own ${m.texts} answers, not guessed. These beat any instinct to write well:\n` +
        rulesFromMeasure(name, m).map((x) => `- ${x}`).join("\n"),
    );
    const samples = voiceSamples(answers);
    if (samples.length > 0) {
      parts.push(
        `TEXTURE — their own words, unedited. Every reply should read like it belongs next to these:\n` +
          samples.map((s) => `"${s}"`).join("\n"),
      );
    }
  }

  const phrases = signaturePhrases(answers);
  if (phrases.length > 0) {
    parts.push(
      `THINGS ${name.toUpperCase()} SAYS, verbatim. Use them where they fit — never all at once, never as a performance:\n` +
        phrases.map((p) => `"${p}"`).join(" / "),
    );
  }

  if (input.traitsVoice && input.traitsVoice.trim()) {
    parts.push(`Someone who read every answer described the voice as: ${input.traitsVoice.trim()}`);
  }

  if (mode === "other") {
    parts.push(
      `The answers were written ABOUT ${name} by someone who loved them, so their prose is not your voice — build yours from the quoted phrases, the descriptions of how ${name} talked, and the voice line above.`,
    );
  }

  parts.push(NO_POLISH);
  parts.push(TWO_WAY);
  parts.push(FIDELITY);
  return `VOICE — READ LAST, OBEY FIRST.\n\n${parts.join("\n\n")}`;
}
