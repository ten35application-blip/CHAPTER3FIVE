import "server-only";

/**
 * The 40 legacy questions — 10 categories, 4 each. All open-ended.
 *
 * SERVER-ONLY (audit 2026-07-25): this module is server-only ON
 * PURPOSE. The flow is open to every tier since the July 2026
 * flat-fee rework, but the bank itself still only reaches the client
 * through the auth-gated server page's props — a client-component
 * import would ship every question in a public JS chunk that even
 * signed-out visitors could download.
 *
 * Wilson's bar: "we want to lock down the same exact identity of the
 * person so when they pass, the family still feels like they have them."
 * Not a persona. Not a profile. Them — their voice, their small rituals,
 * the way they'd defend a stranger, the letter they'd want opened years
 * later. Every answer is 2–5 sentences of prose (essays run longer); no
 * multiple choice, no sliders, no checklists. The synthesizer reads
 * these directly, and the more texture an answer carries, the more the
 * resulting identity feels like the person we're preserving.
 *
 * Tone target: a StoryCorps interview crossed with a love letter.
 * Warm, specific, human. Never clinical. Never a survey.
 *
 * Every question ships in TWO single-voice variants, chosen at render
 * time by the flow's mode toggle: `prompt`/`placeholder` speak in the
 * third person ("they") for a family answering about someone they love,
 * and `promptSelf`/`placeholderSelf` speak in the second person ("you")
 * for someone answering about themselves. Sibling phrasings of the same
 * question — both first-class, never a dual-framed compromise.
 *
 * The 10 categories are deliberately non-overlapping with the formula:
 * the formula already captures MBTI, love language, humor style, etc.
 * These questions capture the STORIES and SPECIFICS the formula can't
 * — actual events, actual people, actual sentences someone said.
 *
 * Question order = array order. All 4 questions per category are
 * grouped together, and the flow renders category chips straight off
 * the array traversal — keep it grouped.
 */

export type LegacyCategory =
  | "origin"
  | "voice"
  | "values"
  | "relationships"
  | "lived"
  | "wisdom"
  | "private_self"
  | "anchors"
  | "courage"
  | "essay";

export type LegacyQuestion = {
  id: string; // slug, e.g. "voice-signature-phrase"
  category: LegacyCategory;
  prompt: string; // "other" voice — third person, a family answering about someone they love
  promptSelf?: string; // "self" voice — second person, someone answering about themselves
  placeholder?: string; // optional guiding hint under the input ("other" voice)
  placeholderSelf?: string; // the same hint in the "self" voice
  estimateMinutes?: number; // rough time-to-answer hint
};

/** Display labels for the category chip above each question. */
export const LEGACY_CATEGORY_LABELS: Record<LegacyCategory, string> = {
  origin: "Where I come from",
  voice: "How I speak",
  values: "What I believe",
  relationships: "Who I love",
  lived: "What I've lived through",
  wisdom: "What I've learned",
  private_self: "Who I am alone",
  anchors: "What I carry",
  courage: "What I stand for at cost",
  essay: "The big ones",
};

