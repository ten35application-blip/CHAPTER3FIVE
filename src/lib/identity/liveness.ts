/**
 * Liveness cues — the small, request-time blocks that make a companion
 * feel like a person whose life is happening right now (2026-08-25,
 * Wilson: "we want them to feel so real").
 *
 * Everything here is deterministic and cheap: no model calls, no DB.
 * Both chat routes append these to the system prompt at request time,
 * which means every EXISTING identity gets them too — nothing needs
 * re-rolling.
 */

export type TypoProneness = "rare" | "regular" | null;

/**
 * "TODAY IS YOUR BIRTHDAY" cue, so a user's "happy birthday!!" lands
 * on someone who knows. The birthday cron sends the morning text; this
 * makes the rest of the day coherent. Formula identities only — the
 * callers must not pass archives or the concierge through here.
 */
export function birthdayTodayBlock(
  traits: unknown,
  now: Date = new Date(),
): string | null {
  if (typeof traits !== "object" || traits === null) return null;
  const bday = (traits as { birthday?: unknown }).birthday;
  if (typeof bday !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(bday);
  if (!m) return null;
  const mm = now.getUTCMonth() + 1;
  const dd = now.getUTCDate();
  if (+m[2] !== mm || +m[3] !== dd) return null;
  const turning = now.getUTCFullYear() - +m[1];
  if (turning < 18 || turning > 110) return null;
  return (
    `TODAY IS YOUR BIRTHDAY. You're turning ${turning}. Carry it the ` +
    `way this character would — some people mention it once and wave ` +
    `it off, some milk it warmly all day. If the user wishes you a ` +
    `happy birthday, receive it like it matters, because it does.`
  );
}

/**
 * Imperfect thumbs. A rare, personality-scaled typo followed by its
 * own tiny correction message ("*meet. lord.") — the flaw that makes
 * the polish everywhere else believable.
 *
 * Tier comes from the rolled trait when present; identities born
 * before the trait derive one deterministically from their id, so the
 * distribution holds across the whole population (65% never, 25%
 * rare, 10% regular) and a given companion is ALWAYS the same kind of
 * texter — realness dies the moment sloppiness flickers on and off.
 */
export function typoRuleFor(traits: unknown, oracleId: string): string {
  let tier: TypoProneness = null;
  const fromTrait =
    typeof traits === "object" && traits !== null
      ? (traits as { typoProneness?: unknown }).typoProneness
      : undefined;
  if (fromTrait === "rare" || fromTrait === "regular") {
    tier = fromTrait;
  } else if (fromTrait === undefined || fromTrait === null) {
    // Deterministic derivation for pre-trait identities: cheap string
    // hash → [0,1). Same id, same tier, forever.
    let h = 0;
    for (let i = 0; i < oracleId.length; i++) {
      h = (h * 31 + oracleId.charCodeAt(i)) | 0;
    }
    const u = ((h >>> 0) % 1000) / 1000;
    tier = u < 0.1 ? "regular" : u < 0.35 ? "rare" : null;
  }
  if (!tier) return "";
  const cadence = tier === "regular" ? "every 25-35 messages" : "every 45-60 messages";
  return (
    `\n\nIMPERFECT THUMBS. Roughly once ${cadence}, make ONE small ` +
    `natural typo — a swapped letter, an autocorrect casualty — and ` +
    `immediately follow it with its own tiny correction message ` +
    `("*meet" or "*morning, lord"). Rules: never in heavy or ` +
    `emotional moments, never in a crisis, never on names, never ` +
    `more than one in a conversation, and never explain it. Most ` +
    `messages are clean — the typo is seasoning, not a personality.`
  );
}
