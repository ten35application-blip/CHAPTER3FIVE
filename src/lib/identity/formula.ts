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

// ---------------- Formula v3: place ----------------
//
// ONE bundled Place object per identity — never independent state/city/zip
// rolls, which would produce "Miami, MT 55432" nonsense. US-centric (all 50
// states at least once, plus DC and Puerto Rico), roughly 80/20 urban-metro
// to rural to match real population distribution. Big cities get
// NEIGHBORHOOD entries because "New York" isn't a place but "Astoria" is.
// Non-US origin cities are deliberately NOT here: someone can be Nigerian
// by heritage and Bushwick by ZIP — heritage lives in CULTURAL_BACKGROUNDS,
// location lives here.
//
// The zip is decorative texture in the persona_prompt, not GIS — every zip
// below is a real one inside (or squarely associated with) the named place.

export type Place = {
  state: string; // e.g., "Illinois"
  stateAbbrev: string; // e.g., "IL"
  city: string; // "Peoria" or "Bushwick, Brooklyn"
  zip: string; // one real 5-digit zip inside the city
  region: string; // short human phrase: "River town Midwest"
  climate: string; // "hot summers, real winters"
  landmarks: string[]; // 2-4 specifics: "the Riverfront"
  localFoodTouchstone: string; // "the church potluck circuit"
  vibe: string; // one honest sentence
  urbanness: "urban" | "suburban" | "rural";
};

