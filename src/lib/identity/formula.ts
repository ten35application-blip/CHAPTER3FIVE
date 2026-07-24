/**
 * The chapter3five identity formula (VERBATIM from Wilson).
 *
 * The user does NOT pick from these lists — the server rolls one option
 * per category (or one/two for MBTI) plus intensity sliders, then hands
 * the trait bundle to Claude to synthesize a plausible person.
 *
 * Each list is exported as a `readonly` tuple so downstream code gets
 * literal-string types (e.g. `Gender = "Male" | "Female" | ...`).
 */

export const GENDERS = ["Male", "Female", "Prefer not to disclose"] as const;

export const HOROSCOPES = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;

export const SEXUAL_ORIENTATIONS = [
  "Heterosexual",
  "Homosexual",
  "Bisexual",
  "Pansexual",
  "Asexual",
  "Demisexual",
  "Questioning",
  "Prefer not to disclose",
] as const;

export const CULTURAL_BACKGROUNDS = [
  "African American",
  "Caribbean",
  "West African",
  "East African",
  "Mexican",
  "Puerto Rican",
  "Dominican",
  "Cuban",
  "South American",
  "Italian American",
  "Irish American",
  "German American",
  "Polish American",
  "Chinese",
  "Japanese",
  "Korean",
  "Filipino",
  "Vietnamese",
  "Indian",
  "Middle Eastern",
  "Native American",
  "Pacific Islander",
  "Eastern European",
  "Scandinavian",
  "Mixed heritage",
] as const;

export const MBTI_TYPES = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
] as const;

export const ENNEAGRAM = [
  "1 Reformer",
  "2 Helper",
  "3 Achiever",
  "4 Individualist",
  "5 Investigator",
  "6 Loyalist",
  "7 Enthusiast",
  "8 Challenger",
  "9 Peacemaker",
] as const;

export const TRAUMAS = [
  "Abandonment by a parent",
  "Loss of a parent (young)",
  "Loss of a sibling",
  "Loss of a child",
  "Loss of a spouse/partner",
  "Divorce of parents",
  "Own divorce",
  "Betrayal by best friend",
  "Infidelity (was cheated on)",
  "Childhood poverty",
  "Sudden financial ruin",
  "Homelessness",
  "Serious childhood illness",
  "Chronic illness",
  "Disabling accident",
  "War/combat experience",
  "Displacement/immigration hardship",
  "Severe bullying",
  "Public humiliation",
  "Emotional neglect",
  "Household addiction (grew up with)",
  "Own past addiction (recovered)",
  "Wrongful accusation",
  "Job loss/career collapse",
  "Natural disaster survivor",
  "Estrangement from family",
  "Caretaker burnout",
  "Miscarriage/infertility",
  "Survived a serious crime",
  "Near-death experience",
] as const;

export const TRAUMA_AGES = [
  "Childhood (0–12)",
  "Adolescence (13–19)",
  "Adulthood (20+)",
] as const;

export const ATTACHMENT_STYLES = [
  "Secure",
  "Anxious",
  "Avoidant",
  "Fearful-Avoidant",
] as const;

export const CORE_FEARS = [
  "Being abandoned",
  "Being forgotten",
  "Failure",
  "Being a burden",
  "Losing control",
  "Being unloved",
  "Poverty returning",
  "Death/dying alone",
  "Being ordinary",
  "Betrayal",
  "Confinement",
  "Public embarrassment",
  "Losing their mind",
  "Their children suffering",
  "Being truly seen",
  "Repeating their parents' mistakes",
  "Illness",
  "Conflict",
  "Change",
  "Being wrong",
] as const;

export const COPING_MECHANISMS = [
  "Humor/deflection",
  "Avoidance/shutting down",
  "Control/planning everything",
  "Caretaking others",
  "Overworking",
  "Faith/prayer",
  "Talking it out",
  "Physical activity",
  "Comfort eating",
  "Isolation until ready",
] as const;

export const MORAL_COMPASSES = [
  "Rule-follower",
  "Situational",
  "Loyalty-driven",
  "Compassion-driven",
  "Pragmatic",
  "Faith-guided",
] as const;

export const SIBLINGS = [
  "Only child",
  "Oldest of 2",
  "Youngest of 2",
  "Oldest of 3",
  "Middle of 3",
  "Youngest of 3",
  "Oldest of 4+",
  "Middle of 4+",
  "Youngest of 4+",
  "Twin",
  "Raised with cousins as siblings",
  "Half/step sibling blend",
] as const;

export const PARENT_RELATIONSHIPS = [
  "Close/warm",
  "Strained",
  "Absent",
  "Lost her early", // adjusted per-parent below
  "Complicated (love + conflict)",
] as const;

// Father variant swaps "her" → "him" for the "lost early" option.
export const FATHER_RELATIONSHIPS = [
  "Close/warm",
  "Strained",
  "Absent",
  "Lost him early",
  "Complicated (love + conflict)",
] as const;

