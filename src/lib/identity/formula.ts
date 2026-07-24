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

// ---------------- Formula v2: humanlike expansion ----------------
//
// Everything below was added to make each identity feel like a specific
// human being rather than a personality-test printout: what they listen
// to, what they watch, how they laugh, what they carry in their pocket,
// who they've lost. Rolled uniformly like everything above.
//
// DELIBERATE OMISSION: no politicalStance category. Political opinions
// are both divisive and legal exposure for a companion product — an
// identity that argues politics with a user is a lawsuit waiting to
// happen. Politics is also explicitly walled off in the synthesizer's
// safety block.

export const FAVORITE_MUSIC_GENRES = [
  "Motown and classic soul",
  "90s hip-hop",
  "Indie rock",
  "Salsa",
  "Gospel",
  "Classic country",
  "EDM",
  "Jazz standards",
  "K-pop",
  "Reggaeton",
  "Folk",
  "Punk",
  "R&B",
  "Classical",
  "Bachata",
  "Alt-rock",
  "Bluegrass",
  "Ambient/instrumental",
  "Metal",
  "Worship music",
  "Oldies radio (50s-60s)",
  "Merengue",
] as const;

// NOTE: There is deliberately NO favoriteArtist list here. We let Claude
// pick a real artist during synthesis instead of rolling one, because a
// uniform roll over a fixed artist list produces incoherent humans — an
// 87-year-old Vietnamese grandmother who stans Bad Bunny reads as a bug,
// not a person. Claude derives the artist from genre + era + cultural
// background + age, which is exactly how real taste forms, so the pick
// lands as "of course she loves Celia Cruz" instead of a random name.
// The synthesizer prompt requires the artist to be real and era-consistent.

export const FAVORITE_SHOWS = [
  "The Wire",
  "Grey's Anatomy",
  "The Sopranos",
  "Bluey (watches with the kids)",
  "Ted Lasso",
  "Succession",
  "The Golden Girls",
  "Friday Night Lights",
  "Breaking Bad",
  "Insecure",
  "Modern Family",
  "Bridgerton",
  "Seinfeld",
  "The Real Housewives (any city)",
  "Yellowstone",
  "I Love Lucy reruns",
  "Jeopardy! (never misses it)",
  "60 Minutes",
  "Law & Order (the original)",
  "Abbott Elementary",
  "The Office (rewatched many times)",
  "Telenovelas (keeps up with the current one)",
  "Korean dramas",
  "The Great British Bake Off",
  "Antiques Roadshow",
  "Survivor (day-one fan)",
  "M*A*S*H",
] as const;

export const FAVORITE_MOVIES = [
  "The Godfather",
  "Coco",
  "Steel Magnolias",
  "Die Hard (insists it's a Christmas movie)",
  "The Shawshank Redemption",
  "My Big Fat Greek Wedding",
  "Rocky",
  "The Notebook",
  "Coming to America",
  "Selena",
  "It's a Wonderful Life",
  "Jurassic Park",
  "The Sound of Music",
  "Friday",
  "Crouching Tiger, Hidden Dragon",
  "Forrest Gump",
  "Grease",
  "Black Panther",
  "The Princess Bride",
  "Titanic (cries every time)",
  "Casablanca",
  "Home Alone",
  "Moonstruck",
  "The Color Purple",
  "Field of Dreams",
  "Spirited Away",
  "A League of Their Own",
] as const;

export const FAVORITE_FOODS = [
  "Grandma's arroz con pollo",
  "Cold pizza at 2am",
  "A ribeye, rare",
  "Thai green curry",
  "Homemade lasagna (their own recipe)",
  "Cheerios with peanut butter (don't judge)",
  "Oxtail with rice and peas",
  "Pho from the little place nobody knows about",
  "Fried catfish and hushpuppies",
  "Tamales (Christmas only, that's the rule)",
  "A proper diner breakfast",
  "Mom's pot roast",
  "Street tacos, al pastor",
  "Biscuits and gravy",
  "Homemade pierogi",
  "Jollof rice",
  "Chicken adobo",
  "Matzo ball soup",
  "Gumbo made the slow way",
  "A tomato sandwich in August",
  "Kimchi jjigae",
  "Pastelón",
  "Barbecue brisket, no sauce needed",
] as const;

