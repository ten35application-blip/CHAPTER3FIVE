"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** THE PICKER (Wilson 2026-08-26: "show all the months and we can
 *  check off which ones we want — press year and boom", and the next
 *  day's refinement: past years COLLAPSE under their year header).
 *  The current year starts open; older years fold to a single row
 *  until tapped (▸ 2026). "All" beside each year checks or clears its
 *  whole year in one press. Selection lives in the URL
 *  (?months=2026-08,2026-09) so the server renders one statement
 *  sheet per checked month and Print binds them into one document. */

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function chipLabel(key: string): string {
  const m = Number.parseInt(key.slice(5), 10);
  return MONTH_NAMES[m - 1] ?? key;
}

export function MonthPicker({
  available,
  selected,
}: {
  available: string[]; // "YYYY-MM", ascending, launch → current
  selected: string[];
}) {
  const router = useRouter();
  const years = [...new Set(available.map((m) => m.slice(0, 4)))];
  const currentYear = available[available.length - 1]?.slice(0, 4);
  // Open: the current year, plus any year that already has a checked
  // month (so a link into old months never hides its own selection).
  const [openYears, setOpenYears] = useState<string[]>(() => [
    ...new Set([
      ...(currentYear ? [currentYear] : []),
      ...selected.map((m) => m.slice(0, 4)),
    ]),
  ]);

  function apply(next: string[]) {
    const list = next.length > 0 ? next : [available[available.length - 1]];
    router.replace(
      `/admin/revenue/statement?months=${list.sort().join(",")}`,
      { scroll: false },
    );
  }

  function toggleMonth(m: string) {
    apply(
      selected.includes(m)
        ? selected.filter((x) => x !== m)
        : [...selected, m],
    );
  }

  function toggleYearAll(months: string[]) {
    const allOn = months.every((m) => selected.includes(m));
    apply(
      allOn
        ? selected.filter((m) => !months.includes(m))
        : [...new Set([...selected, ...months])],
    );
  }

  return (
    <div className="flex flex-col gap-3 print:hidden">
      {years.map((year) => {
        const months = available.filter((m) => m.startsWith(year));
        const allOn = months.every((m) => selected.includes(m));
        const checkedCount = months.filter((m) => selected.includes(m)).length;
        const open = openYears.includes(year);
        return (
          <div key={year} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setOpenYears((y) =>
                  y.includes(year) ? y.filter((x) => x !== year) : [...y, year],
                )
              }
              className="flex items-center gap-1.5 rounded-full bg-ink-soft px-4 py-1.5 text-sm font-bold text-warm-100 ring-1 ring-warm-700 transition-colors hover:bg-ink"
            >
              <span
                className={`inline-block text-teal-strong transition-transform ${open ? "rotate-90" : ""}`}
              >
                ›
              </span>
              {year}
              {!open && checkedCount > 0 ? (
                <span className="text-xs font-semibold text-teal-strong">
                  · {checkedCount} checked
                </span>
              ) : null}
            </button>
            {open ? (
              <>
                <button
                  type="button"
                  onClick={() => toggleYearAll(months)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors ${
                    allOn
                      ? "bg-teal-strong text-white"
                      : "bg-ink-soft text-warm-100 ring-1 ring-warm-700 hover:bg-ink"
                  }`}
                >
                  All
                </button>
                {months.map((m) => {
                  const on = selected.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMonth(m)}
                      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                        on
                          ? "bg-teal-strong text-white"
                          : "bg-ink-soft text-warm-200 ring-1 ring-warm-700 hover:bg-ink"
                      }`}
                    >
                      {chipLabel(m)}
                    </button>
                  );
                })}
              </>
            ) : null}
          </div>
        );
      })}
      <p className="text-xs text-warm-400">
        Every checked month becomes its own page — Print / Save as PDF binds
        them into one document for the accountant.
      </p>
    </div>
  );
}
