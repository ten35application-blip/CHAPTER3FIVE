/**
 * iMessage-style timestamp formatting for conversation rows.
 *
 *  - <1 minute     → "Now"
 *  - <60 minutes   → "5m"   (plain minute count, no "ago")
 *  - same calendar day → "2:34 PM"  (12-hour time, AM/PM)
 *  - yesterday     → "Yesterday"
 *  - within 7 days → "Tuesday"     (weekday name)
 *  - older         → "Mar 14" or "3/14/24" depending on locale
 *
 * Spanish equivalent uses the same shape with localized weekday +
 * "Ayer". Hours stay 24-h in Spanish, matching native iOS behavior.
 */

const WEEKDAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WEEKDAYS_ES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

export function relativeTime(
  iso: string | null,
  lang: "en" | "es" = "en",
): string {
  if (!iso) return "";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const now = new Date();
  const ms = now.getTime() - then.getTime();
  const min = Math.floor(ms / 60_000);

  if (min < 1) return lang === "es" ? "Ahora" : "Now";
  if (min < 60) return `${min}m`;

  // Same calendar day → 12h time (en) or 24h (es).
  const sameDay =
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate();
  if (sameDay) {
    if (lang === "es") {
      const hh = String(then.getHours()).padStart(2, "0");
      const mm = String(then.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
    let hours = then.getHours();
    const mm = String(then.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return `${hours}:${mm} ${ampm}`;
  }

  // Yesterday.
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    then.getFullYear() === yesterday.getFullYear() &&
    then.getMonth() === yesterday.getMonth() &&
    then.getDate() === yesterday.getDate();
  if (isYesterday) return lang === "es" ? "Ayer" : "Yesterday";

  // Within the last 7 days → weekday name.
  const daysAgo = Math.floor(ms / 86_400_000);
  if (daysAgo < 7) {
    const names = lang === "es" ? WEEKDAYS_ES : WEEKDAYS_EN;
    return names[then.getDay()];
  }

  // Older.
  if (lang === "es") {
    return then.toLocaleDateString("es", {
      day: "numeric",
      month: "short",
    });
  }
  return then.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
  });
}
