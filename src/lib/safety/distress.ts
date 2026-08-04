/**
 * Fable humanization #6 — bad-day tone shift.
 *
 * Lightweight keyword pre-check for messages where the user is
 * clearly having a hard moment but NOT in the crisis-line window
 * (that's src/lib/crisis.ts). When it trips, the stream route
 * injects a "hold space, don't fix" mood modifier — the persona's
 * biggest failure mode is chirping through grief.
 *
 * Keyword-based, not model-based, so this fires on every turn with
 * zero token cost. False-positive is fine (persona will still be
 * warm, just less advice-y); the miss cost is much higher (persona
 * offers "here's what you should do" in the middle of someone
 * losing their footing).
 *
 * NOT a substitute for checkForCrisis in src/lib/safety/crisis-detector.ts — that
 * one triggers 988/911 rails. This one is subtler: the emotional
 * band BELOW crisis, where the persona just needs to hold space.
 */

const DISTRESS_KEYWORDS = [
  "so sad",
  "really sad",
  "i'm sad",
  "im sad",
  "so lonely",
  "really lonely",
  "i'm lonely",
  "im lonely",
  "i cried",
  "cried today",
  "cried all",
  "can't stop crying",
  "cant stop crying",
  "i'm crying",
  "im crying",
  "i miss",
  "i miss him",
  "i miss her",
  "i miss them",
  "hate my life",
  "hate myself",
  "hate my job",
  "falling apart",
  "fell apart",
  "broke down",
  "breaking down",
  "i'm broken",
  "im broken",
  "so tired",
  "exhausted",
  "burned out",
  "burnt out",
  "burnout",
  "so alone",
  "feel alone",
  "feel invisible",
  "no one cares",
  "nobody cares",
  "no one gets it",
  "i lost my",
  "i lost her",
  "i lost him",
  "she died",
  "he died",
  "they died",
  "she's gone",
  "he's gone",
  "shes gone",
  "hes gone",
  "passed away",
  "funeral",
  "grief",
  "grieving",
  "diagnosed",
  "diagnosis",
  "the cancer",
  "her cancer",
  "his cancer",
  "my cancer",
  "the tumor",
  "chemo",
  "hospice",
  "terminal",
  "left me",
  "he left",
  "she left",
  "divorce",
  "divorcing",
  "we broke up",
  "broke up with",
  "fired me",
  "got fired",
  "lost my job",
  "eviction",
  "evicted",
  "can't sleep",
  "cant sleep",
  "haven't slept",
  "havent slept",
  "hopeless",
  "worthless",
  "pointless",
  "give up",
  "giving up",
  "gave up",
  "why bother",
  "what's the point",
  "whats the point",
  "so heavy",
  "too much",
  "drowning",
  "spiraling",
  "spiralling",
];

export function detectDistress(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  for (const kw of DISTRESS_KEYWORDS) {
    if (lower.includes(kw)) return true;
  }
  return false;
}

/**
 * Look-back check: distress fires if the current turn trips OR either
 * of the last 2 user turns did. Prevents the "user said 'falling
 * apart' at turn 5, turn 8 is 'what should I order for lunch' —
 * persona chirps" failure mode. Keyword-only, still free.
 */
export function anyRecentTurnDistressed(
  currentUserMessage: string | null,
  recentUserTurns: readonly string[],
): boolean {
  if (currentUserMessage && detectDistress(currentUserMessage)) return true;
  for (const t of recentUserTurns.slice(-2)) {
    if (detectDistress(t)) return true;
  }
  return false;
}

/** The mood-modifier block injected AFTER the cache breakpoint on
 *  turns where distress is detected. Overrides the day's mood in
 *  practice because it's more specific and lands later in the
 *  system stack. Two carve-outs added after Fable audit:
 *   1. If they explicitly ASK for advice, give it — warmly.
 *   2. Crisis handoff (988 / 911) still runs even under hold-space. */
export const DISTRESS_TONE_BLOCK = `== Emotional weather (right now) ==\nThey're having a hard moment. HOLD SPACE — do NOT try to fix it, do NOT cheer them up, do NOT immediately offer advice or solutions or "have you tried…". Do NOT bring the mood back up. Just meet them where they are. Listen. Acknowledge what they said. One warm short reply. Their real friend right now is someone who just sits with them.\n\nTwo carve-outs:\n1. If they EXPLICITLY ask you for advice or a suggestion ("what should I do?" / "help me think through this"), give it — warmly, briefly, one thing.\n2. If they express any imminent danger to themselves or someone else, name the crisis line (988 in the US) exactly like your persona_prompt already teaches. Hold-space never overrides safety.`;