export const COMFORT_DRINKS = [
  "Drip coffee, black, no sugar",
  "A cold Modelo",
  "Sweet tea",
  "Matcha latte",
  "Whiskey, neat",
  "Cherry Coke",
  "Chamomile tea at midnight",
  "Café con leche",
  "Diet Coke over crushed ice",
  "A glass of red with dinner",
  "Hot chocolate, extra marshmallows",
  "Arnold Palmer",
  "Cafecito after dinner",
  "Ginger ale (swears it fixes everything)",
] as const;

export const WEEKEND_ACTIVITIES = [
  "Long hikes",
  "Gardening",
  "A favorite dive bar",
  "Video games",
  "Church potlucks",
  "Museum wandering",
  "Live music",
  "Road trips with no destination",
  "Restoring an old car",
  "Watching sports with friends",
  "Quiet reading",
  "Karaoke",
  "Poker night",
  "Yard sales and flea markets",
  "Cooking a big Sunday meal",
  "Fishing before sunrise",
  "Farmers market then a long nap",
  "Volunteering at the shelter",
] as const;

export const HOBBIES = [
  "Photography",
  "Running",
  "Chess",
  "Woodworking",
  "Cooking elaborate meals",
  "Journaling",
  "Birdwatching",
  "Cross-stitch",
  "Guitar",
  "Salsa dancing",
  "Urban sketching",
  "Tabletop RPGs",
  "Video editing",
  "Model trains",
  "Thrifting",
  "Baking bread",
  "Crossword puzzles in pen",
  "Genealogy (the family tree is a whole project)",
] as const;

export const SPORTS = [
  "Doesn't follow sports (and doesn't pretend to)",
  "Baseball — loyal to one team through everything",
  "Football — Sundays are sacred",
  "Basketball — never misses playoffs",
  "Soccer/fútbol — the real football, they'll tell you",
  "Boxing — old school fan",
  "College football over the pros, always",
  "Tennis — plays a little too",
  "Golf — watching AND playing",
  "NASCAR",
  "Hockey — the loud kind of fan",
  "Follows whatever their kid plays, fiercely",
  "Olympics every couple years, that's it",
] as const;

export const DAILY_RITUALS = [
  "Morning coffee and the crossword",
  "A 5am run, rain or shine",
  "Calls mom every Sunday",
  "Evening walk with the dog",
  "Journals before bed",
  "Prays first thing, before feet hit the floor",
  "News with breakfast, always the same channel",
  "Waters the plants and talks to them",
  "A cigarette on the porch at dusk (trying to quit)",
  "Tea and ten quiet minutes before anyone wakes up",
  "Checks the lottery numbers (never wins, keeps playing)",
  "Stretches while the coffee brews",
] as const;

export const LAUGHS = [
  "A big belly-laugh you can hear across the room",
  "Silent shoulder-shake, tears and everything",
  "One quick sharp 'HA'",
  "Snorts when it's really funny, hates that they do",
  "A contagious cackle",
  "Dry chuckle, barely audible",
  "Wheezes like the joke is killing them",
  "Claps once when something lands",
  "Covers their mouth, laughs with their eyes",
  "Slaps the table (or your arm)",
  "Giggles that don't match how tough they look",
] as const;

export const STYLE_AESTHETICS = [
  "Jeans and a good t-shirt",
  "Sundresses and denim jackets",
  "All-black everything",
  "Business casual but with sneakers",
  "Thrifted vintage",
  "Athleisure head to toe",
  "Buttoned-up preppy",
  "Boho, layered, lots of rings",
  "Workwear — boots, canvas, function first",
  "Minimalist neutrals",
  "Sunday best even on Tuesday",
  "Team gear year-round",
  "Cardigans and reading glasses on a chain",
  "Loud shirts, no apologies",
] as const;

export const MANNERISMS = [
  "Talks with their hands",
  "Chews on pen caps",
  "Plays with their necklace",
  "Cracks knuckles when nervous",
  "Always tapping a foot",
  "Tucks hair behind ear mid-thought",
  "Rubs the back of their neck when unsure",
  "Points at you when making a point",
  "Hums without noticing",
  "Adjusts glasses before saying something serious",
  "Closes eyes when remembering",
  "Whistles old songs under their breath",
] as const;

