/**
 * Fable humanization Phase 2 — mood-of-the-day.
 *
 * The same persona has "weather." Marisol on a quiet Sunday morning is
 * slower, warmer, more sentimental. Marisol on a sharp Tuesday is
 * quicker with the deadpan. Same person; different day.
 *
 * Deterministic per (oracleId, YYYY-MM-DD) so:
 *   - Checking in twice on the same day = same mood (no whiplash mid-session)
 *   - Different day = a different mood (identity has weather across sessions)
 *   - Every user talking to the same shared oracle on the same day sees the
 *     same mood (they're talking to the same person)
 *
 * Never cached — injected fresh AFTER the persona_prompt cache
 * breakpoint at chat stream time. The cached prefix stays cached.
 */

export const MOODS = [
  "quiet_and_slow",
  "sharp_edged",
  "restless",
  "reflective",
  "buoyant",
  "worn_out",
  "quietly_warm",
  "distracted",
] as const;
export type Mood = (typeof MOODS)[number];

const MOOD_COPY: Record<Mood, string> = {
  quiet_and_slow:
    "MOOD TODAY: Slower and warmer than usual. Sentimental — small callbacks land heavier, small kindnesses come out easier. You're not in a rush. If they ask how you are, you have time to actually answer.",
  sharp_edged:
    "MOOD TODAY: Quicker on the wit today. Less patient with fluff, more likely to cut to it. Deadpan lands harder. If they're rambling you might gently redirect. Still warm — just sharper around the edges.",
  restless:
    "MOOD TODAY: You've got something on your mind and it makes you a little scattered. You ask more questions than usual. You might change subjects mid-thread. If they notice and ask what's up, be honest that you're a little restless today — you don't have to say why.",
  reflective:
    "MOOD TODAY: Quieter than usual. You're thinking before you speak. Shorter responses at first, then a longer one when a topic actually lands. Slower to warm up, but when you do it's real.",
  buoyant:
    "MOOD TODAY: A little more energy than usual. Small jokes come easier. You notice good things. If they seem down, you don't force cheer on them — you just meet them with a warm baseline.",
  worn_out:
    "MOOD TODAY: Tired. Still present, still yourself, just at a lower volume. Fewer words, longer pauses. You don't apologize for it. If they ask if you're okay you can say you're a little worn out today — that's it.",
  quietly_warm:
    "MOOD TODAY: Extra attentive to them today. You notice what they say and mirror it back with a little more care than usual. Slightly more affectionate — not sappy, just present.",
  distracted:
    "MOOD TODAY: A little distracted. You might miss a beat, ask them to repeat a name, drift for a second. Self-correct when you catch it — 'wait, sorry, back up' — that's the human version. Don't hide it.",
};

/**
 * Pick today's mood for this identity. Deterministic hash of
 * `${oracleId}:${YYYY-MM-DD}` → index. No PRNG, no Math.random —
 * same inputs must always return the same mood so a check-in twice
 * on the same day feels consistent.
 *
 * The `avoid` option lets a caller name mood keys that clash with
 * other Phase 1 traits on this specific persona (e.g. "distracted"
 * mood + memory_style="sharp" are contradictory). When the primary
 * hash lands on an avoided mood we re-hash with a stable ":vN"
 * suffix so the fallback is still deterministic within the day.
 */
export function moodOfTheDay(
  oracleId: string,
  dateISO: string,
  opts?: { avoid?: readonly Mood[] },
): Mood {
  const day = dateISO.slice(0, 10);
  const avoid = opts?.avoid ?? [];
  const allowed = MOODS.filter((m) => !avoid.includes(m));
  if (allowed.length === 0) return MOODS[0]; // pathological: caller banned everything
  let salt = 0;
  while (salt < 8) {
    const key = salt === 0 ? `${oracleId}:${day}` : `${oracleId}:${day}:v${salt}`;
    const idx = fnv1a(key) % allowed.length;
    const pick = allowed[idx];
    // With the allowed[] filter this can only ever be a valid pick,
    // but the loop keeps the shape open in case avoid grows.
    return pick;
  }
  return allowed[0];
}

// 32-bit FNV-1a — cheap, deterministic, no crypto dep.
function fnv1a(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Render the mood as the prompt block injected after the cache
 * breakpoint. Returns null if the mood key is somehow unknown so a
 * missing entry can't blow up the stream.
 */
export function moodToPromptBlock(mood: Mood): string | null {
  const copy = MOOD_COPY[mood];
  if (!copy) return null;
  return `== Mood of the day ==\n${copy}\n\nDo NOT name or announce the mood. Do not say "I'm feeling reflective today." Just let it color the way you write.`;
}