export const RELATIONSHIP_HISTORIES = [
  "Married once (lasting)",
  "Married once (divorced)",
  "Married multiple times",
  "Widowed",
  "Lifelong single",
  "Long-term partner never married",
] as const;

export const PARENTHOODS = [
  "No children",
  "One child",
  "Multiple children",
  "Stepchildren/raised others' kids",
] as const;

export const COMMUNICATION_STYLES = [
  "Blunt/no filter",
  "Gentle/diplomatic",
  "Rambling storyteller",
  "Quiet/few words",
  "Teasing/playful",
  "Formal/proper",
  "Warm/affectionate",
  "Guarded/reveals slowly",
] as const;

export const HUMOR_STYLES = [
  "Dry/sarcastic",
  "Silly/goofy",
  "Dark humor",
  "Puns/dad jokes",
  "Observational",
  "Rarely jokes",
] as const;

export const LOVE_LANGUAGES = [
  "Words of affirmation",
  "Acts of service",
  "Gifts",
  "Quality time",
  "Physical touch",
] as const;

export const TEMPERS = [
  "Slow fuse (rarely angry, scary when so)",
  "Short fuse (quick, passes fast)",
  "Never shows anger",
  "Cold anger (silent treatment)",
] as const;

export const SPEECH_HABITS = [
  "Has catchphrases",
  "Long storyteller",
  "One-liner responder",
  "Interrupts when excited",
  "Deep listener/asks questions",
  "Changes subject when uncomfortable",
] as const;

export const OCCUPATIONS = [
  "Teacher/educator",
  "Nurse/healthcare",
  "Military/veteran",
  "Factory/trades",
  "Small business owner",
  "Office/administrative",
  "Farmer",
  "Cook/restaurant",
  "Driver/transportation",
  "Construction",
  "Clergy/ministry",
  "Artist/musician",
  "Homemaker",
  "Sales",
  "Law enforcement/firefighter",
  "Accountant/finance",
  "Engineer/technical",
  "Retail",
  "Domestic worker",
  "Entrepreneur",
] as const;

export const FAITH_LEVELS = [
  "Devout",
  "Faithful but private",
  "Spiritual not religious",
  "Lapsed/questioning",
  "Non-believer",
] as const;

export const DEFINING_LIFE_EVENTS = [
  "A great love story",
  "A big move/migration",
  "Building something from nothing",
  "Dramatic career change",
  "Overcoming illness",
  "Moment of unexpected courage",
  "Reinventing themselves late in life",
  "A lifelong friendship",
  "An act of forgiveness",
  "A dream deferred",
  "A secret kept for decades",
  "A moment of fame/recognition",
] as const;

export const VICES = [
  "Sweet tooth",
  "Small-stakes gambling",
  "Gossip",
  "Smoking (or quit)",
  "Evening drink",
  "Shopping/can't pass a deal",
  "TV/novelas/sports obsession",
  "Stubbornness",
  "White lies to keep peace",
  "Spoiling the grandkids",
] as const;

export const PASSIONS = [
  "Cooking/family recipes",
  "Gardening",
  "Playing music",
  "Collecting/listening to music",
  "Fishing/hunting",
  "Baseball/sports fan",
  "Dominoes/cards/chess",
  "Reading",
  "Dancing",
  "Sewing/crafts",
  "Cars/mechanics",
  "Church community",
  "Travel",
  "Photography",
  "Writing letters/journals",
] as const;

// ---------------- Derived types ----------------

export type Gender = (typeof GENDERS)[number];
export type Horoscope = (typeof HOROSCOPES)[number];
export type MBTI = (typeof MBTI_TYPES)[number];

export type Intensities = {
  trauma: number;
  fear: number;
  communication: number;
  humor: number;
  warmth: number;
  openness: number;
  stubbornness: number;
};

export type Traits = {
  gender: Gender;
  birthday: string; // ISO YYYY-MM-DD
  horoscope: Horoscope;
  sexualOrientation: (typeof SEXUAL_ORIENTATIONS)[number];
  cultural: (typeof CULTURAL_BACKGROUNDS)[number];
  mbti: MBTI[]; // 1 or 2 entries
  enneagram: (typeof ENNEAGRAM)[number];
  trauma: (typeof TRAUMAS)[number];
  traumaAge: (typeof TRAUMA_AGES)[number];
  attachment: (typeof ATTACHMENT_STYLES)[number];
  coreFear: (typeof CORE_FEARS)[number];
  coping: (typeof COPING_MECHANISMS)[number];
  moralCompass: (typeof MORAL_COMPASSES)[number];
  siblings: (typeof SIBLINGS)[number];
  mother: (typeof PARENT_RELATIONSHIPS)[number];
  father: (typeof FATHER_RELATIONSHIPS)[number];
  relationshipHistory: (typeof RELATIONSHIP_HISTORIES)[number];
  parenthood: (typeof PARENTHOODS)[number];
  communicationStyle: (typeof COMMUNICATION_STYLES)[number];
  humorStyle: (typeof HUMOR_STYLES)[number];
  loveLanguage: (typeof LOVE_LANGUAGES)[number];
  temper: (typeof TEMPERS)[number];
  speechHabit: (typeof SPEECH_HABITS)[number];
  occupation: (typeof OCCUPATIONS)[number];
  faithLevel: (typeof FAITH_LEVELS)[number];
  definingEvent: (typeof DEFINING_LIFE_EVENTS)[number];
  vice: (typeof VICES)[number];
  passion: (typeof PASSIONS)[number];
  intensities: Intensities;
};

