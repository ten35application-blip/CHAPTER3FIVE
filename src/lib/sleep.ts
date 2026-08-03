/**
 * Default sleep window — identity is asleep 11pm to 7am in their timezone.
 * Mirrors the loose schedule of a real person without configuration friction.
 */
export const SLEEP_HOUR_START = 23;
export const SLEEP_HOUR_END = 7;

function safeTimezone(tz: string | null | undefined): string {
  if (!tz) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "America/New_York";
  }
}

/** Returns the local hour (0-23) in the given timezone. */
export function localHour(timezone: string | null | undefined): number {
  const tz = safeTimezone(timezone);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  });
  const part = fmt.formatToParts(new Date()).find((p) => p.type === "hour");
  if (!part) return 12;
  // Some locales render "24" for midnight. Normalize.
  const h = Number(part.value) % 24;
  return Number.isFinite(h) ? h : 12;
}

export function isAsleep(timezone: string | null | undefined): boolean {
  const h = localHour(timezone);
  // Spans midnight: hour >= 23 OR hour < 7.
  return h >= SLEEP_HOUR_START || h < SLEEP_HOUR_END;
}

export function localTimeLabel(timezone: string | null | undefined): string {
  const tz = safeTimezone(timezone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date());
}

/**
 * "Wednesday, August 3, 2026" in the given timezone (or the server
 * default when none is known). Used by the chat routes to inject a
 * "== Today ==" cue so personas can reason about whether an event the
 * user mentioned ("interview Thursday") has already happened — the
 * OPEN LOOPS beat in CORE_BEHAVIOR_RULES depends on this.
 */
export function localDateLabel(timezone: string | null | undefined): string {
  const tz = safeTimezone(timezone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date());
}

/**
 * Loose bucket of the current time-of-day in the given timezone,
 * used by the chat routes for the TIME OF DAY cue block. Ranges are
 * deliberately fuzzy — the persona uses it to shape cadence, not to
 * cite the exact hour.
 *   dawn      5:00 – 7:59
 *   morning   8:00 – 11:59
 *   afternoon 12:00 – 16:59
 *   evening   17:00 – 20:59
 *   night     21:00 – 23:59
 *   late night 0:00 – 4:59
 */
export type TimeOfDay =
  | "dawn"
  | "morning"
  | "afternoon"
  | "evening"
  | "night"
  | "late night";

export function timeOfDayLabel(
  timezone: string | null | undefined,
): TimeOfDay {
  const h = localHour(timezone);
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  if (h >= 21 && h < 24) return "night";
  return "late night";
}

/**
 * Loose humanization of hours-since-last-message, used by the chat
 * routes for the FIRST MESSAGE BACK cue block. Ranges are approximate
 * on purpose — the persona reads the "shape of the gap", not a
 * stopwatch. Values below the caller's minimum-gap threshold aren't
 * meant to be rendered at all (chat routes gate on hours > 6).
 */
export function formatGap(hours: number): string {
  if (hours < 3) return "a couple hours";
  if (hours < 8) return "a few hours";
  if (hours < 20) return "most of a day";
  if (hours < 36) return "about a day";
  if (hours < 72) return "a couple days";
  if (hours < 168) return "a few days";
  if (hours < 336) return "a week";
  return "over a week";
}
