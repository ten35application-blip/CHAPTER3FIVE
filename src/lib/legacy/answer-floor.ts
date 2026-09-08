/**
 * Isomorphic minimum-answer floors for the legacy flow.
 *
 * Kept separate from sanitize.ts — which imports the server-only
 * question bank — so the client flow can render the correct "Finish
 * now with N answers" affordance without dragging server-only modules
 * into the browser bundle. Same split, and the same reason, as
 * code-format.ts vs code.ts.
 *
 * SPLIT BY MODE (2026-08-04), because the two modes fail differently.
 *
 * SELF: you are writing about yourself, in first person. Twenty short
 * answers still produce something real — the prose is yours, the
 * phrasing is yours. Thin, but not invented. And you are alive: you
 * can come back.
 *
 * OTHER: someone is writing about a person who is gone. Twenty thin
 * answers become a fluent multi-paragraph portrait with a hometown, a
 * trade and a philosophy — handed to a grandchild who will never know
 * which parts were real, by a writer who cannot come back and correct
 * it, about a person who cannot object. The floor has to be higher
 * where the confabulation is permanent.
 *
 * Deliberately not enormous. People fill this in during a hospice
 * week, and a wall is its own kind of harm.
 *
 * BOTH CLIENTS MUST USE THIS. When the server floor moved to 30 and the
 * client stayed hardcoded at 20, other-mode users were offered
 * "Finish now with 20 answers · $5" and then rejected with "A person
 * takes at least 30 answers to hold together." The button lied, in a
 * hospice week, to someone about to pay. Never re-hardcode.
 */

export const LEGACY_MIN_ANSWERS_SELF = 20;
export const LEGACY_MIN_ANSWERS_OTHER = 30;

export function minAnswersForMode(mode: "self" | "other"): number {
  return mode === "self" ? LEGACY_MIN_ANSWERS_SELF : LEGACY_MIN_ANSWERS_OTHER;
}


/**
 * QUESTION 0 — the junk drawer (Wilson 2026-09-08): "Before we start
 * asking your questions to create your essence, please feel free to
 * write random information — color, movie, book, things you hate and
 * love, anything and everything." Stored under this id in the same
 * answers map, so it rides along with drafts, mint, updates, fan-out,
 * facts and voice — but it is NOT one of the forty-five, so it never
 * counts toward progress or the finish floor.
 */
export const LEGACY_ANYTHING_ID = "anything";
export const ANYTHING_PROMPT = "Anything at all — favorite color, movie, food you hate, the song, the team, the small stuff.";

/** Answered count for progress + floors: the forty-five only. */
export function countAnswered(answers: Record<string, string> | null | undefined): number {
  return Object.entries(answers ?? {}).filter(
    ([id, a]) => id !== LEGACY_ANYTHING_ID && typeof a === "string" && a.trim().length > 0,
  ).length;
}
