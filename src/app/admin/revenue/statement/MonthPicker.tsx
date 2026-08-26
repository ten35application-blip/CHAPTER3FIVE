"use client";

import { useRouter } from "next/navigation";

/** THE PICKER (Wilson 2026-08-26: "show all the months and we can
 *  check off which ones we want — press year and boom"). Chips for
 *  every month since launch, grouped by year; the year chip selects
 *  or clears its whole year in one press. Selection lives in the URL
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

  function toggleYear(year: string, months: string[]) {
    const allOn = months.every((m) => selected.includes(m));
    apply(
      allOn
        ? selected.filter((m) => !months.includes(m))
        : [...new Set([...selected, ...months])],
    );
  }

  const years = [...new Set(available.map((m) => m.slice(0, 4)))];

  return (
    <div className="flex flex-col gap-3 print:hidden">
      {years.map((year) => {
        const months = available.filter((m) => m.startsWith(year));
        const allOn = months.every((m) => selected.includes(m));
        return (
          <div key={year} className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleYear(year, months)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                allOn
                  ? "bg-teal-strong text-white"
                  : "bg-ink-soft text-warm-100 ring-1 ring-warm-700 hover:bg-ink"
              }`}
            >
              {year} — all
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
