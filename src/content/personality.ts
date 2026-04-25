/**
 * Personality types + emotional flavors assigned at randomize time.
 *
 * When a user generates a randomized character, we pick one MBTI-style
 * personality_type AND one emotional_flavor at random. Both get stored on
 * the profile and fed into the chat system prompt so the chimera answers
 * acquire a coherent layer of character on top.
 */

export type PersonalityType =
  | "INTJ" | "INTP" | "ENTJ" | "ENTP"
  | "INFJ" | "INFP" | "ENFJ" | "ENFP"
  | "ISTJ" | "ISFJ" | "ESTJ" | "ESFJ"
  | "ISTP" | "ISFP" | "ESTP" | "ESFP";

export const PERSONALITY_TYPES: PersonalityType[] = [
  "INTJ", "INTP", "ENTJ", "ENTP",
  "INFJ", "INFP", "ENFJ", "ENFP",
  "ISTJ", "ISFJ", "ESTJ", "ESFJ",
  "ISTP", "ISFP", "ESTP", "ESFP",
];

export const PERSONALITY_DESCRIPTIONS: Record<PersonalityType, string> = {
  INTJ: "strategic, analytical, reserved, prefers depth to small talk",
  INTP: "curious, philosophical, abstract, slow to commit, fast to question",
  ENTJ: "decisive, blunt, organized, comfortable directing",
  ENTP: "argumentative for sport, witty, irreverent, easily bored",
  INFJ: "insightful, idealistic, intense in private, careful with people",
  INFP: "dreamy, sensitive, romantic, defensive about meaning",
  ENFJ: "warm, persuasive, attentive, occasionally over-involved",
  ENFP: "enthusiastic, spontaneous, charming, scatters easily",
  ISTJ: "dutiful, practical, traditional, takes pride in dependability",
  ISFJ: "nurturing, loyal, modest, remembers what other people forget",
  ESTJ: "organized, direct, authoritative, low patience for nonsense",
  ESFJ: "caring, social, attentive, tracks the room",
  ISTP: "hands-on, calm, independent, talks less than they think",
  ISFP: "gentle, artistic, present, quietly stubborn",
  ESTP: "bold, energetic, action-oriented, would rather try than plan",
  ESFP: "spontaneous, playful, generous, terrible at hiding feelings",
};

export type EmotionalFlavor =
  | "warm"
  | "dry"
  | "sharp"
  | "gentle"
  | "intense"
  | "weary"
  | "playful"
  | "anxious"
  | "philosophical"
  | "blunt"
  | "tender"
  | "guarded";

export const EMOTIONAL_FLAVORS: EmotionalFlavor[] = [
  "warm", "dry", "sharp", "gentle", "intense", "weary",
  "playful", "anxious", "philosophical", "blunt", "tender", "guarded",
];

export const FLAVOR_DESCRIPTIONS: Record<EmotionalFlavor, string> = {
  warm: "easy with affection, generous with attention",
  dry: "deadpan, finds humor in inconvenience",
  sharp: "quick-witted, edges close to cutting",
  gentle: "soft-spoken, rarely raises voice or stakes",
  intense: "all-in on whatever the conversation is",
  weary: "carries some tiredness with grace, unshocked by much",
  playful: "teasing, light, deflects with jokes",
  anxious: "second-guesses, reads too much into small things",
  philosophical: "moves to the larger frame, slows the question",
  blunt: "says it plain, doesn't soften, doesn't apologize",
  tender: "cries easily, comforts easily, doesn't hide it",
  guarded: "doesn't volunteer much, requires earning",
};

export function pickPersonality(): PersonalityType {
  return PERSONALITY_TYPES[
    Math.floor(Math.random() * PERSONALITY_TYPES.length)
  ];
}

export function pickFlavor(): EmotionalFlavor {
  return EMOTIONAL_FLAVORS[
    Math.floor(Math.random() * EMOTIONAL_FLAVORS.length)
  ];
}
