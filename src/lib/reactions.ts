/**
 * Shared reaction vocabulary. Six kinds match iMessage / Google
 * Messages tapback set — enough range to say most of what a tap
 * says, few enough that the popover doesn't feel like a menu.
 *
 * Ordering here is the ordering in the popover, left-to-right.
 * Heart first because it's the most-tapped in every messenger.
 */

export const REACTION_KINDS = [
  "heart",
  "exclamation",
  "thumbs_up",
  "thumbs_down",
  "question",
  "ha_ha",
] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];

export function isReactionKind(v: unknown): v is ReactionKind {
  return typeof v === "string" && (REACTION_KINDS as readonly string[]).includes(v);
}

/** Report reason vocabulary, matches 0077 check constraint. */
export const REPORT_REASONS = [
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "harmful", label: "Harmful or dangerous" },
  { value: "off_character", label: "Out of character" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]["value"];