export const SIGNATURE_ITEMS = [
  "A worn leather journal",
  "Grandma's ring, never taken off",
  "A faded Nirvana tote bag",
  "A beat-up Yeti mug",
  "Reading glasses pushed up on their head",
  "A pocket knife from their father",
  "Rosary beads in the car",
  "The same Casio watch for twenty years",
  "A lucky two-dollar bill in the wallet",
  "A Zippo they keep even though they quit",
  "One good pen they'll notice if you take",
  "A crumpled photo behind the phone case",
  "A St. Christopher medal",
  "Hand lotion in every bag and drawer",
  "Keys on a carabiner, way too many keys",
  "A handkerchief, ironed",
] as const;

export const HEIGHT_RANGES = [
  "Petite (under 5'4\")",
  "Average (5'4\"–5'9\")",
  "Tall (5'10\"+)",
] as const;

export const HOME_TYPES = [
  "Studio apartment",
  "One-bedroom apartment",
  "Multi-bedroom apartment",
  "A house they own (mostly the bank owns)",
  "A house that's been in the family",
  "Rural — land, quiet, long driveway",
  "College dorm was the last real move, now a rental",
  "Living with family for now",
] as const;

export const LIVING_SITUATIONS = [
  "Lives alone and likes it",
  "Lives alone, still getting used to it",
  "With a partner",
  "With roommates",
  "With the kids",
  "With their parents",
  "Multi-generational household — three generations, one kitchen",
] as const;

export const PETS = [
  "No pets (allergies, or just not a pet person)",
  "An old lab mix who runs the house",
  "A little dog with a big attitude",
  "A rescue mutt, very anxious, very loved",
  "A cat named after a food",
  "A cat with a dignified human name",
  "Two cats who hate each other",
  "A loud parakeet",
  "An iguana, long story",
  "A tank of fish they talk to",
  "Chickens out back",
  "Grand-dog they babysit constantly",
] as const;

export const CLASS_BACKGROUNDS = [
  "Grew up broke — remembers the electricity getting cut",
  "Working class — everyone in the house worked",
  "Comfortable — never rich, never worried",
  "Upper-middle — piano lessons and summer camps",
  "Wealthy — and complicated about it",
] as const;

// NOTE: politicalStance intentionally omitted — see comment at the top of
// this section.

export const REGIONAL_ACCENTS = [
  "NY tri-state — fast, no patience for small talk",
  "Deep South drawl, unhurried",
  "Chicago — 'gym shoes' and 'the Bears'",
  "Boston — drops the R and knows it",
  "Midwest neutral, 'ope, let me sneak past ya'",
  "Pacific Northwest soft",
  "Valley inflection, ends sentences up",
  "Miami — Spanglish flows without thinking",
  "Texas twang",
  "British RP, softened by years in the States",
  "Nigerian-accented English, precise and musical",
  "Boricua — Spanish and English in the same sentence",
  "Chicano English, East LA",
  "First-gen — faint echo of their parents' accent on certain words",
  "Appalachian — old words nobody else uses anymore",
  "Minnesota nice, long O's",
] as const;

export const RECENT_JOYS = [
  "A good long hug from their kid",
  "Finally beating that video game boss",
  "A slow Sunday with nowhere to be",
  "A text from an old friend out of nowhere",
  "Seeing a hummingbird at the feeder",
  "The first tomato off the vine",
  "Their team actually winning for once",
  "A song on the radio they hadn't heard in years",
  "Someone remembered their coffee order",
  "The grandkids called just to talk",
  "Paid off a debt that had been sitting there for years",
  "A stranger's dog picked them to say hi to",
] as const;

export const CURRENT_WORRIES = [
  "Money — the math just barely works",
  "An aging parent who won't ask for help",
  "A kid who's struggling and won't talk about it",
  "A career pivot that might be a mistake",
  "A health checkup they keep rescheduling",
  "Loneliness they wouldn't call loneliness",
  "Feeling stuck while everyone else moves on",
  "The house needs repairs they can't afford yet",
  "A friendship that's quietly fading",
  "Whether they're doing enough for the people they love",
  "Sleep — it just doesn't come like it used to",
  "Forgetting things more than they'd like",
] as const;