// ---------------- Roller ----------------

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function pickInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function horoscopeFromDate(iso: string): Horoscope {
  const d = new Date(iso);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  // Standard Western zodiac cutoffs.
  if ((m === 3 && day >= 21) || (m === 4 && day <= 19)) return "Aries";
  if ((m === 4 && day >= 20) || (m === 5 && day <= 20)) return "Taurus";
  if ((m === 5 && day >= 21) || (m === 6 && day <= 20)) return "Gemini";
  if ((m === 6 && day >= 21) || (m === 7 && day <= 22)) return "Cancer";
  if ((m === 7 && day >= 23) || (m === 8 && day <= 22)) return "Leo";
  if ((m === 8 && day >= 23) || (m === 9 && day <= 22)) return "Virgo";
  if ((m === 9 && day >= 23) || (m === 10 && day <= 22)) return "Libra";
  if ((m === 10 && day >= 23) || (m === 11 && day <= 21)) return "Scorpio";
  if ((m === 11 && day >= 22) || (m === 12 && day <= 21)) return "Sagittarius";
  if ((m === 12 && day >= 22) || (m === 1 && day <= 19)) return "Capricorn";
  if ((m === 1 && day >= 20) || (m === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

function randomBirthday(): string {
  // Age 25–95 → born between 95 and 25 years ago from today.
  const now = new Date();
  const minYear = now.getUTCFullYear() - 95;
  const maxYear = now.getUTCFullYear() - 25;
  const year = minYear + pickInt(maxYear - minYear + 1);
  const month = 1 + pickInt(12);
  // Cap day at 28 to avoid Feb-29 / month-length edge cases; realism is fine.
  const day = 1 + pickInt(28);
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Roll a full trait bundle. Uniform sampling from each category, plus 7
 * intensity sliders (0-100). MBTI gets 1 or 2 types (30% chance of two).
 */
export function rollTraits(): Traits {
  const birthday = randomBirthday();
  const mbti: MBTI[] =
    Math.random() < 0.3
      ? [pick(MBTI_TYPES), pick(MBTI_TYPES)]
      : [pick(MBTI_TYPES)];

  return {
    gender: pick(GENDERS),
    birthday,
    horoscope: horoscopeFromDate(birthday),
    sexualOrientation: pick(SEXUAL_ORIENTATIONS),
    cultural: pick(CULTURAL_BACKGROUNDS),
    mbti,
    enneagram: pick(ENNEAGRAM),
    trauma: pick(TRAUMAS),
    traumaAge: pick(TRAUMA_AGES),
    attachment: pick(ATTACHMENT_STYLES),
    coreFear: pick(CORE_FEARS),
    coping: pick(COPING_MECHANISMS),
    moralCompass: pick(MORAL_COMPASSES),
    siblings: pick(SIBLINGS),
    mother: pick(PARENT_RELATIONSHIPS),
    father: pick(FATHER_RELATIONSHIPS),
    relationshipHistory: pick(RELATIONSHIP_HISTORIES),
    parenthood: pick(PARENTHOODS),
    communicationStyle: pick(COMMUNICATION_STYLES),
    humorStyle: pick(HUMOR_STYLES),
    loveLanguage: pick(LOVE_LANGUAGES),
    temper: pick(TEMPERS),
    speechHabit: pick(SPEECH_HABITS),
    occupation: pick(OCCUPATIONS),
    faithLevel: pick(FAITH_LEVELS),
    definingEvent: pick(DEFINING_LIFE_EVENTS),
    vice: pick(VICES),
    passion: pick(PASSIONS),
    intensities: {
      trauma: pickInt(101),
      fear: pickInt(101),
      communication: pickInt(101),
      humor: pickInt(101),
      warmth: pickInt(101),
      openness: pickInt(101),
      stubbornness: pickInt(101),
    },
  };
}

/**
 * Derive rough age from birthday for prompt context.
 */
export function ageFromBirthday(iso: string): number {
  const then = new Date(iso);
  const now = new Date();
  let age = now.getUTCFullYear() - then.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - then.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getUTCDate() < then.getUTCDate())
  ) {
    age--;
  }
  return age;
}
