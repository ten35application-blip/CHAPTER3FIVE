"use client";

import { useState } from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * Days in a 1-based month. When the year isn't chosen yet, pretend
 * it's a leap year so February offers 29 — if the user then picks a
 * non-leap year, the invalid day is cleared (see below) rather than
 * silently rolled into March by Date's overflow behavior.
 */
function daysInMonth(month1: number, year: number | null): number {
  return new Date(year ?? 2000, month1, 0).getDate();
}

type Props = {
  /** Newest selectable year (currentYear - 18, matching the 18+ gate). */
  maxYear: number;
  /** Oldest selectable year (currentYear - 120, matching the sanity cap). */
  minYear: number;
};

/**
 * Month / Day / Year dropdowns replacing the native date input, which
 * Wilson's testers found too fiddly. Three familiar pickers instead of
 * one dense masked field: no format to guess, and on iOS each select
 * opens the system wheel picker, so it reads as a native app control.
 *
 * The selects themselves are unnamed; a hidden input named
 * `date_of_birth` carries the concatenated YYYY-MM-DD string, so the
 * signUp server action's contract is unchanged (regex, 18+ gate and
 * 120-year cap all still validate server-side). The year list is
 * bounded to [minYear, maxYear] so an under-18 or >120 date can't
 * even be composed client-side — same intent as the old input's
 * `max` attribute, now covering the lower bound too.
 */
export function DobField({ maxYear, minYear }: Props) {
  const [month, setMonth] = useState(""); // "1".."12"
  const [day, setDay] = useState(""); // "1".."31"
  const [year, setYear] = useState(""); // e.g. "1990"

  const monthNum = month ? Number(month) : null;
  const yearNum = year ? Number(year) : null;
  const dayCount = monthNum ? daysInMonth(monthNum, yearNum) : 31;

  /** Clear the day if a month/year change made it impossible (Feb 31…). */
  function keepDayValid(nextMonth: number | null, nextYear: number | null) {
    if (!day) return;
    const limit = nextMonth ? daysInMonth(nextMonth, nextYear) : 31;
    if (Number(day) > limit) setDay("");
  }

  const complete = month !== "" && day !== "" && year !== "";
  const dobValue = complete
    ? `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
    : "";

  const years: number[] = [];
  for (let y = maxYear; y >= minYear; y--) years.push(y);

  const selectClass =
    "h-12 w-full appearance-none rounded-2xl bg-ink-soft pl-4 pr-8 text-base text-warm-50 outline-none ring-1 ring-warm-700 focus:ring-2 focus:ring-coral [&:invalid]:text-warm-400";

  const chevron = (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-warm-400"
    >
      ▾
    </span>
  );

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-warm-200">
        Date of birth
      </legend>
      <div className="grid grid-cols-[1.5fr_1fr_1.2fr] gap-2">
        <div className="relative">
          <select
            aria-label="Birth month"
            autoComplete="bday-month"
            required
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              keepDayValid(
                e.target.value ? Number(e.target.value) : null,
                yearNum,
              );
            }}
            className={selectClass}
          >
            <option value="" disabled>
              Month
            </option>
            {MONTHS.map((name, i) => (
              <option key={name} value={String(i + 1)}>
                {name}
              </option>
            ))}
          </select>
          {chevron}
        </div>

        <div className="relative">
          <select
            aria-label="Birth day"
            autoComplete="bday-day"
            required
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className={selectClass}
          >
            <option value="" disabled>
              Day
            </option>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d)}>
                {d}
              </option>
            ))}
          </select>
          {chevron}
        </div>

        <div className="relative">
          <select
            aria-label="Birth year"
            autoComplete="bday-year"
            required
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              keepDayValid(
                monthNum,
                e.target.value ? Number(e.target.value) : null,
              );
            }}
            className={selectClass}
          >
            <option value="" disabled>
              Year
            </option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
          {chevron}
        </div>
      </div>

      {/* The server action reads only this field. */}
      <input type="hidden" name="date_of_birth" value={dobValue} />

      <span className="text-xs text-warm-400">
        You must be 18 or older to use chapter3five.
      </span>
    </fieldset>
  );
}
