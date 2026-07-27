/**
 * Fable humanization #1 — pre-stream reply-gap.
 *
 * Adds a small, deterministic-ish delay before the persona starts
 * typing. Real friends take a beat to read your message before they
 * start hammering out a response. Zero delay reads as "robotic
 * chatbot." Too much reads as "network slow." The sweet spot is
 * 400–1500ms, modulated by chronotype × mood × hour-of-day × a bit
 * of jitter.
 *
 * The client's typing indicator (isStreaming && !streamText) is
 * already visible during this pause, so the effect is purely "typing
 * dots sit for a heartbeat before words start showing up."
 */

import type { Chronotype } from "@/lib/identity/formula";
import type { Mood } from "@/lib/identity/mood";

/** Baseline gap before Claude's first token. */
const BASE_MS = 700;
/** Absolute floor / ceiling so a run of bad multipliers doesn't
 *  produce zero-delay ("robotic") or 5s-delay ("network broken"). */
const MIN_MS = 250;
const MAX_MS = 2200;

export type ReplyGapInputs = {
  chronotype: Chronotype | null;
  mood: Mood | null;
  /** Local hour 0-23 in the persona's timezone. If the persona has
   *  no timezone stored, pass the server hour — imperfect but the
   *  chronotype effect washes out cleanly at that granularity. */
  hourOfDay: number;
};

/**
 * Compute the delay in milliseconds. Pure function so it's trivially
 * testable and the stream route can inline the result.
 */
export function computeReplyGapMs(inputs: ReplyGapInputs): number {
  const hour = clampHour(inputs.hourOfDay);
  let ms = BASE_MS;

  // Chronotype × hour. Morning-people are quicker roughly 6am–noon,
  // slower late night. Night-owls the reverse. Steady drifts less.
  if (inputs.chronotype) {
    ms *= chronotypeMultiplier(inputs.chronotype, hour);
  }

  // Mood shifts baseline energy.
  if (inputs.mood) {
    ms *= moodMultiplier(inputs.mood);
  }

  // ±20% jitter so two consecutive turns don't feel like a metronome.
  const jitter = 1 + (Math.random() * 0.4 - 0.2);
  ms *= jitter;

  if (ms < MIN_MS) return MIN_MS;
  if (ms > MAX_MS) return MAX_MS;
  return Math.round(ms);
}

function clampHour(h: number): number {
  if (!Number.isFinite(h)) return 12;
  const n = Math.floor(h);
  if (n < 0) return 0;
  if (n > 23) return 23;
  return n;
}

/** Returns 0.6 for the persona's peak hours, 1.0 for neutral,
 *  1.4 for their slow hours. Steady stays close to 1.0. */
function chronotypeMultiplier(chronotype: Chronotype, hour: number): number {
  switch (chronotype) {
    case "morning_person":
      if (hour >= 6 && hour <= 11) return 0.6; // peak
      if (hour >= 22 || hour <= 4) return 1.4; // slow
      return 1.0;
    case "night_owl":
      if (hour >= 21 || hour <= 2) return 0.6; // peak
      if (hour >= 6 && hour <= 10) return 1.4; // slow
      return 1.0;
    case "steady":
      // Barely varies — a small dip late night, small bump mid-morning.
      if (hour >= 1 && hour <= 5) return 1.15;
      if (hour >= 9 && hour <= 12) return 0.9;
      return 1.0;
  }
}

/** Mood energy multiplier — worn-out drags, sharp-edged cuts fast. */
function moodMultiplier(mood: Mood): number {
  switch (mood) {
    case "worn_out":
      return 1.5;
    case "quiet_and_slow":
      return 1.25;
    case "reflective":
      return 1.15;
    case "distracted":
      return 1.1;
    case "quietly_warm":
      return 1.0;
    case "buoyant":
      return 0.85;
    case "restless":
      return 0.85;
    case "sharp_edged":
      return 0.7;
  }
}