export const CRY_TRIGGERS = [
  "Kindness from strangers",
  "Animals in commercials, every time",
  "Weddings — anyone's, even on TV",
  "Their kid singing",
  "The national anthem at a ballgame",
  "Missing someone at the exact wrong moment",
  "Old photographs found in a drawer",
  "When someone says 'I'm proud of you'",
  "Military homecoming videos",
  "The end of certain movies, they know which ones",
  "A song their mother used to sing",
  "Watching someone else cry — it just jumps",
] as const;

export const DEAD_RELATIVES = [
  "No immediate loss (knock on wood, they'd say)",
  "Grandma — still cooks her recipes",
  "Grandpa — still hears his sayings",
  "Their mother",
  "Their father",
  "A sibling",
  "An aunt or uncle who was like a parent",
  "A best friend who was family",
  "A grandparent they never got enough time with",
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
  // --- Formula v2: humanlike expansion ---
  favoriteMusicGenre: (typeof FAVORITE_MUSIC_GENRES)[number];
  favoriteShow: (typeof FAVORITE_SHOWS)[number];
  favoriteMovie: (typeof FAVORITE_MOVIES)[number];
  favoriteFood: (typeof FAVORITE_FOODS)[number];
  comfortDrink: (typeof COMFORT_DRINKS)[number];
  weekendActivity: (typeof WEEKEND_ACTIVITIES)[number];
  hobby: (typeof HOBBIES)[number];
  sport: (typeof SPORTS)[number];
  dailyRitual: (typeof DAILY_RITUALS)[number];
  laugh: (typeof LAUGHS)[number];
  styleAesthetic: (typeof STYLE_AESTHETICS)[number];
  mannerism: (typeof MANNERISMS)[number];
  signatureItem: (typeof SIGNATURE_ITEMS)[number];
  heightRange: (typeof HEIGHT_RANGES)[number];
  homeType: (typeof HOME_TYPES)[number];
  livingSituation: (typeof LIVING_SITUATIONS)[number];
  pet: (typeof PETS)[number];
  classBackground: (typeof CLASS_BACKGROUNDS)[number];
  regionalAccent: (typeof REGIONAL_ACCENTS)[number];
  mostRecentJoy: (typeof RECENT_JOYS)[number];
  currentWorry: (typeof CURRENT_WORRIES)[number];
  whatMakesThemCry: (typeof CRY_TRIGGERS)[number];
  deadRelative: (typeof DEAD_RELATIVES)[number];
  /**
   * Years since the loss in `deadRelative`. 0 when there is no immediate
   * loss. Grief at 2 years and grief at 30 years are different textures —
   * this number gives the synthesizer that texture.
   */
  deadRelativeYearsSince: number;
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

  // Grief texture: 0 when no loss; otherwise 1–40 years since. The loss
  // is capped to have plausibly happened within the persona's adult life
  // by the synthesizer, which reconciles it with age.
  const deadRelative = pick(DEAD_RELATIVES);
  const deadRelativeYearsSince = deadRelative.startsWith("No immediate loss")
    ? 0
    : 1 + pickInt(40);

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
    favoriteMusicGenre: pick(FAVORITE_MUSIC_GENRES),
    favoriteShow: pick(FAVORITE_SHOWS),
    favoriteMovie: pick(FAVORITE_MOVIES),
    favoriteFood: pick(FAVORITE_FOODS),
    comfortDrink: pick(COMFORT_DRINKS),
    weekendActivity: pick(WEEKEND_ACTIVITIES),
    hobby: pick(HOBBIES),
    sport: pick(SPORTS),
    dailyRitual: pick(DAILY_RITUALS),
    laugh: pick(LAUGHS),
    styleAesthetic: pick(STYLE_AESTHETICS),
    mannerism: pick(MANNERISMS),
    signatureItem: pick(SIGNATURE_ITEMS),
    heightRange: pick(HEIGHT_RANGES),
    homeType: pick(HOME_TYPES),
    livingSituation: pick(LIVING_SITUATIONS),
    pet: pick(PETS),
    classBackground: pick(CLASS_BACKGROUNDS),
    regionalAccent: pick(REGIONAL_ACCENTS),
    mostRecentJoy: pick(RECENT_JOYS),
    currentWorry: pick(CURRENT_WORRIES),
    whatMakesThemCry: pick(CRY_TRIGGERS),
    deadRelative,
    deadRelativeYearsSince,
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
