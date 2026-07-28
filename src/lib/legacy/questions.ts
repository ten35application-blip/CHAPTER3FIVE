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
 * Questions dual-frame in-line ("you or they") so the same wording
 * reads naturally for both audiences: someone answering about
 * themselves, or a family sitting together answering about someone
 * they love. Both get first-class phrasing — no intro-page caveat.
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
  prompt: string; // the question shown to the user
  placeholder?: string; // optional guiding hint under the input
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
      "Take us inside the place where you grew up — or where they did: the house, the apartment, the shared room. Who was in it, what did it sound like at dinnertime, and where did a kid go when they needed to disappear?",
    placeholder:
      "The kitchen table, the crowded bed, the yard, the noise or the silence. Small details carry the most — a wallpaper, a radio, a door that stuck.",
    estimateMinutes: 4,
  },
  {
    id: "origin-who-raised-them",
    category: "origin",
    prompt:
      "Who actually raised you — or them? Not just the names on paper — the person whose voice still comes out of your mouth, or theirs. What did that person teach without ever saying it out loud?",
    placeholder:
      "A mother, a grandfather, an aunt, an older sibling, a neighbor with food on the stove after school. The lesson that arrived by watching, not by lecture.",
    estimateMinutes: 4,
  },
  {
    id: "origin-family-pattern",
    category: "origin",
    prompt:
      "Every family hands down a pattern — a way of working, worrying, celebrating, keeping secrets, showing up. What pattern were you or they born into, and which part of it got kept — or fought and broken?",
    placeholder:
      "\"In our family, you never talked about money.\" \"Everyone worked with their hands.\" \"Nobody left.\" Name the pattern, then what you or they did with it.",
    estimateMinutes: 4,
  },
  {
    id: "origin-first-responsibility",
    category: "origin",
    prompt:
      "What was the first real responsibility you or they carried — the first time something or someone truly depended on a kid coming through? How old was that kid, and what did it make of them?",
    placeholder:
      "Watching a younger sibling, translating for the grown-ups, cooking at nine, a paper route, the animals, the family store before school.",
    estimateMinutes: 3,
  },

  // ── Voice — how I speak ─────────────────────────────────────────────────
  {
    id: "voice-signature-phrase",
    category: "voice",
    prompt:
      "What phrase or word did you or they wear out — the one that tells everyone exactly who's talking before they even turn around? Write it exactly the way it's said.",
    placeholder:
      "The catchphrase, the tic, the signature way of ending a sentence or answering the phone. Spelling doesn't matter — the sound does.",
    estimateMinutes: 2,
  },
  {
    id: "voice-how-they-make-you-laugh",
    category: "voice",
    prompt:
      "How do you or they make people laugh? An impression, a face, a dry line delivered deadpan, teasing that means love? Show the specifics — the bit everyone's heard a hundred times and still laughs at.",
    placeholder:
      "Show it, don't just name it. Write the joke, the routine, the face, the timing — the thing only you or they can pull off.",
    estimateMinutes: 3,
  },
  {
    id: "voice-storytelling-shape",
    category: "voice",
    prompt:
      "When you're really telling a story — or when they are — what's the shape of it? Slow build with every detail intact, straight to the punchline, sidetracked by three other stories on the way?",
    placeholder:
      "Give the rhythm — setting the scene forever, acting out all the parts, losing the thread on purpose, landing it clean and walking away?",
    estimateMinutes: 3,
  },
  {
    id: "voice-what-they-never-say",
    category: "voice",
    prompt:
      "What do you or they never say? The words that just aren't there, the subjects steered around, the feelings shown a hundred ways but never put in a sentence. What do you or they do instead of saying it?",
    placeholder:
      "Maybe \"I'm proud of you\" never gets said, but the four-hour drive to sit in the third row always happens. Never complaining. Never saying goodbye on the phone — just hanging up.",
    estimateMinutes: 4,
  },

  // ── Values — what I believe ─────────────────────────────────────────────
  {
    id: "values-non-negotiable",
    category: "values",
    prompt:
      "What is your one non-negotiable — or theirs — the line that will not be crossed no matter what it costs? Tell about a moment you or they proved it, not just believed it.",
    placeholder:
      "Never lie to family. Never take what you didn't earn. Never leave someone stranded. The rule, plus the day it got tested.",
    estimateMinutes: 4,
  },
  {
    id: "values-how-they-decide",
    category: "values",
    prompt:
      "When you or they face a truly hard decision, what does it get weighed against? A parent's voice, a scripture, a gut feeling, a question asked alone in the dark? Describe how you or they actually decide.",
    placeholder:
      "\"What would my mother say?\" \"Could I explain this to my kids?\" A night of pacing, a list on paper, a prayer, a long drive. The real method.",
    estimateMinutes: 4,
  },
  {
    id: "values-faith",
    category: "values",
    prompt:
      "What do you or they believe about God, or the universe, or what comes after — and how does that belief, or its absence, show up in an ordinary week?",
    placeholder:
      "The rosary in the car, the Friday prayer, the Sunday pew, the quiet doubt, the peace made without religion, the grace said only at holidays.",
    estimateMinutes: 4,
  },
  {
    id: "values-changed-mind",
    category: "values",
    prompt:
      "What's a hard-held belief from younger years — yours or theirs — that didn't survive? What happened between then and now that changed it?",
    placeholder:
      "Something you or they would have argued for at 25 and would argue against today. Usually a person or an event did it — name the turn.",
    estimateMinutes: 4,
  },

  // ── Relationships — who I love ──────────────────────────────────────────
  {
    id: "rel-how-they-love",
    category: "relationships",
    prompt:
      "How do you or they love people — in actions, not words? Give one real moment when someone felt it and knew it could only have come from you — or from them.",
    placeholder:
      "The plate made without asking, the tank of gas, showing up early to set up chairs, the teasing that means family. One true moment.",
    estimateMinutes: 4,
  },
  {
    id: "rel-apology-and-forgiveness",
    category: "relationships",
    prompt:
      "How do you or they apologize when truly wrong — and forgive when truly hurt? Do the words come, or does something else stand in for them?",
    placeholder:
      "A letter, a favorite meal, showing up with tools to fix something, the words said plainly once and never again. And forgiveness: fast, slow, or never quite?",
    estimateMinutes: 4,
  },
  {
    id: "rel-holding-on",
    category: "relationships",
    prompt:
      "Who have you or they held onto the longest — a bond that survived years, distance, or even a falling-out — and what does the holding on actually look like? Tell a little of that story.",
    placeholder:
      "The Sunday call for forty years, the friend from the old neighborhood, the sibling fought with and never let go of. How the line stayed open.",
    estimateMinutes: 4,
  },
  {
    id: "rel-never-said-i-love-you",
    category: "relationships",
    prompt:
      "Is there someone you or they never got to say \"I love you\" to — or never said it enough? Who was it, and what would you or they say now if the room were quiet and there was time?",
    placeholder:
      "Write it here, in as many words as it takes. This is the room for that.",
    estimateMinutes: 5,
  },

  // ── Lived — what I've lived through ─────────────────────────────────────
  {
    id: "lived-before-and-after",
    category: "lived",
    prompt:
      "What is the event that split your life — or theirs — into a before and an after? Tell what happened, and who you or they were on each side of it.",
    placeholder:
      "A move, a war, a diagnosis, a birth, a border crossing, a phone call, the day something got decided inside. It doesn't have to be tragic — it has to be true.",
    estimateMinutes: 5,
  },
  {
    id: "lived-loss",
    category: "lived",
    prompt:
      "What is the hardest loss you or they have survived, and how did you or they carry it? What did grief actually look like on the one carrying it — not how it's supposed to look?",
    placeholder:
      "Double shifts, cooking for everyone, going quiet for a year, telling the same stories, planting something? The specific shape survival took.",
    estimateMinutes: 5,
  },
  {
    id: "lived-proudest-moment",
    category: "lived",
    prompt:
      "Describe the proudest moment of your life, or of theirs — not the biggest achievement, the moment you knew you'd done right, or they knew they had. Set the scene.",
    placeholder:
      "It doesn't have to be public. It might have been a phone call, a decision, a hand held, a door not walked through.",
    estimateMinutes: 4,
  },
  {
    id: "lived-regret",
    category: "lived",
    prompt:
      "What regret do you or they carry? Not a mistake — a regret. Write it the way you'd tell it, or they'd tell it, being completely honest.",
    placeholder:
      "A person who never got called back, words said or never said, a chance let pass. Truth over polish — this is for the record.",
    estimateMinutes: 4,
  },

  // ── Wisdom — what I've learned ──────────────────────────────────────────
  {
    id: "wisdom-scared-child",
    category: "wisdom",
    prompt:
      "What would you or they tell a scared child — kneeling down, eye to eye — about the thing the grown-ups aren't taking seriously? Write the actual words.",
    placeholder:
      "The tone matters as much as the advice. Kneel-down words, not motivational-poster words. The words themselves, and how they'd sound.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-worst-mistake",
    category: "wisdom",
    prompt:
      "What would you or they tell a young person who has just made the worst mistake of their life so far?",
    placeholder:
      "Not what a teacher would say — what you or they would say. Honest first and kind second, or the other way around. Write the actual sentences.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-dying-friend",
    category: "wisdom",
    prompt:
      "What would you or they say — or deliberately not say — sitting beside an old friend who is dying and knows it? Would you or they talk, joke, pray, hold a hand, mostly listen?",
    placeholder:
      "One of the most honest questions here. Write what you'd truly do in that chair — or what you truly think they would — not what sounds good.",
    estimateMinutes: 4,
  },
  {
    id: "wisdom-themselves-at-20",
    category: "wisdom",
    prompt:
      "If you or they could sit down with that 20-year-old self for one cup of coffee, what would you or they try to get across — and what would get kept back, because that 20-year-old wasn't ready to hear it?",
    placeholder:
      "One conversation, sixty minutes. The warning, the reassurance, the one thing to insist on — and the thing that 20-year-old has to find out alone.",
    estimateMinutes: 5,
  },

  // ── Private self — who I am alone ───────────────────────────────────────
  {
    id: "private-first-hour",
    category: "private_self",
    prompt:
      "What does the first hour of your day, or theirs, look like when no one is watching? The exact order of things — and the one step you or they will not skip.",
    placeholder:
      "The coffee made one particular way, the prayer, the news, the walk, the radio at a certain volume, the same chair. Ritual, in order.",
    estimateMinutes: 3,
  },
  {
    id: "private-alone-in-the-car",
    category: "private_self",
    prompt:
      "What do you or they play when driving alone — and what happens when the right song comes on? Name the actual songs or the actual silence.",
    placeholder:
      "The steering-wheel drums, the full-voice chorus with the windows up, the same three albums for twenty years, talk radio, blessed quiet.",
    estimateMinutes: 3,
  },
  {
    id: "private-unconscious-tic",
    category: "private_self",
    prompt:
      "What's the physical thing you or they do without noticing — the tell everyone has spotted except you, or except them? When does it come out: thinking, nervous, annoyed, happy?",
    placeholder:
      "Humming while cooking, jingling keys, the raised eyebrow, cracking knuckles, pacing on the phone, drumming the table while deciding.",
    estimateMinutes: 2,
  },
  {
    id: "private-comfort-food",
    category: "private_self",
    prompt:
      "What do you or they eat or drink when nobody's watching and nobody has to be impressed? The late-night plate, the thing that means home when no one else is there to see it.",
    placeholder:
      "Crackers over the sink, white rice with butter, tea at 2 AM, the childhood snack never outgrown, the exact sandwich cut the exact way.",
    estimateMinutes: 2,
  },

  // ── Anchors — what I carry ──────────────────────────────────────────────
  {
    id: "anchors-smell",
    category: "anchors",
    prompt:
      "What smell would stop you or them mid-step in a doorway — the one that brings a whole world back? Whose world is it, and where does it take you, or them?",
    placeholder:
      "Sofrito on the stove, diesel, cedar, rain on hot pavement, a certain soap, bread baking, a perfume not smelled in thirty years.",
    estimateMinutes: 2,
  },
  {
    id: "anchors-sound",
    category: "anchors",
    prompt:
      "What's a sound that IS you — or IS them — the one the people who love you, or love them, could pick out of a crowded room? Describe it so someone could almost hear it.",
    placeholder:
      "The laugh, the whistle, the footsteps on the stairs, the throat-clear before a disagreement, the keys in the door at the same hour every day.",
    estimateMinutes: 3,
  },
  {
    id: "anchors-place",
    category: "anchors",
    prompt:
      "Where in the world do they feel most themselves — or where do you? Be exact — a corner of a room, a bench, a stretch of road, a body of water at a certain hour.",
    placeholder:
      "The kitchen at 6 AM. The porch after everyone's gone to bed. A pew, a garage, a river worth driving an hour to stand next to.",
    estimateMinutes: 3,
  },
  {
    id: "anchors-object",
    category: "anchors",
    prompt:
      "What object have you or they kept for decades and will never give up? Where did it come from — and what is it really holding for you, or for them?",
    placeholder:
      "A jacket, a ring, a chipped mug, a beat-up book, a father's old tool, a photo gone soft at the corners in a wallet. The story of how it arrived.",
    estimateMinutes: 4,
  },

  // ── Courage — what I stand for at cost ──────────────────────────────────
  {
    id: "courage-refused",
    category: "courage",
    prompt:
      "Tell about a time you or they refused — a job, an order, a deal, an easy lie — because it wasn't right. What did the refusal cost, and did you or they ever look back?",
    placeholder:
      "Quitting on principle, handing the money back, refusing to sign, refusing to repeat the lie. What it cost — and whether you or they would pay it again.",
    estimateMinutes: 4,
  },
  {
    id: "courage-defended-someone",
    category: "courage",
    prompt:
      "Describe a time you or they stood up for someone who couldn't stand up for themselves. What did you or they actually say or do in the moment — and what could it have cost?",
    placeholder:
      "The new kid, the waiter getting yelled at, the coworker taking the blame, a stranger at a bus stop. The moment, in the actual words and actions.",
    estimateMinutes: 4,
  },
  {
    id: "courage-no-to-family",
    category: "courage",
    prompt:
      "Have you or they ever had to say no to family — to disappoint the people you or they love most in order to stay true, or to protect someone? What happened, and what did it cost at the table?",
    placeholder:
      "The marriage the family didn't bless, the business turned down, the secret that wouldn't be kept, the door held open when everyone said close it.",
    estimateMinutes: 4,
  },
  {
    id: "courage-gave-quietly",
    category: "courage",
    prompt:
      "What have you or they given quietly — money, time, forgiveness, credit — that most people never found out about? Tell one story you'd — or they'd — be embarrassed anyone knows.",
    placeholder:
      "The rent covered without a word, the recipe credit given away, the nights driving someone to treatment, the name kept out of it on purpose.",
    estimateMinutes: 4,
  },

  // ── The big ones — long-form essay questions ────────────────────────────
  {
    id: "essay-story-for-grandchildren",
    category: "essay",
    prompt:
      "What is the one story you want the grandchildren — or whoever comes after — to grow up telling about you, or about them? Tell it in full, the way you'd want it told at the table.",
    placeholder:
      "The founding myth. The story that comes out at holidays. Write the whole thing — the setup, the middle, the moment, the line everyone waits for.",
    estimateMinutes: 10,
  },
  {
    id: "essay-ordinary-day-relive",
    category: "essay",
    prompt:
      "What ordinary day would you or they relive, given the chance? Not the wedding, not the graduation — an ordinary day. Walk through it from waking to sleep.",
    placeholder:
      "Wake up, coffee, who's in the house, what's cooking, where the day goes, who's talked to, how it ends. As much detail as you can give.",
    estimateMinutes: 8,
  },
  {
    id: "essay-sealed-letter",
    category: "essay",
    prompt:
      "If you or they could leave one letter, sealed and unread until years after you're gone — or they are — who would it be to, and what would it say? Write the letter here, in full.",
    placeholder:
      "Take your time. This is a real letter. Salutation, body, sign-off — the whole thing, in your voice or in theirs.",
    estimateMinutes: 12,
  },
  {
    id: "essay-remembered-specifically",
    category: "essay",
    prompt:
      "How do you or they want to be remembered? Not \"as a good person\" — specifically. When someone says your name, or theirs, at a table ten years from now, what's the story that should follow?",
    placeholder:
      "The line. The story. The way the conversation should go when that name comes up. Write what you'd want to overhear.",
    estimateMinutes: 8,
  },
];

/**
 * Total number of questions. Used across the flow for progress bars,
 * clamping current-step values, and the MIN_ANSWERS calculation.
 * Derived so any change to the array above stays in sync.
 */
export const LEGACY_QUESTION_COUNT = LEGACY_QUESTIONS.length;