export const PLACES: readonly Place[] = [
  // ---- New York City (15) ----
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Bushwick, Brooklyn",
    zip: "11221",
    region: "North Brooklyn, gentrifying block by block",
    climate: "four real seasons, summer subway platforms like ovens",
    landmarks: [
      "the Jefferson St L stop",
      "Maria Hernandez Park",
      "the murals off Troutman",
    ],
    localFoodTouchstone:
      "dollar-slice counters and new wine bars pretending they were always here",
    vibe:
      "Puerto Rican flags and warehouse lofts on the same block, and everyone's rent went up.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Astoria, Queens",
    zip: "11106",
    region: "Western Queens, under the N train",
    climate: "humid summers, gray slush winters",
    landmarks: [
      "Astoria Park under the Hell Gate Bridge",
      "Steinway Street",
      "the elevated N/W tracks",
    ],
    localFoodTouchstone:
      "Greek diners, Egyptian cafes on Steinway, halal carts that know your order",
    vibe:
      "Half the world lives here and everyone still calls it the neighborhood.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Bed-Stuy, Brooklyn",
    zip: "11216",
    region: "Central Brooklyn brownstone belt",
    climate: "four seasons, stoop weather from April to October",
    landmarks: [
      "brownstone stoops on Hancock Street",
      "Herbert Von King Park",
      "Fulton Street",
    ],
    localFoodTouchstone:
      "Sunday-after-church soul food and Caribbean bakeries with hot beef patties",
    vibe:
      "Brownstones that held Black families for generations, now holding their breath.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Washington Heights, Manhattan",
    zip: "10032",
    region: "Uptown Manhattan, top of the island",
    climate: "four seasons, fire hydrants open in July",
    landmarks: [
      "the George Washington Bridge",
      "Highbridge Park",
      "the 181st Street A stop",
      "the United Palace",
    ],
    localFoodTouchstone: "chimis at 2am and mangú for breakfast",
    vibe:
      "The Dominican Republic's sixth borough — dominoes on folding tables in July, bachata out of every window.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Bay Ridge, Brooklyn",
    zip: "11209",
    region: "South Brooklyn, end of the R line",
    climate: "four seasons, harbor wind off the Narrows",
    landmarks: [
      "the Verrazzano Bridge",
      "the Shore Road promenade",
      "86th Street",
    ],
    localFoodTouchstone:
      "old-school red-sauce Italian next to some of the best Middle Eastern food in the city",
    vibe:
      "Old Brooklyn — cops, teachers, and grandmothers who never left, with the bridge hanging over everything.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Riverdale, the Bronx",
    zip: "10471",
    region: "Leafy northwest Bronx",
    climate: "four seasons, cooler than Manhattan by a degree or two",
    landmarks: [
      "Van Cortlandt Park",
      "Wave Hill gardens",
      "the last stop on the 1 train",
    ],
    localFoodTouchstone:
      "kosher delis and diner breakfasts that haven't changed since 1985",
    vibe:
      "The leafy corner of the Bronx that has to keep explaining it's still the Bronx.",
    urbanness: "suburban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Harlem, Manhattan",
    zip: "10027",
    region: "Uptown Manhattan, the capital of Black America",
    climate: "four seasons, brownstone shade in summer",
    landmarks: [
      "the Apollo",
      "125th Street",
      "Marcus Garvey Park",
      "Strivers' Row",
    ],
    localFoodTouchstone:
      "chicken and waffles, Senegalese spots on 116th, church-basement repasts",
    vibe: "The capital of Black America, gentrifying but not surrendering.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Jackson Heights, Queens",
    zip: "11372",
    region: "Central Queens under the 7 train",
    climate: "humid summers, slush-gray winters",
    landmarks: [
      "Roosevelt Avenue under the 7",
      "Travers Park",
      "the sari shops on 74th Street",
    ],
    localFoodTouchstone:
      "momos, arepas, samosas, and tacos within one block of the 7 train",
    vibe:
      "The most languages per square mile on the planet, and it mostly works.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Woodside, Queens",
    zip: "11377",
    region: "Working Queens on the 7 line",
    climate: "four seasons, airplane noise in all of them",
    landmarks: [
      "Roosevelt Avenue",
      "the 61st Street 7 stop",
      "Doughboy Plaza",
    ],
    localFoodTouchstone:
      "Filipino bakeries, Irish pubs, and Thai spots sharing the same block",
    vibe:
      "Little Manila plus the last old Irish bars in Queens, everybody working two jobs.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Flushing, Queens",
    zip: "11355",
    region: "Eastern Queens, end of the 7",
    climate: "humid summers, wind-tunnel winters on Main Street",
    landmarks: [
      "Main Street",
      "Flushing Meadows and the Unisphere",
      "the last stop on the 7",
    ],
    localFoodTouchstone:
      "hand-pulled noodles, dumpling basements, the food court under the New World Mall",
    vibe:
      "A Chinese-speaking downtown busier than most American cities, no tourists.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Crown Heights, Brooklyn",
    zip: "11213",
    region: "Central Brooklyn, West Indian heartland",
    climate: "four seasons, Eastern Parkway shade in August",
    landmarks: [
      "Eastern Parkway",
      "Franklin Avenue",
      "the Brooklyn Museum a short walk off",
    ],
    localFoodTouchstone:
      "jerk smoke on Nostrand, roti shops, J'ouvert before dawn on Labor Day",
    vibe:
      "West Indian Brooklyn — carnival every September, and the parkway is a front porch.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Sunset Park, Brooklyn",
    zip: "11220",
    region: "South Brooklyn harbor slope",
    climate: "four seasons, harbor wind up the hill",
    landmarks: [
      "the park with the harbor view",
      "8th Avenue's Chinatown",
      "Industry City",
    ],
    localFoodTouchstone: "taquerias on 5th Avenue, dim sum on 8th",
    vibe:
      "Mexican and Chinese Brooklyn back-to-back, with the best skyline view in the city from the lawn.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "St. George, Staten Island",
    zip: "10301",
    region: "North Shore, ferry-side Staten Island",
    climate: "four seasons, harbor fog horns",
    landmarks: [
      "the ferry terminal",
      "the ballpark by the harbor",
      "Victory Boulevard's hill",
    ],
    localFoodTouchstone:
      "Sri Lankan lunch counters nobody on the mainland knows about",
    vibe: "The forgotten borough's front door — half commuter town, half secret.",
    urbanness: "suburban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Lower East Side, Manhattan",
    zip: "10002",
    region: "Downtown Manhattan, tenement country",
    climate: "four seasons, trash-and-jasmine summer nights",
    landmarks: [
      "Delancey Street",
      "the Williamsburg Bridge ramps",
      "Seward Park",
      "Essex Market",
    ],
    localFoodTouchstone:
      "pickles and bialys from the old world, dumplings from the new one",
    vibe:
      "Tenement ghosts under the nightlife — everybody's grandparents started here.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Mott Haven, the Bronx",
    zip: "10454",
    region: "South Bronx",
    climate: "four seasons, asphalt-oven Augusts",
    landmarks: [
      "the Bruckner Expressway overhead",
      "St. Mary's Park",
      "the Third Avenue Bridge",
    ],
    localFoodTouchstone: "cuchifritos counters and piragua carts all summer",
    vibe:
      "The South Bronx that built hip-hop, tired of being anybody's metaphor.",
    urbanness: "urban",
  },

  // ---- Los Angeles area (10) ----
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Boyle Heights, Los Angeles",
    zip: "90033",
    region: "Eastside LA",
    climate: "sunny and dry, June gloom mornings",
    landmarks: [
      "Mariachi Plaza",
      "the 6th Street Bridge",
      "Evergreen Cemetery's jogging path",
    ],
    localFoodTouchstone: "the taco stands on Cesar Chavez, birria on weekends",
    vibe:
      "Mexican LA's front room, fighting gentrification building by building.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Silver Lake, Los Angeles",
    zip: "90026",
    region: "East-of-Hollywood hillside LA",
    climate: "sunny, dry, jacaranda springs",
    landmarks: ["the reservoir loop", "Sunset Junction", "the stairways"],
    localFoodTouchstone:
      "third-wave coffee and the last old taco trucks holding their corners",
    vibe: "Where the band guys became dads and kept the vinyl.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Inglewood",
    zip: "90301",
    region: "South LA legacy city",
    climate: "sunny, ocean breeze by afternoon",
    landmarks: ["SoFi Stadium", "the Forum", "Market Street"],
    localFoodTouchstone:
      "Sunday-after-church soul food lines and Randy's Donuts on the way home",
    vibe:
      "Black LA legacy city with a stadium dropped on it — pride and property taxes both rising.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "East Los Angeles",
    zip: "90022",
    region: "Unincorporated Eastside",
    climate: "hot dry summers, mild winters",
    landmarks: [
      "Whittier Boulevard",
      "Atlantic Park",
      "the murals everywhere you look",
    ],
    localFoodTouchstone:
      "tamales at Christmas from the neighbor who sells out by noon",
    vibe:
      "Unincorporated and unbothered — three generations on one block, lowriders on Sundays.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Long Beach",
    zip: "90802",
    region: "Harbor city, LA County's southern edge",
    climate: "marine layer mornings, mild all year",
    landmarks: [
      "the port cranes",
      "Shoreline Village",
      "Cambodia Town on Anaheim Street",
    ],
    localFoodTouchstone: "Cambodian noodle shops and fish tacos",
    vibe: "A port town that's its own city, not an LA suburb, and will correct you.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Pasadena",
    zip: "91104",
    region: "San Gabriel Valley foothills",
    climate: "hotter than LA proper, mountain views when the smog lifts",
    landmarks: [
      "the Rose Bowl",
      "Old Town",
      "the San Gabriels at the end of every street",
    ],
    localFoodTouchstone:
      "old-school burger stands and dim sum one freeway exit away",
    vibe:
      "Craftsman houses and rocket scientists, mountains at the end of every street.",
    urbanness: "suburban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Van Nuys",
    zip: "91405",
    region: "The San Fernando Valley, middle of it",
    climate: "ten degrees hotter than the city, every day",
    landmarks: [
      "Van Nuys Boulevard",
      "the 405",
      "the Sepulveda Basin",
    ],
    localFoodTouchstone:
      "pupusas and pho in the same strip mall — the best strip malls in America",
    vibe: "The Valley without the glamour — hot, flat, working, honest.",
    urbanness: "suburban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Compton",
    zip: "90220",
    region: "South LA hub city",
    climate: "sunny, dry, mild winters",
    landmarks: [
      "the Compton Courthouse",
      "Wilson Park",
      "the Richland Farms horse stables",
    ],
    localFoodTouchstone: "backyard barbecue culture and mariscos trucks",
    vibe:
      "Heavier in myth than in life — block clubs, backyard horses, people who stayed on purpose.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Highland Park, Los Angeles",
    zip: "90042",
    region: "Northeast LA",
    climate: "dry heat, cool canyon evenings",
    landmarks: ["York Boulevard", "Figueroa Street", "the Arroyo Seco"],
    localFoodTouchstone:
      "old taquerias and new coffee, side by side, uneasily",
    vibe:
      "Northeast LA where the abuelitas and the vintage shops share the sidewalk.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Koreatown, Los Angeles",
    zip: "90005",
    region: "Mid-Wilshire, densest LA",
    climate: "sunny, dry, warm nights",
    landmarks: [
      "Wilshire's old deco towers",
      "the 24-hour spas",
      "Normandie and 6th",
    ],
    localFoodTouchstone:
      "Korean barbecue smoke, late-night naengmyeon, the best strip-mall dining anywhere",
    vibe:
      "The densest neighborhood west of Manhattan — everything open at 2am, everyone from somewhere.",
    urbanness: "urban",
  },

  // ---- Chicago (5) ----
  {
    state: "Illinois",
    stateAbbrev: "IL",
    city: "Chatham, Chicago",
    zip: "60619",
    region: "South Side Chicago",
    climate: "lake-effect winters that mean it, humid summers",
    landmarks: ["79th Street", "the Dan Ryan", "Cole Park"],
    localFoodTouchstone: "Harold's Chicken with mild sauce on everything",
    vibe:
      "Black middle-class Chicago's proud heart — lawns kept, opinions strong.",
    urbanness: "urban",
  },
  {
    state: "Illinois",
    stateAbbrev: "IL",
    city: "Pilsen, Chicago",
    zip: "60608",
    region: "Lower West Side Chicago",
    climate: "lake winters, humid summers",
    landmarks: [
      "the 18th Street murals",
      "the National Museum of Mexican Art",
      "the Pink Line",
    ],
    localFoodTouchstone: "carnitas on Sundays, elote carts all summer",
    vibe: "Mexican Chicago with art on every wall, watching the rents.",
    urbanness: "urban",
  },
  {
    state: "Illinois",
    stateAbbrev: "IL",
    city: "West Loop, Chicago",
    zip: "60607",
    region: "Near West Side Chicago",
    climate: "wind-tunnel winters, rooftop summers",
    landmarks: [
      "Randolph Street's restaurant row",
      "the old meatpacking docks",
      "Union Park",
    ],
    localFoodTouchstone: "tasting menus where the pork used to hang",
    vibe: "Cranes and small plates — the neighborhood LinkedIn built.",
    urbanness: "urban",
  },
  {
    state: "Illinois",
    stateAbbrev: "IL",
    city: "Lincoln Park, Chicago",
    zip: "60614",
    region: "North Side lakefront Chicago",
    climate: "lake breeze summers, brutal January wind",
    landmarks: ["the free zoo", "the lakefront trail", "DePaul's campus"],
    localFoodTouchstone:
      "brunch lines and the old hot dog stands that outlasted everything",
    vibe:
      "Leafy, moneyed, strollers everywhere — the Chicago people picture from movies.",
    urbanness: "urban",
  },
  {
    state: "Illinois",
    stateAbbrev: "IL",
    city: "Bridgeport, Chicago",
    zip: "60609",
    region: "South Side Chicago, old machine ward",
    climate: "gray winters, humid summers",
    landmarks: [
      "Sox Park — nobody calls it by the sponsor name",
      "Halsted Street",
      "the Ramova Theatre",
    ],
    localFoodTouchstone:
      "Italian beef dripped over the sink, bakery paczki in February",
    vibe:
      "Old machine-politics neighborhood turned quietly multiethnic, still Sox territory.",
    urbanness: "urban",
  },

  // ---- Miami-Dade (5) ----
  {
    state: "Florida",
    stateAbbrev: "FL",
    city: "Little Havana, Miami",
    zip: "33135",
    region: "Core Miami, west of downtown",
    climate: "hot and humid ten months, hurricane season is a personality",
    landmarks: ["Calle Ocho", "Domino Park", "the Tower Theater"],
    localFoodTouchstone:
      "cafecito ventanitas on every block, pastelitos before work",
    vibe:
      "Cuban exile memory turned living neighborhood — loud, caffeinated, unbeaten.",
    urbanness: "urban",
  },
  {
    state: "Florida",
    stateAbbrev: "FL",
    city: "Hialeah",
    zip: "33012",
    region: "Northwest Miami-Dade",
    climate: "hot, humid, afternoon thunderstorms you can set a watch by",
    landmarks: [
      "the racetrack flamingos",
      "Palm Avenue",
      "Westland Mall",
    ],
    localFoodTouchstone:
      "croquetas and cortaditos, a bakery at every intersection",
    vibe:
      "The most Cuban city in America — Spanish first, English optional, family everything.",
    urbanness: "urban",
  },
  {
    state: "Florida",
    stateAbbrev: "FL",
    city: "Little Haiti, Miami",
    zip: "33150",
    region: "Northeast Miami, on the high ground",
    climate: "hot and humid, sea-breeze evenings",
    landmarks: [
      "the Caribbean Marketplace",
      "NE 2nd Avenue",
      "a church every other block",
    ],
    localFoodTouchstone: "griot with pikliz, soup joumou every January first",
    vibe:
      "Kreyòl on the radio and developers at the door — higher ground, higher stakes.",
    urbanness: "urban",
  },
  {
    state: "Florida",
    stateAbbrev: "FL",
    city: "Coconut Grove, Miami",
    zip: "33133",
    region: "Bayside Miami, oldest neighborhood",
    climate: "hot, humid, shaded by banyans",
    landmarks: [
      "the marina",
      "Peacock Park",
      "the banyan-tunnel streets",
    ],
    localFoodTouchstone:
      "old Bahamian conch spots surviving next to sidewalk brunch",
    vibe:
      "Sailboats and banyans — Bahamian roots under the money, and the money keeps coming.",
    urbanness: "suburban",
  },
  {
    state: "Florida",
    stateAbbrev: "FL",
    city: "Kendall",
    zip: "33176",
    region: "Southwest Miami-Dade sprawl",
    climate: "hot, humid, hurricane shutters in the garage",
    landmarks: ["Dadeland Mall", "the Palmetto Expressway", "Baptist Hospital"],
    localFoodTouchstone: "ventanitas in strip malls, quinceañera buffets",
    vibe:
      "Suburban Miami sprawl — everyone's abuela lives fifteen minutes away.",
    urbanness: "suburban",
  },

  // ---- Bay Area (5) ----
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Fruitvale, Oakland",
    zip: "94601",
    region: "East Oakland",
    climate: "mild year-round, fog burns off by noon",
    landmarks: [
      "the Fruitvale BART plaza",
      "International Boulevard",
      "Lake Merritt a bus ride away",
    ],
    localFoodTouchstone: "tacos de canasta at BART, banh mi counters",
    vibe: "Mexican and Vietnamese Oakland — organizers, taco trucks, deep roots.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "The Mission, San Francisco",
    zip: "94110",
    region: "Inner San Francisco, sunny side",
    climate: "the sunniest blocks in a foggy city",
    landmarks: [
      "Dolores Park",
      "the 24th Street murals",
      "the BART plazas",
    ],
    localFoodTouchstone:
      "the Mission burrito, obviously — and the pupusas nobody writes up",
    vibe:
      "The Latino heart of SF sharing sidewalks with tech money, neither one blinking.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Berkeley",
    zip: "94703",
    region: "East Bay college town",
    climate: "mild, foggy mornings, no real winter",
    landmarks: [
      "the Cheese Board line",
      "Telegraph Avenue",
      "the Campanile",
    ],
    localFoodTouchstone:
      "farm-to-table before it had a name, cheap Thai for the students",
    vibe:
      "Still arguing at the co-op after all these years, and the argument is the point.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Richmond",
    zip: "94804",
    region: "East Bay shoreline, refinery town",
    climate: "mild, windy off the bay",
    landmarks: [
      "the Rosie the Riveter waterfront",
      "Point Richmond",
      "the refinery flare at night",
    ],
    localFoodTouchstone: "soul food Sundays and pan dulce mornings",
    vibe:
      "The shipyard town that built the WWII fleet — still working, still overlooked.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Daly City",
    zip: "94014",
    region: "Just over the SF line, in the fog belt",
    climate: "fog rolling over the hills every afternoon",
    landmarks: [
      "the fog line on the ridge",
      "Serramonte Mall",
      "the rows of little boxy houses",
    ],
    localFoodTouchstone: "lumpia at every family party, dim sum on Sundays",
    vibe:
      "The Filipino capital of America, fog pouring over the little houses like clockwork.",
    urbanness: "suburban",
  },

  // ---- Texas metros (5) ----
  {
    state: "Texas",
    stateAbbrev: "TX",
    city: "Third Ward, Houston",
    zip: "77004",
    region: "Historic Black Houston",
    climate: "swamp-hot summers, two weeks of winter",
    landmarks: [
      "Emancipation Park",
      "TSU and UH side by side",
      "the Eldorado Ballroom",
    ],
    localFoodTouchstone: "barbecue joints and Frenchy's creole fried chicken",
    vibe:
      "Black Houston's historic heart — Juneteenth started up the road, and everyone knows it.",
    urbanness: "urban",
  },
  {
    state: "Texas",
    stateAbbrev: "TX",
    city: "Oak Cliff, Dallas",
    zip: "75208",
    region: "Dallas, south of the Trinity",
    climate: "long broiling summers, ice-storm panics",
    landmarks: [
      "the Bishop Arts District",
      "Kiest Park",
      "the skyline view from the Margaret Hunt Hill Bridge",
    ],
    localFoodTouchstone:
      "birria trucks and old-school Tex-Mex enchiladas, gravy and all",
    vibe:
      "Dallas's other side of the river — Mexican, Black, artsy, proud, not downtown.",
    urbanness: "urban",
  },
  {
    state: "Texas",
    stateAbbrev: "TX",
    city: "East Austin",
    zip: "78702",
    region: "Austin, east of I-35",
    climate: "hot from April to October, cedar fever in January",
    landmarks: [
      "the mural walls",
      "the line outside Franklin Barbecue",
      "the old Victory Grill",
    ],
    localFoodTouchstone: "breakfast tacos as a religion, brisket worth the wait",
    vibe:
      "Old Black and Chicano Austin under new condos — the tension is the story.",
    urbanness: "urban",
  },
  {
    state: "Texas",
    stateAbbrev: "TX",
    city: "West Side, San Antonio",
    zip: "78207",
    region: "Oldest Mexican-American neighborhood in Texas",
    climate: "hot, humid, long springs",
    landmarks: [
      "Our Lady of the Lake's spires",
      "the Guadalupe Cultural Arts Center",
      "Elmendorf Lake",
    ],
    localFoodTouchstone: "puffy tacos, and barbacoa with Big Red on Sundays",
    vibe:
      "Every family four generations deep — the West Side raised half this city.",
    urbanness: "urban",
  },
  {
    state: "Texas",
    stateAbbrev: "TX",
    city: "Magnolia Park, Houston",
    zip: "77011",
    region: "Houston East End, port side",
    climate: "gulf humidity, refinery haze",
    landmarks: [
      "the Ship Channel",
      "the Navigation Boulevard esplanade",
      "the original Ninfa's",
    ],
    localFoodTouchstone:
      "fajitas were more or less invented here, and they'll tell you",
    vibe: "Port-side Mexican Houston — refinery shifts, quinceañeras, loyalty.",
    urbanness: "urban",
  },

  // ---- Philadelphia / Pittsburgh (5) ----
  {
    state: "Pennsylvania",
    stateAbbrev: "PA",
    city: "South Philly",
    zip: "19148",
    region: "Rowhouse Philadelphia",
    climate: "muggy summers, gray raw winters",
    landmarks: [
      "the Italian Market",
      "the stadiums",
      "East Passyunk Avenue",
    ],
    localFoodTouchstone:
      "cheesesteaks are a civil war, and Sunday gravy is a covenant",
    vibe: "Rowhouse Philly — parking chairs, Eagles flags, grandmom upstairs.",
    urbanness: "urban",
  },
  {
    state: "Pennsylvania",
    stateAbbrev: "PA",
    city: "West Philly",
    zip: "19143",
    region: "West Philadelphia, trolley country",
    climate: "humid summers, slushy winters",
    landmarks: [
      "Clark Park",
      "the Baltimore Avenue trolley",
      "the big Victorian twins",
    ],
    localFoodTouchstone: "Ethiopian on Baltimore Ave and water ice all summer",
    vibe:
      "Porch culture — professors, aunties, and anarchists sharing the same block.",
    urbanness: "urban",
  },
  {
    state: "Pennsylvania",
    stateAbbrev: "PA",
    city: "Fishtown, Philadelphia",
    zip: "19125",
    region: "The riverwards, Philadelphia",
    climate: "muggy summers, raw river winters",
    landmarks: ["Frankford Avenue", "the El overhead", "Palmer Park"],
    localFoodTouchstone:
      "third-generation Polish bakeries next to natural wine bars",
    vibe: "Old riverward gone hip — the neighbors who stayed have opinions.",
    urbanness: "urban",
  },
  {
    state: "Pennsylvania",
    stateAbbrev: "PA",
    city: "Bloomfield, Pittsburgh",
    zip: "15224",
    region: "Pittsburgh's Little Italy",
    climate: "gray most of the year, steep streets icy in January",
    landmarks: [
      "Liberty Avenue",
      "the West Penn Hospital towers",
      "the parklet stairs",
    ],
    localFoodTouchstone:
      "old red-sauce joints and pierogi sales in church basements",
    vibe: "Pittsburgh's Little Italy — steep streets, nosy neighbors, in the good way.",
    urbanness: "urban",
  },
  {
    state: "Pennsylvania",
    stateAbbrev: "PA",
    city: "Homestead",
    zip: "15120",
    region: "Mon Valley steel town",
    climate: "river-valley gray, humid summers",
    landmarks: [
      "the Waterfront mall where the mill was",
      "the Pump House",
      "the High-Level Bridge",
    ],
    localFoodTouchstone:
      "Lenten fish frys and kielbasa from the old butchers",
    vibe: "The steel is gone but the town remembers — mill pride with a mall on top.",
    urbanness: "suburban",
  },

  // ---- Boston area (4) ----
  {
    state: "Massachusetts",
    stateAbbrev: "MA",
    city: "Dorchester, Boston",
    zip: "02124",
    region: "Boston's biggest neighborhood",
    climate: "nor'easters and beautiful Septembers",
    landmarks: [
      "Fields Corner",
      "Franklin Park",
      "the Red Line's Ashmont branch",
    ],
    localFoodTouchstone:
      "banh mi in Fields Corner, Jamaican patties on Blue Hill Ave",
    vibe:
      "Cape Verdean, Vietnamese, Irish, and Black Boston all calling it Dot.",
    urbanness: "urban",
  },
  {
    state: "Massachusetts",
    stateAbbrev: "MA",
    city: "South Boston",
    zip: "02127",
    region: "Southie, the peninsula",
    climate: "harbor wind, snow piles that last till April",
    landmarks: [
      "Castle Island",
      "the L Street Bathhouse",
      "East Broadway",
    ],
    localFoodTouchstone:
      "Sullivan's hot dogs at Castle Island, Dunkin' as a food group",
    vibe:
      "The old triple-deckers holding out against the glass condos, wicked proud.",
    urbanness: "urban",
  },
  {
    state: "Massachusetts",
    stateAbbrev: "MA",
    city: "Cambridge",
    zip: "02139",
    region: "Across the Charles from Boston",
    climate: "New England four seasons, river wind",
    landmarks: ["Central Square", "the Charles", "MIT's dome"],
    localFoodTouchstone:
      "cheap Ethiopian and falafel between biotech lunches",
    vibe: "Two universities, a hundred opinions per block, rent by the ounce.",
    urbanness: "urban",
  },
  {
    state: "Massachusetts",
    stateAbbrev: "MA",
    city: "East Boston",
    zip: "02128",
    region: "Eastie, across the harbor",
    climate: "harbor wind, jet exhaust shimmer",
    landmarks: [
      "the airport across the street",
      "Maverick Square",
      "Constitution Beach",
    ],
    localFoodTouchstone: "arepas and empanadas under the flight path",
    vibe:
      "Salvadoran and Colombian now, Italian before — planes overhead every ninety seconds and nobody flinches.",
    urbanness: "urban",
  },

  // ---- DC / PG County (4) ----
  {
    state: "District of Columbia",
    stateAbbrev: "DC",
    city: "Anacostia, Washington",
    zip: "20020",
    region: "East of the river, Southeast DC",
    climate: "swamp summers, cherry-blossom springs",
    landmarks: [
      "the Big Chair",
      "Frederick Douglass's house on the hill",
      "the Anacostia River",
    ],
    localFoodTouchstone: "mumbo sauce on wings, church fish frys",
    vibe:
      "Black Washington's stronghold, watching the city change across the water.",
    urbanness: "urban",
  },
  {
    state: "District of Columbia",
    stateAbbrev: "DC",
    city: "Petworth, Washington",
    zip: "20011",
    region: "Upper Northwest DC, porch-front blocks",
    climate: "humid summers, mild gray winters",
    landmarks: [
      "the Georgia Ave Metro plaza",
      "Grant Circle",
      "the little Upshur Street strip",
    ],
    localFoodTouchstone:
      "carryouts with mumbo sauce and new small plates on Upshur",
    vibe:
      "Porch-front DC — federal workers, Salvadoran families, go-go on the weekends.",
    urbanness: "urban",
  },
  {
    state: "Maryland",
    stateAbbrev: "MD",
    city: "Capitol Heights",
    zip: "20743",
    region: "Prince George's County, across the DC line",
    climate: "mid-Atlantic humid summers",
    landmarks: [
      "the end of the Blue Line",
      "Central Avenue",
      "the church parking lots that fill by 9am Sunday",
    ],
    localFoodTouchstone: "carryout culture — wings, subs, lake trout",
    vibe:
      "Black suburbia across the DC line — homeowners, commuters, church on Sunday.",
    urbanness: "suburban",
  },
  {
    state: "Maryland",
    stateAbbrev: "MD",
    city: "Hyattsville",
    zip: "20782",
    region: "Prince George's County, Route 1 corridor",
    climate: "humid summers, occasional big snow",
    landmarks: [
      "the Route 1 Arts District",
      "the Trolley Trail",
      "the old hardware store turned brewery",
    ],
    localFoodTouchstone: "pupuserias and taco spots all along Route 1",
    vibe:
      "PG County's artsy corner — Salvadoran families and studio painters sharing Route 1.",
    urbanness: "suburban",
  },

  // ---- Puerto Rico (2) ----
  {
    state: "Puerto Rico",
    stateAbbrev: "PR",
    city: "Santurce, San Juan",
    zip: "00907",
    region: "San Juan's loud creative heart",
    climate: "85 and humid year-round, everyone tracks hurricane season",
    landmarks: [
      "La Placita at night",
      "Calle Loíza",
      "the Santurce es Ley murals",
    ],
    localFoodTouchstone: "alcapurrias from the kiosks, chinchorreo weekends",
    vibe:
      "Salsa out the windows and generators humming when the light goes — the island doesn't quit.",
    urbanness: "urban",
  },
  {
    state: "Puerto Rico",
    stateAbbrev: "PR",
    city: "Bayamón",
    zip: "00959",
    region: "San Juan metro, the big working suburb",
    climate: "hot, humid, mountain rain in the afternoons",
    landmarks: [
      "the Estadio Juan Ramón Loubriel",
      "Rio Hondo mall",
      "the highway sculpture park",
    ],
    localFoodTouchstone:
      "lechoneras up in the mountains, panaderías every morning",
    vibe: "Chinchorros, malls, and everybody's cousin — San Juan's back yard.",
    urbanness: "suburban",
  },

  // ---- Smaller cities (48) ----
  {
    state: "Illinois",
    stateAbbrev: "IL",
    city: "Peoria",
    zip: "61604",
    region: "River town Midwest",
    climate: "hot summers, real winters",
    landmarks: [
      "the Riverfront",
      "the old Caterpillar headquarters",
      "Grandview Drive",
    ],
    localFoodTouchstone:
      "the church potluck circuit and breaded tenderloin sandwiches",
    vibe: "River town, Caterpillar money used to run everything.",
    urbanness: "urban",
  },
  {
    state: "New York",
    stateAbbrev: "NY",
    city: "Utica",
    zip: "13501",
    region: "Rust Belt Mohawk Valley",
    climate: "lake-effect snow by the foot",
    landmarks: [
      "the Stanley Theatre",
      "Genesee Street",
      "the old mills along the canal",
    ],
    localFoodTouchstone:
      "chicken riggies and half-moons, tomato pie at every party",
    vibe:
      "The old mill town that refugees quietly rebuilt — Bosnian coffee next to Italian bakeries.",
    urbanness: "urban",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Bakersfield",
    zip: "93304",
    region: "Southern Central Valley, oil and ag",
    climate: "triple-digit summers, tule fog winters",
    landmarks: [
      "the dry Kern River bed",
      "the pumpjacks off Highway 33",
      "the Fox Theater",
    ],
    localFoodTouchstone:
      "Basque family-style dinners and the best carnicerías in the Valley",
    vibe:
      "Country music and crude oil — the California that votes and prays like Texas.",
    urbanness: "urban",
  },
  {
    state: "Montana",
    stateAbbrev: "MT",
    city: "Missoula",
    zip: "59801",
    region: "Northern Rockies college town",
    climate: "real winters, smoky Augusts",
    landmarks: [
      "the M trail on Mount Sentinel",
      "the Clark Fork running through downtown",
      "the hand-carved carousel",
    ],
    localFoodTouchstone: "huckleberry everything and brewery taprooms",
    vibe: "Trout bums, professors, and ranch kids sharing one downtown.",
    urbanness: "urban",
  },
  {
    state: "Arkansas",
    stateAbbrev: "AR",
    city: "Fayetteville",
    zip: "72701",
    region: "Ozarks college town",
    climate: "humid summers, ice storms instead of snow",
    landmarks: [
      "Dickson Street",
      "Razorback Stadium",
      "the Ozark hills on every horizon",
    ],
    localFoodTouchstone:
      "calling the Hogs over cheese dip — an Arkansas invention, they'll insist",
    vibe: "The Ozarks with a university in it — Walmart money one town over.",
    urbanness: "urban",
  },
  {
    state: "Texas",
    stateAbbrev: "TX",
    city: "Waco",
    zip: "76706",
    region: "Central Texas, I-35 corridor",
    climate: "brutal summers, tornado watches in spring",
    landmarks: [
      "the suspension bridge over the Brazos",
      "Baylor's campus",
      "the Silos crowds downtown",
    ],
    localFoodTouchstone: "kolaches from the Czech bakeries off I-35",
    vibe:
      "Baylor, barbecue, and shiplap tourists — the town shrugs and cashes the checks.",
    urbanness: "urban",
  },
  {
    state: "Ohio",
    stateAbbrev: "OH",
    city: "Toledo",
    zip: "43605",
    region: "Rust Belt Great Lakes",
    climate: "gray Great Lakes winters, muggy summers",
    landmarks: [
      "the art museum's Glass Pavilion",
      "the Maumee River",
      "the Jeep plant",
    ],
    localFoodTouchstone:
      "Tony Packo's Hungarian hot dogs — ask any M*A*S*H fan",
    vibe: "Glass City — a union town on the Maumee that keeps outliving its obituaries.",
    urbanness: "urban",
  },
  {
    state: "Minnesota",
    stateAbbrev: "MN",
    city: "Duluth",
    zip: "55806",
    region: "Lake Superior port city",
    climate: "Lake Superior decides everything; May can snow",
    landmarks: [
      "the Aerial Lift Bridge",
      "Canal Park",
      "Skyline Parkway above the harbor",
    ],
    localFoodTouchstone: "smoked whitefish and the Friday fish fry",
    vibe: "A port town clinging to a hillside over an inland sea.",
    urbanness: "urban",
  },
  {
    state: "Idaho",
    stateAbbrev: "ID",
    city: "Boise",
    zip: "83702",
    region: "Intermountain West boomtown",
    climate: "high desert — four seasons, dry",
    landmarks: [
      "the Greenbelt along the river",
      "Table Rock",
      "the Basque Block",
    ],
    localFoodTouchstone: "chorizo on the Basque Block and finger steaks",
    vibe:
      "A little city that got discovered — foothills at the end of every street, Californians in every closing.",
    urbanness: "urban",
  },
  {
    state: "Nevada",
    stateAbbrev: "NV",
    city: "Reno",
    zip: "89502",
    region: "High desert, eastern Sierra",
    climate: "sunny high desert, snow that melts by noon",
    landmarks: [
      "the Biggest Little City arch",
      "the Truckee River walk",
      "Mt. Rose on the skyline",
    ],
    localFoodTouchstone:
      "casino shrimp cocktails and Basque picon punch dinners",
    vibe:
      "The Biggest Little City — old casinos fading, climbers and warehouse money moving in.",
    urbanness: "urban",
  },
  {
    state: "Oklahoma",
    stateAbbrev: "OK",
    city: "Tulsa",
    zip: "74120",
    region: "Green Country, eastern Oklahoma",
    climate: "tornado-alley springs, long hot summers",
    landmarks: [
      "the art-deco downtown",
      "the Gathering Place",
      "Greenwood and the memory of Black Wall Street",
    ],
    localFoodTouchstone: "chicken-fried steak and surprisingly serious pho",
    vibe:
      "Oil-boom deco and Greenwood's memory — a city reckoning and rebuilding at once.",
    urbanness: "urban",
  },
  {
    state: "Louisiana",
    stateAbbrev: "LA",
    city: "Baton Rouge",
    zip: "70802",
    region: "Capital on the Mississippi",
    climate: "subtropical — sweating by 9am most of the year",
    landmarks: [
      "the capitol Huey Long built",
      "LSU's Death Valley on Saturday nights",
      "the levee",
    ],
    localFoodTouchstone:
      "crawfish boils in spring, gas-station boudin year-round",
    vibe:
      "Politics and football, with the petrochemical plants humming up the river.",
    urbanness: "urban",
  },
  {
    state: "Louisiana",
    stateAbbrev: "LA",
    city: "Bywater, New Orleans",
    zip: "70117",
    region: "Downriver New Orleans",
    climate: "swamp heat, and hurricane season is a season",
    landmarks: [
      "the levee at the end of the street",
      "St. Claude Avenue",
      "the Industrial Canal",
    ],
    localFoodTouchstone:
      "red beans on Monday, sno-balls in summer, your neighbor's gumbo",
    vibe:
      "Second lines still roll past the shotgun houses — the water is always part of the story.",
    urbanness: "urban",
  },
  {
    state: "South Carolina",
    stateAbbrev: "SC",
    city: "Charleston",
    zip: "29403",
    region: "Lowcountry port city",
    climate: "hot, humid, hurricane-watchful",
    landmarks: [
      "the Ravenel Bridge",
      "upper King Street",
      "the harbor",
    ],
    localFoodTouchstone: "shrimp and grits done right, Gullah red rice",
    vibe:
      "History under the charm, Gullah roots under the history, tourists over all of it.",
    urbanness: "urban",
  },
  {
    state: "Georgia",
    stateAbbrev: "GA",
    city: "Savannah",
    zip: "31401",
    region: "Georgia coast, oldest city in the state",
    climate: "hot and humid under the Spanish moss",
    landmarks: [
      "the squares under the live oaks",
      "the River Street cobblestones",
      "SCAD kids sketching everywhere",
    ],
    localFoodTouchstone: "crab stew, pralines, and church suppers",
    vibe: "Beautiful and haunted and perfectly fine with both.",
    urbanness: "urban",
  },
  {
    state: "Georgia",
    stateAbbrev: "GA",
    city: "West End, Atlanta",
    zip: "30310",
    region: "Historic Black Atlanta",
    climate: "hot summers, yellow-pollen springs",
    landmarks: [
      "the BeltLine's Westside Trail",
      "the AUC — Morehouse and Spelman",
      "the Victorian bungalow blocks",
    ],
    localFoodTouchstone: "vegan soul food next to the old wing spots",
    vibe:
      "AUC scholars, front porches, and BeltLine change coming fast.",
    urbanness: "urban",
  },
  {
    state: "Tennessee",
    stateAbbrev: "TN",
    city: "Midtown Memphis",
    zip: "38104",
    region: "Mid-South, bluff city",
    climate: "long humid summers, short gray winters",
    landmarks: [
      "Overton Park",
      "the Levitt Shell where Elvis played early",
      "Sun Studio a mile off",
    ],
    localFoodTouchstone:
      "dry-rub ribs and the eternal wet-versus-dry argument",
    vibe:
      "Grit and grind is a civic personality — music in the walls, church on every corner.",
    urbanness: "urban",
  },
  {
    state: "Tennessee",
    stateAbbrev: "TN",
    city: "Smyrna",
    zip: "37167",
    region: "Nashville commuter belt",
    climate: "humid summers, ice-scare winters",
    landmarks: [
      "the Nissan plant",
      "the old Sewart airfield",
      "Percy Priest Lake up the road",
    ],
    localFoodTouchstone:
      "meat-and-threes and hot chicken that moved out from the city",
    vibe:
      "Boomtown suburbia — subdivisions eating farmland, everybody from somewhere else.",
    urbanness: "suburban",
  },
  {
    state: "Virginia",
    stateAbbrev: "VA",
    city: "Roanoke",
    zip: "24016",
    region: "Blue Ridge railroad city",
    climate: "four gentle seasons, mountain fog mornings",
    landmarks: [
      "the Mill Mountain Star",
      "the downtown farmers market",
      "the Blue Ridge Parkway overhead",
    ],
    localFoodTouchstone: "Texas Tavern chili at 2am — a Roanoke rite",
    vibe:
      "A railroad city in a mountain bowl — the star on the mountain watches everything.",
    urbanness: "urban",
  },
  {
    state: "North Carolina",
    stateAbbrev: "NC",
    city: "Asheville",
    zip: "28801",
    region: "Southern Appalachian mountain city",
    climate: "mountain mild, leaf-season glory",
    landmarks: [
      "the Blue Ridge all around",
      "the River Arts District",
      "Pack Square",
    ],
    localFoodTouchstone:
      "farm-to-table everything, buskers between the breweries",
    vibe:
      "Appalachia's bohemian capital — crystals, craft beer, and the old families watching the prices.",
    urbanness: "urban",
  },
  {
    state: "Pennsylvania",
    stateAbbrev: "PA",
    city: "Scranton",
    zip: "18505",
    region: "Anthracite coal country, northeast PA",
    climate: "gray winters, green summers",
    landmarks: [
      "the Electric City sign",
      "Nay Aug Park",
      "the Steamtown locomotives",
    ],
    localFoodTouchstone:
      "church pierogi sales and Old Forge pizza cut in squares",
    vibe:
      "The coal-country city that outlived the coal, running on nostalgia and grit.",
    urbanness: "urban",
  },
  {
    state: "Wyoming",
    stateAbbrev: "WY",
    city: "Cheyenne",
    zip: "82001",
    region: "High Plains railroad capital",
    climate: "wind, sun, and snow that falls sideways",
    landmarks: [
      "the Union Pacific depot",
      "the Frontier Days grounds",
      "the big boots painted all over downtown",
    ],
    localFoodTouchstone:
      "chuckwagon breakfasts during Frontier Days, green chile drifted up from the south",
    vibe:
      "Railroad and rodeo — a state capital that still feels like a big ranch town.",
    urbanness: "urban",
  },
  {
    state: "South Dakota",
    stateAbbrev: "SD",
    city: "Sioux Falls",
    zip: "57104",
    region: "Eastern Dakotas hub",
    climate: "hard winters, wide-sky summers",
    landmarks: [
      "the falls right downtown",
      "Phillips Avenue",
      "the sculpture walk",
    ],
    localFoodTouchstone:
      "hotdish potlucks and chislic — cubed meat, toothpicks, no explanation",
    vibe: "The big city for three states' worth of small towns.",
    urbanness: "urban",
  },
  {
    state: "North Dakota",
    stateAbbrev: "ND",
    city: "Fargo",
    zip: "58102",
    region: "Red River Valley",
    climate: "wind chills that make the national news",
    landmarks: [
      "Broadway downtown",
      "NDSU Bison everything",
      "the flat that goes forever",
    ],
    localFoodTouchstone: "knoephla soup and lefse at Christmas",
    vibe: "Colder than you think, nicer than you deserve.",
    urbanness: "urban",
  },
  {
    state: "Alaska",
    stateAbbrev: "AK",
    city: "Anchorage",
    zip: "99501",
    region: "Southcentral Alaska",
    climate: "dark winters, endless summer light",
    landmarks: [
      "the Chugach right behind town",
      "the Coastal Trail",
      "a moose in somebody's yard",
    ],
    localFoodTouchstone:
      "salmon you caught yourself, reindeer sausage carts downtown",
    vibe:
      "A city with wilderness at the end of every street, everyone from somewhere else.",
    urbanness: "urban",
  },
  {
    state: "Maine",
    stateAbbrev: "ME",
    city: "Portland",
    zip: "04101",
    region: "Casco Bay working port",
    climate: "real winters, foggy perfect summers",
    landmarks: [
      "the Old Port cobblestones",
      "the working waterfront",
      "Portland Head Light",
    ],
    localFoodTouchstone:
      "lobster rolls argued over butter versus mayo, more restaurants per person than sense",
    vibe: "A fishing port that became a food town without losing the boots.",
    urbanness: "urban",
  },
  {
    state: "New Hampshire",
    stateAbbrev: "NH",
    city: "Manchester",
    zip: "03104",
    region: "Merrimack Valley mill city",
    climate: "New England four seasons, honest ones",
    landmarks: [
      "the Amoskeag millyard",
      "Elm Street",
      "the Merrimack running through",
    ],
    localFoodTouchstone: "poutine from the Franco clubs, sugar shacks in March",
    vibe:
      "A mill city remaking itself — Franco-American bones, primary-season chaos every four years.",
    urbanness: "urban",
  },
  {
    state: "Rhode Island",
    stateAbbrev: "RI",
    city: "Providence",
    zip: "02907",
    region: "Southern New England's small giant",
    climate: "raw winters, humid summers",
    landmarks: [
      "WaterFire on the rivers",
      "Federal Hill",
      "College Hill above downtown",
    ],
    localFoodTouchstone: "coffee milk, clam cakes, and Federal Hill red sauce",
    vibe:
      "A small city with a big-city chip on its shoulder — art school kids and old neighborhoods.",
    urbanness: "urban",
  },
  {
    state: "New Jersey",
    stateAbbrev: "NJ",
    city: "Trenton",
    zip: "08611",
    region: "Delaware River capital city",
    climate: "muggy summers, slushy winters",
    landmarks: [
      "the 'Trenton Makes' bridge",
      "the gold-domed statehouse",
      "the Chambersburg blocks",
    ],
    localFoodTouchstone:
      "tomato pies — the cheese goes under the sauce, and it matters",
    vibe:
      "The capital everyone drives past — 'Trenton Makes, the World Takes,' and the town remembers when it was true.",
    urbanness: "urban",
  },
  {
    state: "Delaware",
    stateAbbrev: "DE",
    city: "Wilmington",
    zip: "19802",
    region: "Brandywine Valley corporate capital",
    climate: "mid-Atlantic mild, muggy Augusts",
    landmarks: [
      "the Riverfront",
      "Rodney Square",
      "the credit-card towers empty by six",
    ],
    localFoodTouchstone: "scrapple without apology",
    vibe:
      "A corporate skyline over small-town blocks — everybody's got a Biden story.",
    urbanness: "urban",
  },
  {
    state: "Kentucky",
    stateAbbrev: "KY",
    city: "Louisville",
    zip: "40204",
    region: "Ohio River border South",
    climate: "humid Ohio Valley, allergy capital of America",
    landmarks: [
      "Churchill Downs",
      "Bardstown Road",
      "the waterfront under the bridges",
    ],
    localFoodTouchstone: "hot browns, Derby pie, bourbon in everything",
    vibe: "The South's northern door — Derby for one week, front porches the rest.",
    urbanness: "urban",
  },
  {
    state: "Alabama",
    stateAbbrev: "AL",
    city: "Birmingham",
    zip: "35205",
    region: "Jones Valley steel city",
    climate: "long hot summers, occasional ice panic",
    landmarks: [
      "Vulcan looking down from the ridge",
      "the Civil Rights Institute and 16th Street Baptist",
      "Railroad Park",
    ],
    localFoodTouchstone:
      "meat-and-threes with white tablecloths and hot-water cornbread",
    vibe:
      "The steel city that carried the movement — history on every corner, James Beard nods now too.",
    urbanness: "urban",
  },
  {
    state: "Texas",
    stateAbbrev: "TX",
    city: "El Paso",
    zip: "79905",
    region: "Far West Texas borderland",
    climate: "desert — 100 in June, one snow flurry a year",
    landmarks: [
      "the star on the Franklin Mountains",
      "the border bridges",
      "Juárez right across the river",
    ],
    localFoodTouchstone:
      "the best red enchiladas in America, and it's not close, they'll say",
    vibe:
      "Two countries, one city — the safest big city nobody believes is safe.",
    urbanness: "urban",
  },
  {
    state: "New Mexico",
    stateAbbrev: "NM",
    city: "South Valley, Albuquerque",
    zip: "87105",
    region: "Rio Grande valley, high desert",
    climate: "sun 310 days, green chile roasting in the September air",
    landmarks: [
      "the Sandias turning watermelon pink at dusk",
      "the bosque along the Rio Grande",
      "Route 66 neon on Central",
    ],
    localFoodTouchstone:
      "red or green is the state question; Christmas is the correct answer",
    vibe: "Adobe sprawl under a huge sky — old families, labs, lowriders.",
    urbanness: "urban",
  },
  {
    state: "Arizona",
    stateAbbrev: "AZ",
    city: "Tucson",
    zip: "85705",
    region: "Sonoran Desert, old Arizona",
    climate: "110 in July, perfect winters, monsoon creosote smell",
    landmarks: [
      "A Mountain",
      "saguaros standing everywhere",
      "the Fourth Avenue strip",
    ],
    localFoodTouchstone:
      "Sonoran hot dogs and a UNESCO-food-city chip on its shoulder",
    vibe: "Older than the state, browner than Phoenix, proud of both.",
    urbanness: "urban",
  },
  {
    state: "Colorado",
    stateAbbrev: "CO",
    city: "Colorado Springs",
    zip: "80909",
    region: "Front Range under Pikes Peak",
    climate: "high-altitude sun, sudden summer hail",
    landmarks: [
      "Pikes Peak filling the west",
      "Garden of the Gods",
      "the Air Force Academy chapel",
    ],
    localFoodTouchstone:
      "green chile smothering everything, chains all down Academy Boulevard",
    vibe:
      "Military bases, megachurches, and a fourteen-thousand-foot backdrop.",
    urbanness: "suburban",
  },
  {
    state: "Utah",
    stateAbbrev: "UT",
    city: "Salt Lake City",
    zip: "84111",
    region: "Wasatch Front valley",
    climate: "powder winters, inversion haze, dry summers",
    landmarks: [
      "the Wasatch wall to the east",
      "Temple Square",
      "the impossibly wide streets",
    ],
    localFoodTouchstone:
      "fry sauce, funeral potatoes, and a shockingly good taco scene",
    vibe:
      "The church and the counterculture sharing one valley, skis in every garage.",
    urbanness: "urban",
  },
  {
    state: "Oregon",
    stateAbbrev: "OR",
    city: "Southeast Portland",
    zip: "97202",
    region: "Willamette Valley, bungalow Portland",
    climate: "gray drizzle eight months, unbeatable summers",
    landmarks: [
      "the food-cart pods",
      "the Hawthorne Bridge",
      "Mt. Hood on a clear day",
    ],
    localFoodTouchstone:
      "food carts as a way of life, brunch lines in the rain",
    vibe:
      "Bungalows, bikes, and a protest calendar — keeping it weird is a chore now and they do it anyway.",
    urbanness: "urban",
  },
  {
    state: "Washington",
    stateAbbrev: "WA",
    city: "Spokane",
    zip: "99201",
    region: "Inland Northwest",
    climate: "four real seasons on the dry side of the state",
    landmarks: [
      "the falls right downtown",
      "Riverfront Park's garbage goat",
      "the Monroe Street Bridge",
    ],
    localFoodTouchstone: "diner breakfasts and a quietly serious taco scene",
    vibe: "The other Washington — Seattle's rain-shadow cousin, prouder and cheaper.",
    urbanness: "urban",
  },
  {
    state: "Washington",
    stateAbbrev: "WA",
    city: "Ballard, Seattle",
    zip: "98107",
    region: "Northwest Seattle, old fishing village",
    climate: "coastal PNW, gray eight months",
    landmarks: [
      "the Ballard Locks",
      "Golden Gardens beach",
      "the National Nordic Museum",
    ],
    localFoodTouchstone: "salmon off the boats and the Sunday farmers market",
    vibe:
      "A fishing village swallowed by the city — Norwegian bones, brewery everything, the boats still go to Alaska.",
    urbanness: "urban",
  },
  {
    state: "Hawaii",
    stateAbbrev: "HI",
    city: "Kalihi, Honolulu",
    zip: "96819",
    region: "Urban Honolulu, mauka to makai",
    climate: "82 and trade winds, mauka showers",
    landmarks: [
      "the Koʻolau ridge behind the valley",
      "Bishop Museum",
      "the airport ten minutes off",
    ],
    localFoodTouchstone:
      "plate lunch — two scoops rice, mac salad — and manapua from the old shops",
    vibe:
      "Working-class Honolulu the tourists never see — Filipino, Samoan, local to the bone.",
    urbanness: "urban",
  },
  {
    state: "Iowa",
    stateAbbrev: "IA",
    city: "Des Moines",
    zip: "50310",
    region: "Central Iowa capital",
    climate: "humid summers, honest winters",
    landmarks: [
      "the gold-domed capitol",
      "the State Fairgrounds",
      "the East Village",
    ],
    localFoodTouchstone:
      "State Fair anything-on-a-stick and breaded pork tenderloins wider than the bun",
    vibe:
      "Insurance towers and caucus ghosts — quietly one of the easiest places in America to live.",
    urbanness: "urban",
  },
  {
    state: "Indiana",
    stateAbbrev: "IN",
    city: "Fort Wayne",
    zip: "46805",
    region: "Northeast Indiana, three rivers",
    climate: "Midwest four seasons, gray Januarys",
    landmarks: [
      "the confluence of the three rivers",
      "the TinCaps ballpark",
      "the old GE campus being reborn",
    ],
    localFoodTouchstone: "coney dogs from the old Greek stands downtown",
    vibe: "Indiana's second city — factories, churches, and minor-league loyalty.",
    urbanness: "urban",
  },
  {
    state: "Nebraska",
    stateAbbrev: "NE",
    city: "South Omaha",
    zip: "68107",
    region: "Missouri River packinghouse district",
    climate: "plains weather — hot, cold, wind, repeat",
    landmarks: [
      "the old stockyards site",
      "the 24th Street murals",
      "Vinton Street",
    ],
    localFoodTouchstone:
      "the best Mexican food between Chicago and Denver, on the old packinghouse blocks",
    vibe: "Packinghouse town turned Latino main street — work is the culture.",
    urbanness: "urban",
  },
  {
    state: "Connecticut",
    stateAbbrev: "CT",
    city: "New Haven",
    zip: "06511",
    region: "Long Island Sound college city",
    climate: "New England coastal — raw springs, humid Augusts",
    landmarks: ["the Green", "Yale's gothic walls", "East Rock"],
    localFoodTouchstone:
      "apizza — thin, charred, and no Pepe's-versus-Sally's debates entertained within earshot",
    vibe: "Town and gown in a permanent standoff, world-class pizza as the truce.",
    urbanness: "urban",
  },
  {
    state: "Missouri",
    stateAbbrev: "MO",
    city: "South City, St. Louis",
    zip: "63116",
    region: "South St. Louis brick belt",
    climate: "humid summers, gray winters",
    landmarks: [
      "Tower Grove Park",
      "the Bevo Mill windmill",
      "red brick as far as you can see",
    ],
    localFoodTouchstone:
      "toasted ravioli, gooey butter cake, and where'd-you-go-to-high-school",
    vibe: "Red brick and lawn chairs — Bosnian bakeries in the old German blocks.",
    urbanness: "urban",
  },
  {
    state: "Michigan",
    stateAbbrev: "MI",
    city: "Southwest Detroit",
    zip: "48209",
    region: "Detroit's Mexicantown",
    climate: "Great Lakes gray, real winter",
    landmarks: [
      "the Ambassador Bridge overhead",
      "Clark Park",
      "the Mexicantown arches",
    ],
    localFoodTouchstone: "tacos and paletas under the bridge traffic",
    vibe:
      "Industry, family, and the busiest border crossing in North America overhead.",
    urbanness: "urban",
  },
  {
    state: "Wisconsin",
    stateAbbrev: "WI",
    city: "South Side Milwaukee",
    zip: "53204",
    region: "Near South Side, old Polish ward",
    climate: "lake-effect cold, festival summers",
    landmarks: [
      "the Basilica of St. Josaphat dome",
      "Mitchell Street",
      "the Mitchell Park Domes",
    ],
    localFoodTouchstone:
      "Friday fish fry — not optional — and tamale carts on Cesar Chavez Drive",
    vibe:
      "Polish steeples over a Mexican main street — a working town that still makes things.",
    urbanness: "urban",
  },

  // ---- Rural archetypes (10) ----
  {
    state: "Minnesota",
    stateAbbrev: "MN",
    city: "Hibbing",
    zip: "55746",
    region: "The Iron Range",
    climate: "brutal winters, mosquito Julys",
    landmarks: [
      "the Hull-Rust mine pit — the man-made Grand Canyon",
      "the high school Bob Dylan walked out of",
      "taconite trucks on Highway 169",
    ],
    localFoodTouchstone:
      "pasties from the mining days, potica at Christmas",
    vibe:
      "Ore towns that fed the steel mills — union to the bone, wary of promises.",
    urbanness: "rural",
  },
  {
    state: "Texas",
    stateAbbrev: "TX",
    city: "Weslaco",
    zip: "78596",
    region: "The Rio Grande Valley",
    climate: "subtropical — hot to hotter, citrus in winter",
    landmarks: [
      "the citrus groves",
      "the border a few miles south",
      "the weekend pulgas",
    ],
    localFoodTouchstone:
      "barbacoa and Big Red on Sundays, elotes from the pushcart",
    vibe:
      "The Valley — Spanish first, family always, Winter Texans every January.",
    urbanness: "rural",
  },
  {
    state: "Mississippi",
    stateAbbrev: "MS",
    city: "Clarksdale",
    zip: "38614",
    region: "The Mississippi Delta",
    climate: "cotton-field heat, mild winters",
    landmarks: [
      "the Crossroads of Highways 61 and 49",
      "Red's juke joint",
      "flat brown fields to the horizon",
    ],
    localFoodTouchstone:
      "Delta hot tamales — a secret older than the blues clubs",
    vibe:
      "Where the blues actually started — poor as ever, richer than anywhere in what matters.",
    urbanness: "rural",
  },
  {
    state: "West Virginia",
    stateAbbrev: "WV",
    city: "Welch",
    zip: "24801",
    region: "Appalachian coal country, McDowell County",
    climate: "foggy hollow mornings, flash-flood summers",
    landmarks: [
      "the tipples rusting on the hillsides",
      "the mountains close on every side",
      "the old company-store buildings",
    ],
    localFoodTouchstone:
      "beans and cornbread, ramps in spring, church dinners",
    vibe: "Coal built it, coal left — the people who stayed, stayed for each other.",
    urbanness: "rural",
  },
  {
    state: "California",
    stateAbbrev: "CA",
    city: "Hanford",
    zip: "93230",
    region: "Central Valley farmland, Kings County",
    climate: "triple-digit summers, tule fog you can't see through",
    landmarks: [
      "the almond rows running to the horizon",
      "China Alley",
      "the old Superior Dairy ice cream counter",
    ],
    localFoodTouchstone:
      "tri-tip fundraisers and taco trucks at the field edge",
    vibe:
      "The Valley feeds the country and gets none of the credit — work starts before light.",
    urbanness: "rural",
  },
  {
    state: "Kentucky",
    stateAbbrev: "KY",
    city: "Hazard",
    zip: "41701",
    region: "Eastern Kentucky Appalachia",
    climate: "humid hollow summers, icy hills in January",
    landmarks: [
      "the North Fork of the Kentucky River",
      "strip-mine scars gone green",
      "a half-quiet Main Street",
    ],
    localFoodTouchstone:
      "soup beans and cornbread, dumplings at the church fundraiser",
    vibe:
      "The mountains hold you close and hold you back, and folks stay anyway — kin is everything.",
    urbanness: "rural",
  },
  {
    state: "Alaska",
    stateAbbrev: "AK",
    city: "Sitka",
    zip: "99835",
    region: "The Alaska Panhandle",
    climate: "rainforest — ninety inches a year, mild and wet",
    landmarks: [
      "Mount Edgecumbe across the sound",
      "the harbor and its fishing fleet",
      "St. Michael's onion dome",
      "Totem Park",
    ],
    localFoodTouchstone:
      "salmon and halibut you or your neighbor caught, herring eggs in spring",
    vibe:
      "An island town of fish, Tlingit history, and Russian steeples — the ferry and the plane are the only ways out.",
    urbanness: "rural",
  },
  {
    state: "Vermont",
    stateAbbrev: "VT",
    city: "Waitsfield",
    zip: "05673",
    region: "Mad River Valley, Green Mountains",
    climate: "real winter, mud season, green summers",
    landmarks: [
      "the covered bridge",
      "the Mad River",
      "Sugarbush up the road",
    ],
    localFoodTouchstone: "maple everything, potlucks at the grange hall",
    vibe: "A valley town that runs on snow, syrup, and town meeting.",
    urbanness: "rural",
  },
  {
    state: "Kansas",
    stateAbbrev: "KS",
    city: "Dodge City",
    zip: "67801",
    region: "High Plains wheat and cattle country",
    climate: "wind always, hail in June, sky in every direction",
    landmarks: [
      "the feedlots you smell before you see",
      "the Boot Hill museum",
      "grain elevators on the horizon",
    ],
    localFoodTouchstone:
      "beef every way — this town processes more cattle than almost anywhere",
    vibe:
      "The old cowtown myth with a meatpacking present — Spanish is the shop-floor language now.",
    urbanness: "rural",
  },
  {
    state: "Wisconsin",
    stateAbbrev: "WI",
    city: "Monroe",
    zip: "53566",
    region: "Green County dairy country",
    climate: "snowbelt winters, green-hill summers",
    landmarks: [
      "the courthouse square",
      "Cheese Days every other fall",
      "dairy barns on every ridge",
    ],
    localFoodTouchstone:
      "squeaky cheese curds, and limburger sandwiches at the last limburger tavern in America",
    vibe:
      "A Swiss-founded dairy town — the cows outnumber the people and everyone's fine with it.",
    urbanness: "rural",
  },
];

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
  /**
   * Formula v3: ONE bundled place — state, city, zip, and texture all
   * travel together so the geography is always internally coherent.
   */
  place: Place;
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
    place: pick(PLACES),
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
