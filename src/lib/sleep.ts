/**
 * Default sleep window — thirtyfive is asleep 11pm to 7am in their timezone.
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
