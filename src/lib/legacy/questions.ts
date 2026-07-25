/**
 * The 35 legacy questions — 7 categories, 5 each. All open-ended.
 *
 * Wilson's directive: 35 questions, all long-form ("someone has to like
 * write things in full, not just A B C D"). No multiple choice, no
 * sliders, no lists of options — every answer is 2–5 sentences of prose.
 * The synthesizer reads these directly to build the persona; the more
 * texture the answer carries, the more the resulting identity feels
 * like the person we're preserving.
 *
 * Tone target: a StoryCorps interview crossed with a love letter.
 * Warm, specific, human. Never clinical. Never a survey.
 *
 * Questions are phrased in the third person ("they") so a family can
 * sit together and answer about someone they love. When someone answers
 * about themselves, the intro page tells them to just write in their
 * own voice — the wording still works.
 *
 * The 7 categories are deliberately non-overlapping with the formula:
 * the formula already captures MBTI, love language, humor style, etc.
 * These questions capture the STORIES and SPECIFICS the formula can't
 * — actual events, actual people, actual sentences.
 */

export type LegacyCategory =
  | "voice"
  | "values"
  | "memories"
  | "relationships"
  | "wisdom"
  | "sensory"
  | "essay";

export type LegacyQuestion = {
  id: string; // slug, e.g. "voice-phone-hello"
  category: LegacyCategory;
  prompt: string; // the question shown to the user
  placeholder?: string; // optional guiding hint under the input
  estimateMinutes?: number; // rough time-to-answer hint
};

/** Display labels for the category chip above each question. */
export const LEGACY_CATEGORY_LABELS: Record<LegacyCategory, string> = {
  voice: "Voice",
  values: "Values",
  memories: "Memories",
  relationships: "Relationships",
  wisdom: "Wisdom",
  sensory: "The senses",
  essay: "The big ones",
};

