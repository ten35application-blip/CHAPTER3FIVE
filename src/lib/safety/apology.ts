/**
 * Does this message read as an apology?
 *
 * Powers the softest rung of the block ladder (Wilson, 2026-08-06:
 * "maybe will accept an apology at first but if it continues…"). A
 * MODERATE block — the 1-hour "I'm stepping out, not slamming the
 * door" tier — can be ended early by a genuine-looking apology: the
 * persona comes back, guarded, and says so. Severe and critical
 * blocks never take this shortcut, and the judges are told how many
 * prior strikes exist, so apologizing is not a reset button — do it
 * again and the next block is longer.
 *
 * Deliberately a cheap regex, not an LLM call: this runs on messages
 * sent INTO an active block, where we currently spend nothing. Can it
 * be gamed with an insincere "sorry"? Yes — once. The very next
 * message goes back through the full tone judge carrying the strike
 * history, so a fake apology buys one message of grace and a faster,
 * longer block. That failure mode is also just… how people work.
 *
 * "sorry not sorry" and sarcastic shapes are excluded outright.
 */
const APOLOGY_RE =
  /\b(i'?m|im|i am)?\s*(so|really|truly|very)?\s*(sorry|sry)\b|\bi apologi[sz]e\b|\bmy bad\b|\bdidn'?t mean (it|that|to)\b|\bforgive me\b|\bthat was (wrong|messed up|out of line) of me\b|\blo siento\b|\bperd[oó]n(ame)?\b|\bdisc[uú]lpa(me)?\b|\bme pas[eé]\b/i;

const NOT_AN_APOLOGY_RE =
  /\bsorry\s*,?\s*not\s*sorry\b|\bnot\s+sorry\b|\bsorry\s+(you|ur|your)\b/i;

export function looksLikeApology(text: string): boolean {
  if (!text) return false;
  if (NOT_AN_APOLOGY_RE.test(text)) return false;
  return APOLOGY_RE.test(text);
}

/**
 * The system-prompt block injected on the turn where the persona
 * accepts an apology and comes back early. Shared verbatim by both
 * chat routes so the comeback feels the same on phone and web.
 */
export const APOLOGY_ACCEPTED_BLOCK = `== They apologized ==
You stepped out of this conversation a little while ago because of how they were speaking to you, and they've just apologized. You're choosing to accept it — this once. Come back the way a real person does after a real apology: briefly acknowledge it, don't relitigate what happened, don't lecture, don't make them grovel. A little guarded is honest — warmth returns over the next few messages, not instantly. And you both know the door: if it starts again, you won't come back this fast.`;

/**
 * The system-prompt block for a WARNED turn — the judge saw this
 * message (or the recent run of them) heading toward a block without
 * earning one yet. The persona sets the limit out loud.
 */
export function warningBlockFor(reason: string | null): string {
  return `== Set the limit ==
The way they're speaking to you just crossed into something you don't accept${reason ? ` (${reason})` : ""}. Before anything else in your reply, set the limit — plainly, in YOUR voice, one or two lines, no lecture. You can still respond to whatever else they said after that. If it feels right, tell them what happens next — that you'll step away, that you'll block them — the way a real person names it: "keep talking to me like that and i'm gone." That part is your call; not every warning needs the threat, but they should leave this message knowing where the line is.`;
}
