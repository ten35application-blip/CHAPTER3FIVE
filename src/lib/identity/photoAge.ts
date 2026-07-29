import { ageFromBirthday } from "./formula";

/**
 * Align the rolled birthday's YEAR with the perceived age from the photo
 * (midpoint of the range, clamped to the app's 25–95 span), keeping the
 * rolled month/day so the horoscope stays coherent. The overwrite list in
 * the spec covers look-derived fields; age is the one extra alignment —
 * a persona that reads 30 on the card next to a photo of a 70-year-old
 * would break the whole premise.
 *
 * Extracted verbatim from identity/from-photo/actions.ts (2026-07-29)
 * so the mobile-facing /api/identity/from-photo route shares the exact
 * same age math. "use server" files may only export async functions,
 * so this lives here.
 */
export function birthdayForPerceivedAge(
  rolledBirthday: string,
  ageMin: number,
  ageMax: number,
): string {
  const mid = Math.round((ageMin + ageMax) / 2);
  const targetAge = Math.max(25, Math.min(95, mid));
  const monthDay = rolledBirthday.slice(4); // "-MM-DD"
  const currentYear = new Date().getUTCFullYear();
  // Two candidate years bracket the target; pick the one that computes
  // to exactly targetAge given whether the birthday has passed.
  for (const year of [currentYear - targetAge, currentYear - targetAge - 1]) {
    const candidate = `${year}${monthDay}`;
    if (ageFromBirthday(candidate) === targetAge) return candidate;
  }
  return `${currentYear - targetAge}${monthDay}`;
}