export const LEGACY_QUESTIONS: LegacyQuestion[] = [
  // ── Voice — how they actually speak ─────────────────────────────────────
  {
    id: "voice-phone-hello",
    category: "voice",
    prompt:
      "How do they answer the phone when it's someone they love? Write the exact words if you can hear them.",
    placeholder:
      "\"Hey mama.\" \"There he is!\" \"Mija, what's wrong?\" \"Yeah, what.\" \"Talk to me.\"",
    estimateMinutes: 2,
  },
  {
    id: "voice-signature-phrase",
    category: "voice",
    prompt:
      "What phrase or word did they wear out — the one that would tell you exactly who was talking before you turned around?",
    placeholder:
      "The catchphrase, the tic, the way they always ended a sentence. Write it and how they'd say it.",
    estimateMinutes: 2,
  },
  {
    id: "voice-storytelling-shape",
    category: "voice",
    prompt:
      "When they're really telling a story, what's the shape of it? Slow build, dry punchline? Talking with their hands? Talking too fast because they're excited?",
    placeholder:
      "Give the rhythm — do they set the scene forever, cut to the chase, get sidetracked by side stories, land it clean?",
    estimateMinutes: 3,
  },
  {
    id: "voice-off-limits",
    category: "voice",
    prompt:
      "What's a topic they will not talk about, or will only talk about after two drinks and never again? What happens if you push?",
    placeholder:
      "A subject they steer around; how they change the subject; whether they get quiet, get angry, or get sad.",
    estimateMinutes: 3,
  },
  {
    id: "voice-how-they-make-you-laugh",
    category: "voice",
    prompt:
      "How do they make you laugh? An impression they do, a way they twist a phrase, a face they make? Write out the specifics.",
    placeholder:
      "The bit, the routine, the joke you've heard a hundred times and still laugh at. Show it, don't just name it.",
    estimateMinutes: 3,
  },

  // ── Values — what they stand on ─────────────────────────────────────────
  {
    id: "values-never-lied-about",
    category: "values",
    prompt:
      "What have they never lied about, even when lying would have been easier?",
    placeholder:
      "The thing where they'd rather take the hit than fake it. Give an example if you can — a moment they held the line.",
    estimateMinutes: 3,
  },
  {
    id: "values-who-they-admire",
    category: "values",
    prompt:
      "Who did they admire — not a famous person, someone real — and what did that person do that made them look up?",
    placeholder:
      "A teacher, a coworker, a grandparent, a neighbor. What was the specific act or way of being that stuck with them?",
    estimateMinutes: 3,
  },
  {
    id: "values-got-in-the-way",
    category: "values",
    prompt:
      "Describe a time they got in the way of something wrong. Small or huge. What did they say or do?",
    placeholder:
      "It could be defending someone at a table, walking away from a job, saying no to family. The action + the moment.",
    estimateMinutes: 3,
  },
  {
    id: "values-changed-mind",
    category: "values",
    prompt:
      "What is a belief they used to have that they've changed their mind about? What changed it?",
    placeholder:
      "Something they'd have argued for at 25 that they'd argue against now. What happened between then and now?",
    estimateMinutes: 3,
  },
  {
    id: "values-ten-dollars",
    category: "values",
    prompt:
      "If they had ten dollars and no obligations, what would they always spend it on? What does that say about them?",
    placeholder:
      "A book at the used store, a lottery ticket, coffee for the whole line, plants, dominos, seeds for the garden.",
    estimateMinutes: 2,
  },

  // ── Memories — specific moments, told in full ───────────────────────────
  {
    id: "memories-earliest-real",
    category: "memories",
    prompt:
      "Take us to the earliest memory they actually trust — not one they've been told about, one they can still see. What do they see, hear, smell?",
    placeholder:
      "Write it small and specific. A kitchen. A yard. A wallpaper pattern. The way an adult's hand felt on their head.",
    estimateMinutes: 4,
  },
  {
    id: "memories-proudest",
    category: "memories",
    prompt:
      "Describe the proudest moment of their life. Not the biggest achievement — the moment they knew they'd done right.",
    placeholder:
      "It doesn't have to be public. It might have been a phone call, a decision, a hand they held. Set the scene.",
    estimateMinutes: 4,
  },
  {
    id: "memories-regret",
    category: "memories",
    prompt:
      "What is a regret they carry? Not a mistake — a regret. Write it the way they'd write it if they were being honest.",
    placeholder:
      "A relationship that ended wrong. A job they took or didn't take. A person they didn't call back. Truth over polish.",
    estimateMinutes: 4,
  },
  {
    id: "memories-stranger-kindness",
    category: "memories",
    prompt:
      "Tell us about a kindness they received from a stranger. When was it, what happened, and why do they still remember it?",
    placeholder:
      "A meal someone paid for. A ride at the worst possible moment. A sentence a stranger said that they never forgot.",
    estimateMinutes: 3,
  },
  {
    id: "memories-day-they-knew",
    category: "memories",
    prompt:
      "The day they realized who they were as a person — what happened? Not a slow arrival. A specific day, if there was one.",
    placeholder:
      "Set the day. Where they were, what happened, what shifted. If it wasn't one day, tell us the closest thing.",
    estimateMinutes: 4,
  },

  // ── Relationships — how they love, apologize, endure ────────────────────
  {
    id: "rel-how-they-love",
    category: "relationships",
    prompt:
      "How do they love people? Show up early, cook, remember birthdays, listen without fixing, tease? Give a concrete example.",
    placeholder:
      "Their love language in the wild. A real moment when someone felt it and knew it was theirs.",
    estimateMinutes: 3,
  },
  {
    id: "rel-apology",
    category: "relationships",
    prompt:
      "How do they apologize when they're really wrong — the way they only apologize when the person actually matters?",
    placeholder:
      "Do they write a letter? Show up with something? Say the words plainly? Take a long time? Never quite say sorry, but change?",
    estimateMinutes: 3,
  },
  {
    id: "rel-friendship-that-shaped-them",
    category: "relationships",
    prompt:
      "Who's the friendship that shaped them the most? Tell the story briefly — how you met, what you did together, what changed you.",
    placeholder:
      "Not a partner or family — a friend. The one who bent the trajectory of their life a few degrees.",
    estimateMinutes: 4,
  },
  {
    id: "rel-unsaid",
    category: "relationships",
    prompt:
      "Is there someone they never got to say 'I love you' to before it was too late? Who, and what would they have said?",
    placeholder:
      "Write it here, in as many words as it takes. This is the room for that.",
    estimateMinutes: 5,
  },
  {
    id: "rel-around-someone-they-dont-respect",
    category: "relationships",
    prompt:
      "How do they behave around someone they don't respect? Watch the small things — do they get short, get too polite, get quiet, disappear?",
    placeholder:
      "The tell. Their version of a cold shoulder. It's usually a smaller signal than people expect.",
    estimateMinutes: 3,
  },

  // ── Wisdom — what they'd hand someone else ──────────────────────────────
  {
    id: "wisdom-eight-year-old",
    category: "wisdom",
    prompt:
      "What would they tell an eight-year-old kid who's scared of something the adults don't take seriously?",
    placeholder:
      "Their actual words. The tone they'd use. Kneel-down-so-you're-eye-level advice, not motivational-poster advice.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-young-adult",
    category: "wisdom",
    prompt:
      "What would they tell a young adult who has just made the worst decision of their life so far?",
    placeholder:
      "Not what a teacher would say. What they would say — the version that's honest first and kind second, or the other way around.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-new-parent-3am",
    category: "wisdom",
    prompt:
      "What would they tell a new parent at 3 AM, the first time the baby won't stop crying?",
    placeholder:
      "Practical, or spiritual, or a joke, or a hand on the back. Write the shape of the help they'd bring.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-dying-person",
    category: "wisdom",
    prompt:
      "What would they say to someone who's dying and knows it, sitting with them at the hospital? Do they talk at all — or do they mostly listen?",
    placeholder:
      "This is one of the most honest questions. Write what you actually think they'd do, not what sounds good.",
    estimateMinutes: 4,
  },
  {
    id: "wisdom-themselves-at-20",
    category: "wisdom",
    prompt:
      "What would they tell themselves at 20, if they could sit down with themselves for one cup of coffee?",
    placeholder:
      "One conversation. Sixty minutes. What they'd try to get across, and what they'd hold back because 20-year-old-them wouldn't be ready.",
    estimateMinutes: 4,
  },

  // ── Sensory & physical — the body of the person ─────────────────────────
  {
    id: "sensory-smell",
    category: "sensory",
    prompt:
      "What smell brings them instantly back — the one they'd catch in a doorway and stop for?",
    placeholder:
      "Sofrito, tobacco, cedar, chlorine, their grandmother's perfume, gasoline in the summer, wet stone after rain.",
    estimateMinutes: 2,
  },
  {
    id: "sensory-sound-that-is-them",
    category: "sensory",
    prompt:
      "A sound that IS them — a laugh, footsteps, a whistled song, the way they clear their throat, the door they always slam. Describe it in detail.",
    placeholder:
      "The sound the people who love them could pick out of a crowded room. Write it so someone could almost hear it.",
    estimateMinutes: 3,
  },
  {
    id: "sensory-most-themselves-place",
    category: "sensory",
    prompt:
      "Where in the world do they feel most themselves? Be specific — the corner of a room, a bench, a beach at a certain time of year.",
    placeholder:
      "Their kitchen at 6 AM. The porch after everyone's gone to bed. A river they drive an hour to visit.",
    estimateMinutes: 3,
  },
  {
    id: "sensory-mannerism",
    category: "sensory",
    prompt:
      "What's the physical thing they do without noticing? Hands in pockets, chewing a pen, tapping their foot, cracking knuckles, one eyebrow up?",
    placeholder:
      "The tell everyone's noticed except them. Show what it looks like and when they do it — when nervous, when thinking, when annoyed.",
    estimateMinutes: 2,
  },
  {
    id: "sensory-object-decades-old",
    category: "sensory",
    prompt:
      "What's a piece of clothing or an object they've had for decades that they'll never throw out? Where did it come from, what does it mean?",
    placeholder:
      "A jacket, a ring, a beat-up book, a chipped mug, a knife. The story of how it got to them and why it's still around.",
    estimateMinutes: 4,
  },

  // ── The big ones — long-form essay questions ────────────────────────────
  {
    id: "essay-story-for-grandchildren",
    category: "essay",
    prompt:
      "What is the one story you want the grandchildren — or their equivalent — to grow up telling about them? Tell it the way you'd want it told.",
    placeholder:
      "The founding myth. The story that comes out at holidays. Write it in full — the setup, the middle, the moment.",
    estimateMinutes: 8,
  },
  {
    id: "essay-ordinary-day-relive",
    category: "essay",
    prompt:
      "What is the ordinary day of their life they would relive if given the chance? Not the wedding, not the graduation — the ordinary day. Walk us through it.",
    placeholder:
      "Wake up, coffee, who's in the house, what they eat, where they go, who they talk to, how it ends. As much detail as you can give.",
    estimateMinutes: 8,
  },
  {
    id: "essay-thing-they-made",
    category: "essay",
    prompt:
      "What is the thing they made — a person, a project, a house, a garden, a habit, a friendship — that they're most proud of? Why?",
    placeholder:
      "Made can be broad. A daughter is made. A business is made. A recovery is made. Choose one and write around it.",
    estimateMinutes: 6,
  },
  {
    id: "essay-sealed-letter",
    category: "essay",
    prompt:
      "If they could leave one letter, sealed and unread until years after they're gone, who would it be to and what would it say? Write the letter here, in full.",
    placeholder:
      "Take your time. This is a real letter. Salutation, body, sign-off, the whole thing.",
    estimateMinutes: 12,
  },
  {
    id: "essay-remembered-specifically",
    category: "essay",
    prompt:
      "How do they want to be remembered? Not \"as a good person\" — specifically. What do they want people to say at a table when someone brings up their name a decade from now?",
    placeholder:
      "The line. The story. The way the conversation should go. Write what you'd want overheard.",
    estimateMinutes: 8,
  },
];

/**
 * Total number of questions. Used across the flow for progress bars,
 * clamping current-step values, and the MIN_ANSWERS calculation.
 * Derived so any change to the array above stays in sync.
 */
export const LEGACY_QUESTION_COUNT = LEGACY_QUESTIONS.length;
