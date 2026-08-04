"use client";

import { useEffect, useState } from "react";

/**
 * App-wide text size — the web twin of mobile's Settings → Appearance →
 * Text size (Wilson 2026-08-04: "so the text can go a little smaller and
 * a little bigger for the people who have a hard time reading smaller
 * words").
 *
 * Mobile multiplies every declared fontSize through a Text wrapper. Web
 * gets the same result for free from the cascade: Tailwind's type scale
 * is in `rem`, so scaling the root font-size scales every piece of text
 * in the app proportionally, and the existing hierarchy is preserved
 * exactly. Same four stops, same multipliers, same labels as mobile.
 *
 * Stored in localStorage rather than the database, matching how the
 * theme choice works here — it's a per-device rendering preference, and
 * a reader who wants big type on their phone doesn't necessarily want it
 * on a desktop monitor. The inline script in the root layout applies it
 * before first paint so there's no flash-and-jump on load.
 *
 * Note this multiplies the BROWSER's own base size rather than
 * overriding it: a user who has already set a large default in their
 * browser keeps that, and this compounds on top — the same
 * composes-with-the-platform behavior as mobile's relationship to iOS
 * Dynamic Type.
 */

export type TextSizeChoice = "small" | "default" | "large" | "larger";

export const TEXT_SIZE_KEY = "textSize";

export const TEXT_SIZE_SCALES: Record<TextSizeChoice, number> = {
  small: 0.9,
  default: 1,
  large: 1.15,
  larger: 1.3,
};

const LABELS: Record<TextSizeChoice, string> = {
  small: "Smaller",
  default: "Standard",
  large: "Larger",
  larger: "Largest",
};

function readStored(): TextSizeChoice {
  if (typeof window === "undefined") return "default";
  try {
    const raw = window.localStorage.getItem(TEXT_SIZE_KEY);
    if (raw === "small" || raw === "default" || raw === "large" || raw === "larger") {
      return raw;
    }
  } catch {
    /* localStorage throws in Private Mode */
  }
  return "default";
}

function apply(choice: TextSizeChoice): void {
  if (typeof document === "undefined") return;
  const scale = TEXT_SIZE_SCALES[choice] ?? 1;
  // Percentage, not px — this multiplies whatever base size the user's
  // browser is set to instead of replacing it, so someone who already
  // enlarged their default keeps it.
  document.documentElement.style.fontSize =
    scale === 1 ? "" : `${scale * 100}%`;
}

export function TextSizeControl() {
  // null until mounted so the segmented highlight doesn't flash the
  // wrong tab before localStorage has been read.
  const [choice, setChoice] = useState<TextSizeChoice | null>(null);

  useEffect(() => {
    setChoice(readStored());
  }, []);

  function select(next: TextSizeChoice) {
    setChoice(next);
    try {
      window.localStorage.setItem(TEXT_SIZE_KEY, next);
    } catch {
      /* Private Mode — still applies for this session */
    }
    apply(next);
  }

  const active = choice ?? "default";

  return (
    <div className="px-4 py-3">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="text-[15px] font-medium text-warm-50">Text size</span>
        <p className="text-xs text-warm-400">{LABELS[active]}</p>
      </div>
      <div
        role="radiogroup"
        aria-label="Text size"
        className="mt-2.5 grid grid-cols-4 gap-1 rounded-lg bg-warm-700 p-1"
      >
        {(Object.keys(TEXT_SIZE_SCALES) as TextSizeChoice[]).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active === key}
            onClick={() => select(key)}
            className={`rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
              active === key
                ? "bg-ink-soft text-warm-50 shadow-sm"
                : "text-warm-300 hover:text-warm-50"
            }`}
          >
            {key === "small"
              ? "Small"
              : key === "default"
                ? "Default"
                : key === "large"
                  ? "Large"
                  : "Largest"}
          </button>
        ))}
      </div>
      {/* Preview renders at the chosen size — the choice should be
          legible before you commit to it. */}
      <p className="mt-2.5 text-[15px] leading-[21px] text-warm-300">
        The quick brown fox jumps over the lazy dog.
      </p>
      <p className="mt-1.5 text-[11px] leading-4 text-warm-400">
        Applies everywhere on the web app, on top of your browser&rsquo;s own
        text size.
      </p>
    </div>
  );
}