export const LEGACY_QUESTIONS: LegacyQuestion[] = [
  // ── Origin — where I come from ──────────────────────────────────────────
  {
    id: "origin-childhood-home",
    category: "origin",
    prompt:
      "Take us inside the place where they grew up — the house, the apartment, the room they shared. Who was in it, what did it sound like at dinnertime, and where did they go when they needed to disappear?",
    promptSelf:
      "Take us inside the place where you grew up — the house, the apartment, the room you shared. Who was in it, what did it sound like at dinnertime, and where did you go when you needed to disappear?",
    placeholder:
      "The kitchen table, the crowded bed, the yard, the noise or the silence. Small details carry the most — a wallpaper, a radio, a door that stuck.",
    placeholderSelf:
      "The kitchen table, the crowded bed, the yard, the noise or the silence. Small details carry the most — a wallpaper, a radio, a door that stuck.",
    estimateMinutes: 4,
  },
  {
    id: "origin-who-raised-them",
    category: "origin",
    prompt:
      "Who actually raised them? Not just the names on paper — the person whose voice still comes out of their mouth. What did that person teach them without ever saying it out loud?",
    promptSelf:
      "Who actually raised you? Not just the names on paper — the person whose voice still comes out of your mouth. What did that person teach you without ever saying it out loud?",
    placeholder:
      "A mother, a grandfather, an aunt, an older sibling, a neighbor who fed them after school. The lesson that arrived by watching, not by lecture.",
    placeholderSelf:
      "A mother, a grandfather, an aunt, an older sibling, a neighbor who fed you after school. The lesson that arrived by watching, not by lecture.",
    estimateMinutes: 4,
  },
  {
    id: "origin-family-pattern",
    category: "origin",
    prompt:
      "Every family hands down a pattern — a way of working, worrying, celebrating, keeping secrets, showing up. What pattern were they born into, and which part of it did they keep or fight to break?",
    promptSelf:
      "Every family hands down a pattern — a way of working, worrying, celebrating, keeping secrets, showing up. What pattern were you born into, and which part of it did you keep or fight to break?",
    placeholder:
      "\"In our family, you never talked about money.\" \"Everyone worked with their hands.\" \"Nobody left.\" Name the pattern, then what they did with it.",
    placeholderSelf:
      "\"In our family, you never talked about money.\" \"Everyone worked with their hands.\" \"Nobody left.\" Name the pattern, then what you did with it.",
    estimateMinutes: 4,
  },
  {
    id: "origin-first-responsibility",
    category: "origin",
    prompt:
      "What was the first real responsibility they carried — the first time something or someone truly depended on them? How old were they, and what did it make of them?",
    promptSelf:
      "What was the first real responsibility you carried — the first time something or someone truly depended on you? How old were you, and what did it make of you?",
    placeholder:
      "Watching a younger sibling, translating for their parents, cooking at nine, a paper route, the animals, the family store before school.",
    placeholderSelf:
      "Watching a younger sibling, translating for your parents, cooking at nine, a paper route, the animals, the family store before school.",
    estimateMinutes: 3,
  },

  // ── Voice — how I speak ─────────────────────────────────────────────────
  {
    id: "voice-signature-phrase",
    category: "voice",
    prompt:
      "What phrase or word did they wear out — the one that would tell you exactly who was talking before you even turned around? Write it the way they say it.",
    promptSelf:
      "What phrase or word have you worn out — the one that tells everyone exactly who's talking before they even turn around? Write it the way you say it.",
    placeholder:
      "The catchphrase, the tic, the way they always end a sentence or answer the phone. Spelling doesn't matter — the sound does.",
    placeholderSelf:
      "The catchphrase, the tic, the way you always end a sentence or answer the phone. Spelling doesn't matter — the sound does.",
    estimateMinutes: 2,
  },
  {
    id: "voice-how-they-make-you-laugh",
    category: "voice",
    prompt:
      "How do they make people laugh? An impression, a face, a dry line delivered deadpan, teasing that means love? Show the specifics — the bit everyone's heard a hundred times and still laughs at.",
    promptSelf:
      "How do you make people laugh? An impression, a face, a dry line delivered deadpan, teasing that means love? Show the specifics — the bit everyone's heard a hundred times and still laughs at.",
    placeholder:
      "Show it, don't just name it. Write the joke, the routine, the face, the timing — the thing only they can pull off.",
    placeholderSelf:
      "Show it, don't just name it. Write the joke, the routine, the face, the timing — the thing only you can pull off.",
    estimateMinutes: 3,
  },
  {
    id: "voice-storytelling-shape",
    category: "voice",
    prompt:
      "When they're really telling a story, what's the shape of it? Slow build with every detail intact, straight to the punchline, sidetracked by three other stories on the way?",
    promptSelf:
      "When you're really telling a story, what's the shape of it? Slow build with every detail intact, straight to the punchline, sidetracked by three other stories on the way?",
    placeholder:
      "Give the rhythm — do they set the scene forever, act out all the parts, lose the thread on purpose, land it clean and walk away?",
    placeholderSelf:
      "Give the rhythm — do you set the scene forever, act out all the parts, lose the thread on purpose, land it clean and walk away?",
    estimateMinutes: 3,
  },
  {
    id: "voice-what-they-never-say",
    category: "voice",
    prompt:
      "What do they never say? The words that aren't in them, the subjects they steer around, the feelings they'll show a hundred ways but won't put in a sentence. What do they do instead of saying it?",
    promptSelf:
      "What do you never say? The words that aren't in you, the subjects you steer around, the feelings you'll show a hundred ways but won't put in a sentence. What do you do instead of saying it?",
    placeholder:
      "Maybe they never say \"I'm proud of you\" but drive four hours to be in the third row. Never complain. Never say goodbye on the phone — just hang up.",
    placeholderSelf:
      "Maybe you never say \"I'm proud of you\" but drive four hours to be in the third row. Never complain. Never say goodbye on the phone — just hang up.",
    estimateMinutes: 4,
  },

  // ── Added 2026-08-04 after the formula audit ────────────────────────────
  // Five absences a child would notice in the first ten minutes. The bank
  // was collecting a well-told biography; these collect the interaction
  // surface — the things that make a person recognizable in a TEXT THREAD,
  // which is the only place this archive will ever be met.
  //
  // "voice" rather than a new category on purpose: they belong with how a
  // person sounds, and adding a category would reshuffle the flow's
  // section pacing.
  {
    id: "voice-what-they-called-you",
    category: "voice",
    prompt:
      "What did they call you? Not your name — the other thing. The nickname that stuck, the way they mangled it, the word they used when you were in trouble versus when you'd done something right. And what did you call them back?",
    promptSelf:
      "What do you call the people closest to you? Not their names — the other thing. The nickname that stuck, the way you mangle it, the word you use when someone's in trouble versus when they've done something right. And what do they call you back?",
    placeholder:
      "Maybe it was mija, or kiddo, or your full name with the middle one when you'd messed up. Maybe they never used your name at all, just started talking.",
    placeholderSelf:
      "Maybe it's mija, or kiddo, or their full name with the middle one when they've messed up. Maybe you never use a name at all, you just start talking.",
    estimateMinutes: 3,
  },
  {
    id: "voice-how-they-texted",
    category: "voice",
    prompt:
      "How did they actually use a phone? All caps or none, signed their name at the end of every message, punctuation everywhere or nowhere, voice notes instead of typing, one word answers, the emoji they used wrong. Be specific — this is the part people recognize instantly.",
    promptSelf:
      "How do you actually use your phone? All caps or none, do you sign your name at the end, punctuation everywhere or nowhere, voice notes instead of typing, one-word answers, an emoji you know you use wrong. Be specific — this is the part people recognize instantly.",
    placeholder:
      "Maybe every text ended with \"- Dad\" even though the phone said who it was. Maybe it was all lowercase, no periods, three messages in a row instead of one.",
    placeholderSelf:
      "Maybe you sign every text even though they know it's you. Maybe it's all lowercase, no periods, three messages in a row instead of one.",
    estimateMinutes: 3,
  },
  {
    id: "voice-the-unreasonable-opinion",
    category: "voice",
    prompt:
      "What did they have a completely unreasonable opinion about? Not the principled stuff — the small thing they'd argue about forever. The right way to load a dishwasher, a road they refused to drive on, a food they took personally, someone on TV they couldn't stand.",
    promptSelf:
      "What do you have a completely unreasonable opinion about? Not the principled stuff — the small thing you'll argue about forever. The right way to load a dishwasher, a road you refuse to drive on, a food you take personally, someone on TV you can't stand.",
    placeholder:
      "Bread from the good bakery or none at all, the toll road is a scam, that anchor on channel 7, nobody needs a truck that big, the thermostat stays where it is.",
    placeholderSelf:
      "Bread from the good bakery or none at all, the toll road is a scam, that anchor on channel 7, nobody needs a truck that big, the thermostat stays where it is.",
    estimateMinutes: 3,
  },
  {
    id: "origin-what-they-did-all-day",
    category: "origin",
    prompt:
      "What did they do all day, for most of their life? The job, the trade, the shift — and what they were actually good at inside it. What could they talk about forever, and what would they hand to somebody else because it wasn't theirs to know?",
    promptSelf:
      "What do you do all day, and what did you do before that? The job, the trade, the shift — and what you're actually good at inside it. What could you talk about forever, and what would you hand to somebody else because it isn't yours to know?",
    placeholder:
      "Thirty-one years driving a school bus. Knew every pothole on the route and every kid's stop without looking. Couldn't tell you a thing about computers and never pretended to.",
    placeholderSelf:
      "Thirty-one years driving a school bus. You know every pothole on the route and every kid's stop without looking. Couldn't tell anybody a thing about computers and you don't pretend to.",
    estimateMinutes: 4,
  },
  {
    id: "relationships-who-was-in-the-room",
    category: "relationships",
    prompt:
      "Who was around them, day to day? A husband or wife, kids, the friend who called every Sunday, the neighbor who let themselves in. Names, and what each one was to them — we'd rather know four people properly than twenty in a list.",
    promptSelf:
      "Who's around you, day to day? A husband or wife, kids, the friend who calls every Sunday, the neighbor who lets themselves in. Names, and what each one is to you — we'd rather know four people properly than twenty in a list.",
    placeholder:
      "Tito, her husband of forty years. Nena next door, who never knocked. Their son Marco, who called every Sunday at six. The dog, Pepper, who counted.",
    placeholderSelf:
      "Tito, my husband of forty years. Nena next door, who never knocks. My son Marco, who calls every Sunday at six. The dog, Pepper, who counts.",
    estimateMinutes: 4,
  },

  // ── Values — what I believe ─────────────────────────────────────────────
  {
    id: "values-non-negotiable",
    category: "values",
    prompt:
      "What is their one non-negotiable — the line they will not cross no matter what it costs? Tell about a moment they proved it, not just believed it.",
    promptSelf:
      "What is your one non-negotiable — the line you will not cross no matter what it costs? Tell about a moment you proved it, not just believed it.",
    placeholder:
      "Never lie to family. Never take what you didn't earn. Never leave someone stranded. The rule, plus the day it got tested.",
    placeholderSelf:
      "Never lie to family. Never take what you didn't earn. Never leave someone stranded. The rule, plus the day it got tested.",
    estimateMinutes: 4,
  },
  {
    id: "values-how-they-decide",
    category: "values",
    prompt:
      "When they face a truly hard decision, what do they weigh it against? A parent's voice, a scripture, a gut feeling, a question they ask themselves in the dark? Describe how they actually decide.",
    promptSelf:
      "When you face a truly hard decision, what do you weigh it against? A parent's voice, a scripture, a gut feeling, a question you ask yourself in the dark? Describe how you actually decide.",
    placeholder:
      "\"What would my mother say?\" \"Could I explain this to my kids?\" A night of pacing, a list on paper, a prayer, a long drive. Their real method.",
    placeholderSelf:
      "\"What would my mother say?\" \"Could I explain this to my kids?\" A night of pacing, a list on paper, a prayer, a long drive. Your real method.",
    estimateMinutes: 4,
  },
  {
    id: "values-faith",
    category: "values",
    prompt:
      "What do they believe about God, or the universe, or what comes after — and how does that belief, or its absence, show up in an ordinary week of their life?",
    promptSelf:
      "What do you believe about God, or the universe, or what comes after — and how does that belief, or its absence, show up in an ordinary week of your life?",
    placeholder:
      "The rosary in the car, the Friday prayer, the Sunday pew, the quiet doubt, the peace they made without religion, the grace said only at holidays.",
    placeholderSelf:
      "The rosary in the car, the Friday prayer, the Sunday pew, the quiet doubt, the peace you made without religion, the grace said only at holidays.",
    estimateMinutes: 4,
  },
  {
    id: "values-changed-mind",
    category: "values",
    prompt:
      "What's a belief they held hard when they were younger that they've since changed their mind about? What happened between then and now that changed it?",
    promptSelf:
      "What's a belief you held hard when you were younger that you've since changed your mind about? What happened between then and now that changed it?",
    placeholder:
      "Something they'd have argued for at 25 that they'd argue against today. Usually a person or an event did it — name the turn.",
    placeholderSelf:
      "Something you'd have argued for at 25 that you'd argue against today. Usually a person or an event did it — name the turn.",
    estimateMinutes: 4,
  },

  // ── Relationships — who I love ──────────────────────────────────────────
  {
    id: "rel-how-they-love",
    category: "relationships",
    prompt:
      "How do they love people — in actions, not words? Give one real moment when someone felt it and knew it could only have come from them.",
    promptSelf:
      "How do you love people — in actions, not words? Give one real moment when someone felt it and knew it could only have come from you.",
    placeholder:
      "The plate made without asking, the tank of gas, showing up early to set up chairs, the teasing that means you're theirs. One true moment.",
    placeholderSelf:
      "The plate made without asking, the tank of gas, showing up early to set up chairs, the teasing that means they're yours. One true moment.",
    estimateMinutes: 4,
  },
  {
    id: "rel-apology-and-forgiveness",
    category: "relationships",
    prompt:
      "How do they apologize when they're truly wrong — and how do they forgive when they've been truly hurt? Do the words come, or does something else stand in for them?",
    promptSelf:
      "How do you apologize when you're truly wrong — and how do you forgive when you've been truly hurt? Do the words come, or does something else stand in for them?",
    placeholder:
      "A letter, a favorite meal, showing up with tools to fix something, the words said plainly once and never again. And forgiveness: fast, slow, or never quite?",
    placeholderSelf:
      "A letter, a favorite meal, showing up with tools to fix something, the words said plainly once and never again. And forgiveness: fast, slow, or never quite?",
    estimateMinutes: 4,
  },
  {
    id: "rel-holding-on",
    category: "relationships",
    prompt:
      "Who have they held onto the longest — a bond that survived years, distance, or even a falling-out — and what does the holding on actually look like? Tell a little of that story.",
    promptSelf:
      "Who have you held onto the longest — a bond that survived years, distance, or even a falling-out — and what does the holding on actually look like? Tell a little of that story.",
    placeholder:
      "The Sunday call for forty years, the friend from the old neighborhood, the sibling they fought with and never let go of. How they kept the line open.",
    placeholderSelf:
      "The Sunday call for forty years, the friend from the old neighborhood, the sibling you fought with and never let go of. How you kept the line open.",
    estimateMinutes: 4,
  },
  {
    id: "rel-never-said-i-love-you",
    category: "relationships",
    prompt:
      "Is there someone they never got to say \"I love you\" to — or never said it enough? Who was it, and what would they say now if the room were quiet and there was time?",
    promptSelf:
      "Is there someone you never got to say \"I love you\" to — or never said it enough? Who was it, and what would you say now if the room were quiet and there was time?",
    placeholder:
      "Write it here, in as many words as it takes. This is the room for that.",
    placeholderSelf:
      "Write it here, in as many words as it takes. This is the room for that.",
    estimateMinutes: 5,
  },

  // ── Lived — what I've lived through ─────────────────────────────────────
  {
    id: "lived-before-and-after",
    category: "lived",
    prompt:
      "What is the event that split their life into a before and an after? Tell what happened, and who they were on each side of it.",
    promptSelf:
      "What is the event that split your life into a before and an after? Tell what happened, and who you were on each side of it.",
    placeholder:
      "A move, a war, a diagnosis, a birth, a border crossing, a phone call, the day something got decided in them. It doesn't have to be tragic — it has to be true.",
    placeholderSelf:
      "A move, a war, a diagnosis, a birth, a border crossing, a phone call, the day something got decided in you. It doesn't have to be tragic — it has to be true.",
    estimateMinutes: 5,
  },
  {
    id: "lived-loss",
    category: "lived",
    prompt:
      "What is the hardest loss they've survived, and how did they carry it? What did grief actually look like on them — not how it's supposed to look?",
    promptSelf:
      "What is the hardest loss you've survived, and how did you carry it? What did grief actually look like on you — not how it's supposed to look?",
    placeholder:
      "Did they work double shifts, cook for everyone, go quiet for a year, tell the same stories, plant something? The specific shape their survival took.",
    placeholderSelf:
      "Did you work double shifts, cook for everyone, go quiet for a year, tell the same stories, plant something? The specific shape your survival took.",
    estimateMinutes: 5,
  },
  {
    id: "lived-proudest-moment",
    category: "lived",
    prompt:
      "Describe the proudest moment of their life — not the biggest achievement, the moment they knew they'd done right. Set the scene.",
    promptSelf:
      "Describe the proudest moment of your life — not the biggest achievement, the moment you knew you'd done right. Set the scene.",
    placeholder:
      "It doesn't have to be public. It might have been a phone call, a decision, a hand they held, a door they didn't walk through.",
    placeholderSelf:
      "It doesn't have to be public. It might have been a phone call, a decision, a hand you held, a door you didn't walk through.",
    estimateMinutes: 4,
  },
  {
    id: "lived-regret",
    category: "lived",
    prompt:
      "What regret do they carry? Not a mistake — a regret. Write it the way they'd tell it if they were being completely honest.",
    promptSelf:
      "What regret do you carry? Not a mistake — a regret. Write it the way you'd tell it if you were being completely honest.",
    placeholder:
      "A person they didn't call back, words said or never said, a chance they let pass. Truth over polish — this is for the record.",
    placeholderSelf:
      "A person you didn't call back, words said or never said, a chance you let pass. Truth over polish — this is for the record.",
    estimateMinutes: 4,
  },

  // ── Wisdom — what I've learned ──────────────────────────────────────────
  {
    id: "wisdom-scared-child",
    category: "wisdom",
    prompt:
      "What would they tell a scared child — kneeling down, eye to eye — about the thing the grown-ups aren't taking seriously? Write their actual words.",
    promptSelf:
      "What would you tell a scared child — kneeling down, eye to eye — about the thing the grown-ups aren't taking seriously? Write your actual words.",
    placeholder:
      "The tone matters as much as the advice. Kneel-down words, not motivational-poster words. What they'd say, and how they'd say it.",
    placeholderSelf:
      "The tone matters as much as the advice. Kneel-down words, not motivational-poster words. What you'd say, and how you'd say it.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-worst-mistake",
    category: "wisdom",
    prompt:
      "What would they tell a young person who has just made the worst mistake of their life so far?",
    promptSelf:
      "What would you tell a young person who has just made the worst mistake of their life so far?",
    placeholder:
      "Not what a teacher would say — what they would say. Honest first and kind second, or the other way around. Write the actual sentences.",
    placeholderSelf:
      "Not what a teacher would say — what you would say. Honest first and kind second, or the other way around. Write the actual sentences.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-dying-friend",
    category: "wisdom",
    prompt:
      "What would they say — or deliberately not say — sitting beside an old friend who is dying and knows it? Would they talk, joke, pray, hold a hand, mostly listen?",
    promptSelf:
      "What would you say — or deliberately not say — sitting beside an old friend who is dying and knows it? Would you talk, joke, pray, hold a hand, mostly listen?",
    placeholder:
      "One of the most honest questions here. Write what you truly think they'd do in that chair, not what sounds good.",
    placeholderSelf:
      "One of the most honest questions here. Write what you'd truly do in that chair, not what sounds good.",
    estimateMinutes: 4,
  },
  {
    id: "wisdom-themselves-at-20",
    category: "wisdom",
    prompt:
      "If they could sit down with themselves at 20 for one cup of coffee, what would they try to get across — and what would they keep back, because 20-year-old them wasn't ready to hear it?",
    promptSelf:
      "If you could sit down with yourself at 20 for one cup of coffee, what would you try to get across — and what would you keep back, because 20-year-old you wasn't ready to hear it?",
    placeholder:
      "One conversation, sixty minutes. The warning, the reassurance, the one thing they'd insist on — and the thing they'd let them find out alone.",
    placeholderSelf:
      "One conversation, sixty minutes. The warning, the reassurance, the one thing you'd insist on — and the thing you'd let them find out alone.",
    estimateMinutes: 5,
  },

  // ── Private self — who I am alone ───────────────────────────────────────
  {
    id: "private-first-hour",
    category: "private_self",
    prompt:
      "What does the first hour of their day look like when no one is watching? The exact order of things — and the one step they will not skip.",
    promptSelf:
      "What does the first hour of your day look like when no one is watching? The exact order of things — and the one step you will not skip.",
    placeholder:
      "The coffee made one particular way, the prayer, the news, the walk, the radio at a certain volume, the same chair. Ritual, in order.",
    placeholderSelf:
      "The coffee made one particular way, the prayer, the news, the walk, the radio at a certain volume, the same chair. Ritual, in order.",
    estimateMinutes: 3,
  },
  {
    id: "private-alone-in-the-car",
    category: "private_self",
    prompt:
      "What do they play when they're driving alone — and what happens when the right song comes on? Name the actual songs or the actual silence.",
    promptSelf:
      "What do you play when you're driving alone — and what happens when the right song comes on? Name the actual songs or the actual silence.",
    placeholder:
      "The steering-wheel drums, the full-voice chorus with the windows up, the same three albums for twenty years, talk radio, blessed quiet.",
    placeholderSelf:
      "The steering-wheel drums, the full-voice chorus with the windows up, the same three albums for twenty years, talk radio, blessed quiet.",
    estimateMinutes: 3,
  },
  {
    id: "private-unconscious-tic",
    category: "private_self",
    prompt:
      "What's the physical thing they do without noticing — the tell everyone has spotted except them? When does it come out: thinking, nervous, annoyed, happy?",
    promptSelf:
      "What's the physical thing you do without noticing — the tell everyone has spotted except you? When does it come out: thinking, nervous, annoyed, happy?",
    placeholder:
      "Humming while cooking, jingling keys, the raised eyebrow, cracking knuckles, pacing on the phone, drumming the table when they're deciding.",
    placeholderSelf:
      "Humming while cooking, jingling keys, the raised eyebrow, cracking knuckles, pacing on the phone, drumming the table when you're deciding.",
    estimateMinutes: 2,
  },
  {
    id: "private-comfort-food",
    category: "private_self",
    prompt:
      "What do they eat or drink when nobody's watching and nobody has to be impressed? The late-night plate, the thing that means home when no one else is there to see it.",
    promptSelf:
      "What do you eat or drink when nobody's watching and nobody has to be impressed? The late-night plate, the thing that means home when no one else is there to see it.",
    placeholder:
      "Crackers over the sink, white rice with butter, tea at 2 AM, the childhood snack they never outgrew, the exact sandwich cut the exact way.",
    placeholderSelf:
      "Crackers over the sink, white rice with butter, tea at 2 AM, the childhood snack you never outgrew, the exact sandwich cut the exact way.",
    estimateMinutes: 2,
  },

  // ── Anchors — what I carry ──────────────────────────────────────────────
  {
    id: "anchors-smell",
    category: "anchors",
    prompt:
      "What smell would stop them mid-step in a doorway — the one that brings a whole world back? Whose world is it, and where does it take them?",
    promptSelf:
      "What smell would stop you mid-step in a doorway — the one that brings a whole world back? Whose world is it, and where does it take you?",
    placeholder:
      "Sofrito on the stove, diesel, cedar, rain on hot pavement, a certain soap, bread baking, a perfume they haven't smelled in thirty years.",
    placeholderSelf:
      "Sofrito on the stove, diesel, cedar, rain on hot pavement, a certain soap, bread baking, a perfume you haven't smelled in thirty years.",
    estimateMinutes: 2,
  },
  {
    id: "anchors-sound",
    category: "anchors",
    prompt:
      "What's a sound that IS them — the one the people who love them could pick out of a crowded room? Describe it so someone could almost hear it.",
    promptSelf:
      "What's a sound that IS you — the one the people who love you could pick out of a crowded room? Describe it so someone could almost hear it.",
    placeholder:
      "The laugh, the whistle, the footsteps on the stairs, the throat-clear before they disagree, the keys in the door at the same hour every day.",
    placeholderSelf:
      "The laugh, the whistle, the footsteps on the stairs, the throat-clear before you disagree, the keys in the door at the same hour every day.",
    estimateMinutes: 3,
  },
  {
    id: "anchors-place",
    category: "anchors",
    prompt:
      "Where in the world do they feel most themselves? Be exact — a corner of a room, a bench, a stretch of road, a body of water at a certain hour.",
    promptSelf:
      "Where in the world do you feel most yourself? Be exact — a corner of a room, a bench, a stretch of road, a body of water at a certain hour.",
    placeholder:
      "The kitchen at 6 AM. The porch after everyone's gone to bed. A pew, a garage, a river they'll drive an hour to stand next to.",
    placeholderSelf:
      "The kitchen at 6 AM. The porch after everyone's gone to bed. A pew, a garage, a river you'll drive an hour to stand next to.",
    estimateMinutes: 3,
  },
  {
    id: "anchors-object",
    category: "anchors",
    prompt:
      "What object have they kept for decades and will never give up? Where did it come from — and what is it really holding for them?",
    promptSelf:
      "What object have you kept for decades and will never give up? Where did it come from — and what is it really holding for you?",
    placeholder:
      "A jacket, a ring, a chipped mug, a beat-up book, a tool from their father, a photo gone soft at the corners in their wallet. The story of how it got to them.",
    placeholderSelf:
      "A jacket, a ring, a chipped mug, a beat-up book, a tool from your father, a photo gone soft at the corners in your wallet. The story of how it got to you.",
    estimateMinutes: 4,
  },

  // ── Courage — what I stand for at cost ──────────────────────────────────
  {
    id: "courage-refused",
    category: "courage",
    prompt:
      "Tell about a time they refused — a job, an order, a deal, an easy lie — because it wasn't right. What did the refusal cost them, and did they ever look back?",
    promptSelf:
      "Tell about a time you refused — a job, an order, a deal, an easy lie — because it wasn't right. What did the refusal cost you, and did you ever look back?",
    placeholder:
      "The day they quit on principle, handed the money back, wouldn't sign, wouldn't repeat the lie. What it cost — and whether they'd pay it again.",
    placeholderSelf:
      "The day you quit on principle, handed the money back, wouldn't sign, wouldn't repeat the lie. What it cost — and whether you'd pay it again.",
    estimateMinutes: 4,
  },
  {
    id: "courage-defended-someone",
    category: "courage",
    prompt:
      "Describe a time they stood up for someone who couldn't stand up for themselves. What did they actually say or do in the moment — and what could it have cost?",
    promptSelf:
      "Describe a time you stood up for someone who couldn't stand up for themselves. What did you actually say or do in the moment — and what could it have cost?",
    placeholder:
      "The new kid, the waiter getting yelled at, the coworker taking the blame, a stranger at a bus stop. The moment, in their words and actions.",
    placeholderSelf:
      "The new kid, the waiter getting yelled at, the coworker taking the blame, a stranger at a bus stop. The moment, in your words and actions.",
    estimateMinutes: 4,
  },
  {
    id: "courage-no-to-family",
    category: "courage",
    prompt:
      "Have they ever had to say no to their own family — to disappoint people they love in order to stay true to themselves or protect someone? What happened, and what did it cost at the table?",
    promptSelf:
      "Have you ever had to say no to your own family — to disappoint people you love in order to stay true to yourself or protect someone? What happened, and what did it cost at the table?",
    placeholder:
      "The marriage the family didn't bless, the business they wouldn't join, the secret they wouldn't keep, the door they held open when everyone said close it.",
    placeholderSelf:
      "The marriage the family didn't bless, the business you wouldn't join, the secret you wouldn't keep, the door you held open when everyone said close it.",
    estimateMinutes: 4,
  },
  {
    id: "courage-gave-quietly",
    category: "courage",
    prompt:
      "What have they given quietly — money, time, forgiveness, credit — that most people never found out about? Tell one story they'd probably be embarrassed you know.",
    promptSelf:
      "What have you given quietly — money, time, forgiveness, credit — that most people never found out about? Tell one story you'd probably be embarrassed anyone knows.",
    placeholder:
      "The rent covered without a word, the recipe credit given away, the nights driving someone to treatment, the name kept out of it on purpose.",
    placeholderSelf:
      "The rent covered without a word, the recipe credit given away, the nights driving someone to treatment, the name kept out of it on purpose.",
    estimateMinutes: 4,
  },

  // ── The big ones — long-form essay questions ────────────────────────────
  {
    id: "essay-story-for-grandchildren",
    category: "essay",
    prompt:
      "What is the one story you want the grandchildren — or whoever comes after — to grow up telling about them? Tell it in full, the way you'd want it told at the table.",
    promptSelf:
      "What is the one story you want the grandchildren — or whoever comes after — to grow up telling about you? Tell it in full, the way you'd want it told at the table.",
    placeholder:
      "The founding myth. The story that comes out at holidays. Write the whole thing — the setup, the middle, the moment, the line everyone waits for.",
    placeholderSelf:
      "The founding myth. The story that comes out at holidays. Write the whole thing — the setup, the middle, the moment, the line everyone waits for.",
    estimateMinutes: 10,
  },
  {
    id: "essay-ordinary-day-relive",
    category: "essay",
    prompt:
      "What ordinary day of their life would they relive if given the chance? Not the wedding, not the graduation — an ordinary day. Walk through it from waking to sleep.",
    promptSelf:
      "What ordinary day of your life would you relive if given the chance? Not the wedding, not the graduation — an ordinary day. Walk through it from waking to sleep.",
    placeholder:
      "Wake up, coffee, who's in the house, what's cooking, where they go, who they talk to, how the day ends. As much detail as you can give.",
    placeholderSelf:
      "Wake up, coffee, who's in the house, what's cooking, where you go, who you talk to, how the day ends. As much detail as you can give.",
    estimateMinutes: 8,
  },
  {
    id: "essay-sealed-letter",
    category: "essay",
    prompt:
      "If they could leave one letter, sealed and unread until years after they're gone, who would it be to — and what would it say? Write the letter here, in full.",
    promptSelf:
      "If you could leave one letter, sealed and unread until years after you're gone, who would it be to — and what would it say? Write the letter here, in full.",
    placeholder:
      "Take your time. This is a real letter. Salutation, body, sign-off — the whole thing, in their voice.",
    placeholderSelf:
      "Take your time. This is a real letter. Salutation, body, sign-off — the whole thing, in your voice.",
    estimateMinutes: 12,
  },
  {
    id: "essay-remembered-specifically",
    category: "essay",
    prompt:
      "How do they want to be remembered? Not \"as a good person\" — specifically. When someone says their name at a table ten years from now, what's the story that should follow?",
    promptSelf:
      "How do you want to be remembered? Not \"as a good person\" — specifically. When someone says your name at a table ten years from now, what's the story that should follow?",
    placeholder:
      "The line. The story. The way the conversation should go when their name comes up. Write what you'd want to overhear.",
    placeholderSelf:
      "The line. The story. The way the conversation should go when your name comes up. Write what you'd want to overhear.",
    estimateMinutes: 8,
  },
];

/**
 * Total number of questions. Used across the flow for progress bars,
 * clamping current-step values, and the MIN_ANSWERS calculation.
 * Derived so any change to the array above stays in sync.
 */
export const LEGACY_QUESTION_COUNT = LEGACY_QUESTIONS.length;
