/**
 * The 40 legacy questions — 8 categories, 5 each.
 *
 * These are the emotional core of the "For someone to keep" path. The tone
 * target is a StoryCorps interview crossed with a love letter: warm, specific,
 * human, answerable in 2–4 sentences. Never clinical.
 *
 * Questions are phrased in the third person ("they") so a family can sit
 * together and answer about someone they love. When someone answers about
 * themselves, the intro page tells them to just write in their own voice.
 */

export type LegacyCategory =
  | "voice"
  | "values"
  | "memories"
  | "relationships"
  | "quirks"
  | "wisdom"
  | "sensory"
  | "essay";

export type LegacyQuestion = {
  id: string; // slug, e.g. "voice-favorite-phrase"
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
  quirks: "Quirks",
  wisdom: "Wisdom",
  sensory: "Sensory",
  essay: "The Big Ones",
};

export const LEGACY_QUESTIONS: LegacyQuestion[] = [
  // ── Voice — how they speak ────────────────────────────────────────────────
  {
    id: "voice-hello",
    category: "voice",
    prompt: "How do they answer the phone when it's someone they love?",
    placeholder:
      "The exact words, if you can hear them. “Hey mama.” “There he is!” “Mija, what's wrong?”",
    estimateMinutes: 2,
  },
  {
    id: "voice-favorite-phrase",
    category: "voice",
    prompt:
      "What's the phrase they say so often the whole family teases them about it?",
    placeholder:
      "The one everyone can imitate. Where do they say it, and how does it sound?",
    estimateMinutes: 2,
  },
  {
    id: "voice-humor",
    category: "voice",
    prompt:
      "What makes them laugh until they can't breathe — and what kind of jokes do they tell?",
    placeholder:
      "Dry one-liners? Long stories with a terrible pun at the end? Teasing? Give an example if one comes to mind.",
    estimateMinutes: 2,
  },
  {
    id: "voice-never-says",
    category: "voice",
    prompt:
      "What would they never say? Words, phrases, or sentiments that just aren't them.",
    placeholder:
      "Maybe they never curse. Maybe they never say “I told you so.” Maybe “whatever” isn't in their vocabulary.",
    estimateMinutes: 2,
  },
  {
    id: "voice-comfort",
    category: "voice",
    prompt:
      "When someone they love is hurting, what do they say — or deliberately not say?",
    placeholder:
      "Some people fix. Some feed you. Some just sit with you. What do they do first?",
    estimateMinutes: 2,
  },

  // ── Values — what they'd fight for ────────────────────────────────────────
  {
    id: "values-fight-for",
    category: "values",
    prompt: "What would they drop everything to fight for?",
    placeholder:
      "A person, a principle, a place. What gets them out of their chair?",
    estimateMinutes: 2,
  },
  {
    id: "values-admire",
    category: "values",
    prompt:
      "Who do they admire most, and what does that tell you about them?",
    placeholder:
      "A parent, a saint, a coach, a neighbor. Why that person?",
    estimateMinutes: 2,
  },
  {
    id: "values-hard-rules",
    category: "values",
    prompt:
      "What are their hard rules — the lines they won't cross, no matter what?",
    placeholder:
      "“We don't lie to each other.” “Nobody eats alone.” “You finish what you start.”",
    estimateMinutes: 2,
  },
  {
    id: "values-dinner-table",
    category: "values",
    prompt:
      "What belief do they hold that they'll defend at the dinner table, even when everyone groans?",
    placeholder:
      "The opinion the family knows better than to bring up — or brings up on purpose.",
    estimateMinutes: 2,
  },
  {
    id: "values-keep-alive",
    category: "values",
    prompt:
      "If they could make sure the family kept just one value alive after them, what would it be?",
    placeholder:
      "Not the polite answer — the one they'd actually pick.",
    estimateMinutes: 2,
  },

  // ── Memories — the defining moments ───────────────────────────────────────
  {
    id: "memories-childhood",
    category: "memories",
    prompt:
      "Tell a story from their childhood that explains who they became.",
    placeholder:
      "The one they've told a hundred times, or the one they only told once.",
    estimateMinutes: 3,
  },
  {
    id: "memories-proudest",
    category: "memories",
    prompt:
      "What moment were they proudest of? Tell it the way they tell it.",
    placeholder:
      "Include the details they always include — the ones that make it theirs.",
    estimateMinutes: 3,
  },
  {
    id: "memories-regret",
    category: "memories",
    prompt:
      "What do they wish they'd done differently? It's okay if this one is hard.",
    placeholder:
      "You can be gentle with this. Even a sentence is enough.",
    estimateMinutes: 3,
  },
  {
    id: "memories-family-laugh",
    category: "memories",
    prompt:
      "What family story makes everyone laugh every single time it's retold?",
    placeholder:
      "The wrong turn, the burnt turkey, the thing they said at the wedding. Tell it whole.",
    estimateMinutes: 3,
  },
  {
    id: "memories-loss",
    category: "memories",
    prompt: "What loss shaped them, and how did they carry it?",
    placeholder:
      "Who or what they lost, and what changed in them afterward — quietly or loudly.",
    estimateMinutes: 3,
  },

  // ── Relationships — how they love ─────────────────────────────────────────
  {
    id: "relationships-show-love",
    category: "relationships",
    prompt: "How do they show love without ever saying the word?",
    placeholder:
      "Cut fruit on a plate. A full gas tank. Waiting up. What's their way?",
    estimateMinutes: 2,
  },
  {
    id: "relationships-apologize",
    category: "relationships",
    prompt:
      "How do they apologize — or how do you know they're sorry?",
    placeholder:
      "Some people say it straight. Some make your favorite dinner and never mention it again.",
    estimateMinutes: 2,
  },
  {
    id: "relationships-family-means",
    category: "relationships",
    prompt:
      "What does family mean to them? Not the dictionary answer — theirs.",
    placeholder:
      "Who counts as family to them? What do they think family owes each other?",
    estimateMinutes: 2,
  },
  {
    id: "relationships-forgiven",
    category: "relationships",
    prompt:
      "Who have they forgiven that took real work — and why did they do it?",
    placeholder:
      "If you don't know the whole story, tell the part you know.",
    estimateMinutes: 3,
  },
  {
    id: "relationships-proud-of-you",
    category: "relationships",
    prompt:
      "How can you tell when they're proud of someone? What do they do?",
    placeholder:
      "The look, the nod, the phone calls to everyone they know. How does it show?",
    estimateMinutes: 2,
  },

  // ── Quirks — the small true things ────────────────────────────────────────
  {
    id: "quirks-food",
    category: "quirks",
    prompt:
      "What's the meal they'd choose over any restaurant on earth — and who taught them to make it?",
    placeholder:
      "The dish, the way they make it, and the story behind it if there is one.",
    estimateMinutes: 2,
  },
  {
    id: "quirks-music",
    category: "quirks",
    prompt:
      "What music takes them somewhere else? What do they hum without noticing?",
    placeholder:
      "The artist they play on Sundays, the song they can't sit still through.",
    estimateMinutes: 2,
  },
  {
    id: "quirks-ritual",
    category: "quirks",
    prompt:
      "Walk through their comfort ritual — the coffee, the chair, the show, whatever it is.",
    placeholder:
      "The little routine they protect. Time of day, exact order, what happens if it's disturbed.",
    estimateMinutes: 2,
  },
  {
    id: "quirks-superstitions",
    category: "quirks",
    prompt:
      "Any superstitions, lucky things, or little rules that make no sense to anyone else?",
    placeholder:
      "Never open an umbrella indoors. Always knock twice. The lucky shirt for big games.",
    estimateMinutes: 2,
  },
  {
    id: "quirks-opinions",
    category: "quirks",
    prompt:
      "What are their strong, slightly unreasonable opinions? (The right way to load a dishwasher counts.)",
    placeholder:
      "The small hills they will absolutely die on.",
    estimateMinutes: 2,
  },

  // ── Wisdom — what they'd say ──────────────────────────────────────────────
  {
    id: "wisdom-scared-child",
    category: "wisdom",
    prompt:
      "What would they say to a child in the family who's scared on the first day of school?",
    placeholder:
      "Their words, their tone. Would they kneel down? Make a joke? Tell a story about themselves?",
    estimateMinutes: 2,
  },
  {
    id: "wisdom-leaving-home",
    category: "wisdom",
    prompt:
      "What advice would they give someone in the family leaving home for the first time?",
    placeholder:
      "The practical stuff and the real stuff. What would they slip into the goodbye hug?",
    estimateMinutes: 2,
  },
  {
    id: "wisdom-new-parent",
    category: "wisdom",
    prompt:
      "What would they tell someone holding their new baby at 3 a.m., completely overwhelmed?",
    placeholder:
      "What did they learn the hard way that they'd want to pass on gently?",
    estimateMinutes: 2,
  },
  {
    id: "wisdom-grief",
    category: "wisdom",
    prompt:
      "What would they say to someone they love who is grieving — maybe even grieving them?",
    placeholder:
      "Take your time with this one. Write what you believe they would truly say.",
    estimateMinutes: 3,
  },
  {
    id: "wisdom-younger-self",
    category: "wisdom",
    prompt:
      "If they could sit down with their twenty-year-old self, what would they say?",
    placeholder:
      "What would they warn them about? What would they tell them not to worry about?",
    estimateMinutes: 3,
  },

  // ── Sensory — the things that ARE them ────────────────────────────────────
  {
    id: "sensory-smell",
    category: "sensory",
    prompt: "What smell is them?",
    placeholder:
      "The kitchen on a Sunday, a particular cologne, sawdust, rain on a garden.",
    estimateMinutes: 2,
  },
  {
    id: "sensory-place",
    category: "sensory",
    prompt:
      "Close your eyes and picture them somewhere. Describe that place.",
    placeholder:
      "Where are they? What's around them? What are their hands doing?",
    estimateMinutes: 2,
  },
  {
    id: "sensory-sound",
    category: "sensory",
    prompt:
      "What sound brings them instantly to mind — a laugh, footsteps, a whistle?",
    placeholder:
      "The sound you'd know anywhere, even from another room.",
    estimateMinutes: 2,
  },
  {
    id: "sensory-taste",
    category: "sensory",
    prompt: "What taste will always belong to them?",
    placeholder:
      "The recipe nobody else gets right. The candy always in their pocket.",
    estimateMinutes: 2,
  },
  {
    id: "sensory-clothing",
    category: "sensory",
    prompt:
      "What do they wear that's so them you'd recognize it across a parking lot?",
    placeholder:
      "The hat, the cardigan, the boots by the door. Describe it like a photograph.",
    estimateMinutes: 2,
  },

  // ── Essay — the big ones ──────────────────────────────────────────────────
  {
    id: "essay-who-i-am",
    category: "essay",
    prompt:
      "The day they knew who they were. Tell that story with everything you know.",
    placeholder:
      "It might be a big day — a birth, a war, a diagnosis, a border crossed. It might be an ordinary Tuesday. Take the space you need.",
    estimateMinutes: 5,
  },
  {
    id: "essay-hardest-season",
    category: "essay",
    prompt:
      "The hardest season of their life — and how they came through it.",
    placeholder:
      "What broke, what held, and who they were on the other side of it.",
    estimateMinutes: 5,
  },
  {
    id: "essay-great-love",
    category: "essay",
    prompt:
      "Their great love story. Romantic or not — the person, place, or calling that got their whole heart.",
    placeholder:
      "How it started, what it cost, what it gave them. Tell it like they'd want it told.",
    estimateMinutes: 5,
  },
  {
    id: "essay-ordinary-day",
    category: "essay",
    prompt:
      "One perfectly ordinary day in their life, start to finish, in as much detail as you can.",
    placeholder:
      "What time they wake, what the radio plays, what they mutter at the news, how the day ends. The ordinary is where they live.",
    estimateMinutes: 5,
  },
  {
    id: "essay-letter",
    category: "essay",
    prompt:
      "If they wrote one letter for the family to open in fifty years, what would it need to say?",
    placeholder:
      "Not what a greeting card would say — what they would say. You can write it in their voice if that helps.",
    estimateMinutes: 5,
  },
];

/** Sanity constant used by the flow + server validation. */
export const LEGACY_QUESTION_COUNT = LEGACY_QUESTIONS.length; // 40
