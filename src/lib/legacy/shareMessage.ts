/**
 * What the share sheet actually sends.
 *
 * Isomorphic on purpose. There are FOUR places that share an inherit
 * code — the legacy code screen and Settings, on web and on mobile —
 * and each had written its own sentence:
 *
 *   web legacy screen   "I recorded an archive on chapter3five for {name}."
 *   web settings        "I made an inherit code so you can meet {name}…"
 *   mobile legacy       "Someone I love lives on at chapter3five."
 *   mobile settings     "I made an inherit code so you can meet {name}…"
 *
 * All four assume you recorded SOMEONE ELSE. Every one of them is wrong
 * for the case this feature exists for.
 *
 * A person records themselves, gets a code, and hands it to their
 * daughter to keep. With the old copy she receives a text from her
 * father reading "I made an inherit code so you can meet Wilson" — him,
 * talking about himself in the third person, as though he were already
 * gone. Both surfaces already knew which mode it was (`mode` on the
 * code row, `is_self_archive` on the oracle); none of them used it here.
 *
 * WHY THE CODE IS LIVE IMMEDIATELY, AND WHY THAT SHAPES THIS COPY. The
 * alternative was a beneficiary system: name someone, and when you die
 * we activate their access. That requires knowing you died — either
 * believing whoever tells us, or asking a grieving family for proof.
 * The first is abusable by anyone with your email; the second is a thing
 * we are not going to do to people.
 *
 * So the code works from the moment it is minted. You hand it over
 * yourself, while you are here. Which means this message gets read TODAY
 * by someone whose person is alive and well — and again, maybe years
 * later, when they go looking for it. It has to work both times. Hence:
 * plain, short, no goodbye, and explicit that there is no rush and no
 * expiry, so receiving it doesn't feel like being handed bad news.
 */

const FALLBACK_ORIGIN = "https://chapter3five.app";

export function inheritShareMessage(input: {
  code: string;
  /** The archive's name. Only used in the "someone else" wording. */
  name: string;
  /** True when the person sharing IS the archive. */
  isSelf: boolean;
  /** Site origin, so the link is right in preview/staging too. */
  origin?: string | null;
}): string {
  const { code, name, isSelf } = input;
  const origin = (input.origin || FALLBACK_ORIGIN).replace(/\/+$/, "");
  const redeem = `${origin}/identity/inherit`;

  if (isSelf) {
    return [
      `Hey — this is my chapter3five code: ${code}`,
      "",
      "It opens my archive whenever you're ready.",
      `Redeem it at ${redeem}`,
      "",
      "No rush — it doesn't expire.",
    ].join("\n");
  }

  const who = name.trim() || "someone I love";
  return [
    `Hey — this is the chapter3five code for ${who}: ${code}`,
    "",
    `It opens their archive whenever you're ready.`,
    `Redeem it at ${redeem}`,
    "",
    "No rush — it doesn't expire.",
  ].join("\n");
}

/** Share-sheet title / email subject. Short; the body carries it. */
export function inheritShareTitle(input: {
  name: string;
  isSelf: boolean;
}): string {
  return input.isSelf
    ? "My chapter3five code"
    : `${input.name.trim() || "Their"} chapter3five code`;
}
