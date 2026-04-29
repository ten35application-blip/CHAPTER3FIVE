"use client";

import { useEffect, useState } from "react";

type Props = {
  language: "en" | "es";
  /** All searchable terms in the dom — passed as data attributes
      on each row so we can filter without lifting state. The component
      grabs the [data-conv-search] elements and toggles their visibility
      based on the query. */
};

const COPY = {
  en: { placeholder: "Search", clear: "Clear" },
  es: { placeholder: "Buscar", clear: "Limpiar" },
};

/**
 * Slim iMessage-style search bar at the top of the dashboard list.
 * Filters in-place by toggling display on rows that have a
 * data-conv-search attribute matching the query (case-insensitive,
 * substring match). No backend round-trip; everything renders
 * server-side, this just hides what doesn't match.
 *
 * Empty query → everything visible.
 */
export function ConversationSearch({ language }: Props) {
  const t = COPY[language];
  const [q, setQ] = useState("");

  useEffect(() => {
    const needle = q.trim().toLowerCase();
    const rows = document.querySelectorAll<HTMLElement>("[data-conv-search]");
    if (!needle) {
      for (const r of rows) r.style.display = "";
      return;
    }
    for (const r of rows) {
      const haystack = (r.dataset.convSearch ?? "").toLowerCase();
      r.style.display = haystack.includes(needle) ? "" : "none";
    }
  }, [q]);

  return (
    <div className="relative mb-3">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.placeholder}
        className="w-full h-10 rounded-full bg-warm-700/40 border border-warm-700/60 pl-10 pr-10 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
      />
      <svg
        viewBox="0 0 20 20"
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 pointer-events-none"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="9" cy="9" r="6" />
        <line x1="13.5" y1="13.5" x2="17" y2="17" />
      </svg>
      {q && (
        <button
          type="button"
          onClick={() => setQ("")}
          aria-label={t.clear}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-warm-700/60 text-warm-200 hover:text-warm-50 transition-colors flex items-center justify-center text-xs leading-none"
        >
          ×
        </button>
      )}
    </div>
  );
}
