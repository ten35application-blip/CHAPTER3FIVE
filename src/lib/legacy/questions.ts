/**
 * The 40 legacy questions — 10 categories, 4 each. All open-ended.
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
 * Questions are phrased in the third person ("they") so a family can
 * sit together and answer about someone they love. When someone answers
 * about themselves, the intro page tells them to just write in their
 * own voice — the wording still works.
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
      "Take us inside the place where they grew up — the house, the apartment, the room they shared. Who was in it, what did it sound like at dinnertime, and where did they go when they needed to disappear?",
    placeholder:
      "The kitchen table, the crowded bed, the yard, the noise or the silence. Small details carry the most — a wallpaper, a radio, a door that stuck.",
    estimateMinutes: 4,
  },
  {
    id: "origin-who-raised-them",
    category: "origin",
    prompt:
      "Who actually raised them? Not just the names on paper — the person whose voice still comes out of their mouth. What did that person teach them without ever saying it out loud?",
    placeholder:
      "A mother, a grandfather, an aunt, an older sibling, a neighbor who fed them after school. The lesson that arrived by watching, not by lecture.",
    estimateMinutes: 4,
  },
  {
    id: "origin-family-pattern",
    category: "origin",
    prompt:
      "Every family hands down a pattern — a way of working, worrying, celebrating, keeping secrets, showing up. What pattern were they born into, and which part of it did they keep or fight to break?",
    placeholder:
      "\"In our family, you never talked about money.\" \"Everyone worked with their hands.\" \"Nobody left.\" Name the pattern, then what they did with it.",
    estimateMinutes: 4,
  },
  {
    id: "origin-first-responsibility",
    category: "origin",
    prompt:
      "What was the first real responsibility they carried — the first time something or someone truly depended on them? How old were they, and what did it make of them?",
    placeholder:
      "Watching a younger sibling, translating for their parents, cooking at nine, a paper route, the animals, the family store before school.",
    estimateMinutes: 3,
  },

  // ── Voice — how I speak ─────────────────────────────────────────────────
  {
    id: "voice-signature-phrase",
    category: "voice",
    prompt:
      "What phrase or word did they wear out — the one that would tell you exactly who was talking before you even turned around? Write it the way they say it.",
    placeholder:
      "The catchphrase, the tic, the way they always end a sentence or answer the phone. Spelling doesn't matter — the sound does.",
    estimateMinutes: 2,
  },
  {
    id: "voice-how-they-make-you-laugh",
    category: "voice",
    prompt:
      "How do they make people laugh? An impression, a face, a dry line delivered deadpan, teasing that means love? Show the specifics — the bit everyone's heard a hundred times and still laughs at.",
    placeholder:
      "Show it, don't just name it. Write the joke, the routine, the face, the timing — the thing only they can pull off.",
    estimateMinutes: 3,
  },
  {
    id: "voice-storytelling-shape",
    category: "voice",
    prompt:
      "When they're really telling a story, what's the shape of it? Slow build with every detail intact, straight to the punchline, sidetracked by three other stories on the way?",
    placeholder:
      "Give the rhythm — do they set the scene forever, act out all the parts, lose the thread on purpose, land it clean and walk away?",
    estimateMinutes: 3,
  },
  {
    id: "voice-what-they-never-say",
    category: "voice",
    prompt:
      "What do they never say? The words that aren't in them, the subjects they steer around, the feelings they'll show a hundred ways but won't put in a sentence. What do they do instead of saying it?",
    placeholder:
      "Maybe they never say \"I'm proud of you\" but drive four hours to be in the third row. Never complain. Never say goodbye on the phone — just hang up.",
    estimateMinutes: 4,
  },

  // ── Values — what I believe ─────────────────────────────────────────────
  {
    id: "values-non-negotiable",
    category: "values",
    prompt:
      "What is their one non-negotiable — the line they will not cross no matter what it costs? Tell about a moment they proved it, not just believed it.",
    placeholder:
      "Never lie to family. Never take what you didn't earn. Never leave someone stranded. The rule, plus the day it got tested.",
    estimateMinutes: 4,
  },
  {
    id: "values-how-they-decide",
    category: "values",
    prompt:
      "When they face a truly hard decision, what do they weigh it against? A parent's voice, a scripture, a gut feeling, a question they ask themselves in the dark? Describe how they actually decide.",
    placeholder:
      "\"What would my mother say?\" \"Could I explain this to my kids?\" A night of pacing, a list on paper, a prayer, a long drive. Their real method.",
    estimateMinutes: 4,
  },
  {
    id: "values-faith",
    category: "values",
    prompt:
      "What do they believe about God, or the universe, or what comes after — and how does that belief, or its absence, show up in an ordinary week of their life?",
    placeholder:
      "The rosary in the car, the Friday prayer, the Sunday pew, the quiet doubt, the peace they made without religion, the grace said only at holidays.",
    estimateMinutes: 4,
  },
  {
    id: "values-changed-mind",
    category: "values",
    prompt:
      "What's a belief they held hard when they were younger that they've since changed their mind about? What happened between then and now that changed it?",
    placeholder:
      "Something they'd have argued for at 25 that they'd argue against today. Usually a person or an event did it — name the turn.",
    estimateMinutes: 4,
  },

  // ── Relationships — who I love ──────────────────────────────────────────
  {
    id: "rel-how-they-love",
    category: "relationships",
    prompt:
      "How do they love people — in actions, not words? Give one real moment when someone felt it and knew it could only have come from them.",
    placeholder:
      "The plate made without asking, the tank of gas, showing up early to set up chairs, the teasing that means you're theirs. One true moment.",
    estimateMinutes: 4,
  },
  {
    id: "rel-apology-and-forgiveness",
    category: "relationships",
    prompt:
      "How do they apologize when they're truly wrong — and how do they forgive when they've been truly hurt? Do the words come, or does something else stand in for them?",
    placeholder:
      "A letter, a favorite meal, showing up with tools to fix something, the words said plainly once and never again. And forgiveness: fast, slow, or never quite?",
    estimateMinutes: 4,
  },
  {
    id: "rel-holding-on",
    category: "relationships",
    prompt:
      "Who have they held onto the longest — a bond that survived years, distance, or even a falling-out — and what does the holding on actually look like? Tell a little of that story.",
    placeholder:
      "The Sunday call for forty years, the friend from the old neighborhood, the sibling they fought with and never let go of. How they kept the line open.",
    estimateMinutes: 4,
  },
  {
    id: "rel-never-said-i-love-you",
    category: "relationships",
    prompt:
      "Is there someone they never got to say \"I love you\" to — or never said it enough? Who was it, and what would they say now if the room were quiet and there was time?",
    placeholder:
      "Write it here, in as many words as it takes. This is the room for that.",
    estimateMinutes: 5,
  },

  // ── Lived — what I've lived through ─────────────────────────────────────
  {
    id: "lived-before-and-after",
    category: "lived",
    prompt:
      "What is the event that split their life into a before and an after? Tell what happened, and who they were on each side of it.",
    placeholder:
      "A move, a war, a diagnosis, a birth, a border crossing, a phone call, the day something got decided in them. It doesn't have to be tragic — it has to be true.",
    estimateMinutes: 5,
  },
  {
    id: "lived-loss",
    category: "lived",
    prompt:
      "What is the hardest loss they've survived, and how did they carry it? What did grief actually look like on them — not how it's supposed to look?",
    placeholder:
      "Did they work double shifts, cook for everyone, go quiet for a year, tell the same stories, plant something? The specific shape their survival took.",
    estimateMinutes: 5,
  },
  {
    id: "lived-proudest-moment",
    category: "lived",
    prompt:
      "Describe the proudest moment of their life — not the biggest achievement, the moment they knew they'd done right. Set the scene.",
    placeholder:
      "It doesn't have to be public. It might have been a phone call, a decision, a hand they held, a door they didn't walk through.",
    estimateMinutes: 4,
  },
  {
    id: "lived-regret",
    category: "lived",
    prompt:
      "What regret do they carry? Not a mistake — a regret. Write it the way they'd tell it if they were being completely honest.",
    placeholder:
      "A person they didn't call back, words said or never said, a chance they let pass. Truth over polish — this is for the record.",
    estimateMinutes: 4,
  },

  // ── Wisdom — what I've learned ──────────────────────────────────────────
  {
    id: "wisdom-scared-child",
    category: "wisdom",
    prompt:
      "What would they tell a scared child — kneeling down, eye to eye — about the thing the grown-ups aren't taking seriously? Write their actual words.",
    placeholder:
      "The tone matters as much as the advice. Kneel-down words, not motivational-poster words. What they'd say, and how they'd say it.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-worst-mistake",
    category: "wisdom",
    prompt:
      "What would they tell a young person who has just made the worst mistake of their life so far?",
    placeholder:
      "Not what a teacher would say — what they would say. Honest first and kind second, or the other way around. Write the actual sentences.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-dying-friend",
    category: "wisdom",
    prompt:
      "What would they say — or deliberately not say — sitting beside an old friend who is dying and knows it? Would they talk, joke, pray, hold a hand, mostly listen?",
    placeholder:
      "One of the most honest questions here. Write what you truly think they'd do in that chair, not what sounds good.",
    estimateMinutes: 4,
  },
  {
    id: "wisdom-themselves-at-20",
    category: "wisdom",
    prompt:
      "If they could sit down with themselves at 20 for one cup of coffee, what would they try to get across — and what would they keep back, because 20-year-old them wasn't ready to hear it?",
    placeholder:
      "One conversation, sixty minutes. The warning, the reassurance, the one thing they'd insist on — and the thing they'd let them find out alone.",
    estimateMinutes: 5,
  },

  // ── Private self — who I am alone ───────────────────────────────────────
  {
    id: "private-first-hour",
    category: "private_self",
    prompt:
      "What does the first hour of their day look like when no one is watching? The exact order of things — and the one step they will not skip.",
    placeholder:
      "The coffee made one particular way, the prayer, the news, the walk, the radio at a certain volume, the same chair. Ritual, in order.",
    estimateMinutes: 3,
  },
  {
    id: "private-alone-in-the-car",
    category: "private_self",
    prompt:
      "What do they play when they're driving alone — and what happens when the right song comes on? Name the actual songs or the actual silence.",
    placeholder:
      "The steering-wheel drums, the full-voice chorus with the windows up, the same three albums for twenty years, talk radio, blessed quiet.",
    estimateMinutes: 3,
  },
  {
    id: "private-unconscious-tic",
    category: "private_self",
    prompt:
      "What's the physical thing they do without noticing — the tell everyone has spotted except them? When does it come out: thinking, nervous, annoyed, happy?",
    placeholder:
      "Humming while cooking, jingling keys, the raised eyebrow, cracking knuckles, pacing on the phone, drumming the table when they're deciding.",
    estimateMinutes: 2,
  },
  {
    id: "private-comfort-food",
    category: "private_self",
    prompt:
      "What do they eat or drink when nobody's watching and nobody has to be impressed? The late-night plate, the thing that means home when no one else is there to see it.",
    placeholder:
      "Crackers over the sink, white rice with butter, tea at 2 AM, the childhood snack they never outgrew, the exact sandwich cut the exact way.",
    estimateMinutes: 2,
  },

  // ── Anchors — what I carry ──────────────────────────────────────────────
  {
    id: "anchors-smell",
    category: "anchors",
    prompt:
      "What smell would stop them mid-step in a doorway — the one that brings a whole world back? Whose world is it, and where does it take them?",
    placeholder:
      "Sofrito on the stove, diesel, cedar, rain on hot pavement, a certain soap, bread baking, a perfume they haven't smelled in thirty years.",
    estimateMinutes: 2,
  },
  {
    id: "anchors-sound",
    category: "anchors",
    prompt:
      "What's a sound that IS them — the one the people who love them could pick out of a crowded room? Describe it so someone could almost hear it.",
    placeholder:
      "The laugh, the whistle, the footsteps on the stairs, the throat-clear before they disagree, the keys in the door at the same hour every day.",
    estimateMinutes: 3,
  },
  {
    id: "anchors-place",
    category: "anchors",
    prompt:
      "Where in the world do they feel most themselves? Be exact — a corner of a room, a bench, a stretch of road, a body of water at a certain hour.",
    placeholder:
      "The kitchen at 6 AM. The porch after everyone's gone to bed. A pew, a garage, a river they'll drive an hour to stand next to.",
    estimateMinutes: 3,
  },
  {
    id: "anchors-object",
    category: "anchors",
    prompt:
      "What object have they kept for decades and will never give up? Where did it come from — and what is it really holding for them?",
    placeholder:
      "A jacket, a ring, a chipped mug, a beat-up book, a tool from their father, a photo gone soft at the corners in their wallet. The story of how it got to them.",
    estimateMinutes: 4,
  },

  // ── Courage — what I stand for at cost ──────────────────────────────────
  {
    id: "courage-refused",
    category: "courage",
    prompt:
      "Tell about a time they refused — a job, an order, a deal, an easy lie — because it wasn't right. What did the refusal cost them, and did they ever look back?",
    placeholder:
      "The day they quit on principle, handed the money back, wouldn't sign, wouldn't repeat the lie. What it cost — and whether they'd pay it again.",
    estimateMinutes: 4,
  },
  {
    id: "courage-defended-someone",
    category: "courage",
    prompt:
      "Describe a time they stood up for someone who couldn't stand up for themselves. What did they actually say or do in the moment — and what could it have cost?",
    placeholder:
      "The new kid, the waiter getting yelled at, the coworker taking the blame, a stranger at a bus stop. The moment, in their words and actions.",
    estimateMinutes: 4,
  },
  {
    id: "courage-no-to-family",
    category: "courage",
    prompt:
      "Have they ever had to say no to their own family — to disappoint people they love in order to stay true to themselves or protect someone? What happened, and what did it cost at the table?",
    placeholder:
      "The marriage the family didn't bless, the business they wouldn't join, the secret they wouldn't keep, the door they held open when everyone said close it.",
    estimateMinutes: 4,
  },
  {
    id: "courage-gave-quietly",
    category: "courage",
    prompt:
      "What have they given quietly — money, time, forgiveness, credit — that most people never found out about? Tell one story they'd probably be embarrassed you know.",
    placeholder:
      "The rent covered without a word, the recipe credit given away, the nights driving someone to treatment, the name kept out of it on purpose.",
    estimateMinutes: 4,
  },

  // ── The big ones — long-form essay questions ────────────────────────────
  {
    id: "essay-story-for-grandchildren",
    category: "essay",
    prompt:
      "What is the one story you want the grandchildren — or whoever comes after — to grow up telling about them? Tell it in full, the way you'd want it told at the table.",
    placeholder:
      "The founding myth. The story that comes out at holidays. Write the whole thing — the setup, the middle, the moment, the line everyone waits for.",
    estimateMinutes: 10,
  },
  {
    id: "essay-ordinary-day-relive",
    category: "essay",
    prompt:
      "What ordinary day of their life would they relive if given the chance? Not the wedding, not the graduation — an ordinary day. Walk through it from waking to sleep.",
    placeholder:
      "Wake up, coffee, who's in the house, what's cooking, where they go, who they talk to, how the day ends. As much detail as you can give.",
    estimateMinutes: 8,
  },
  {
    id: "essay-sealed-letter",
    category: "essay",
    prompt:
      "If they could leave one letter, sealed and unread until years after they're gone, who would it be to — and what would it say? Write the letter here, in full.",
    placeholder:
      "Take your time. This is a real letter. Salutation, body, sign-off — the whole thing, in their voice.",
    estimateMinutes: 12,
  },
  {
    id: "essay-remembered-specifically",
    category: "essay",
    prompt:
      "How do they want to be remembered? Not \"as a good person\" — specifically. When someone says their name at a table ten years from now, what's the story that should follow?",
    placeholder:
      "The line. The story. The way the conversation should go when their name comes up. Write what you'd want to overhear.",
    estimateMinutes: 8,
  },
];

/**
 * Total number of questions. Used across the flow for progress bars,
 * clamping current-step values, and the MIN_ANSWERS calculation.
 * Derived so any change to the array above stays in sync.
 */
export const LEGACY_QUESTION_COUNT = LEGACY_QUESTIONS.length;
