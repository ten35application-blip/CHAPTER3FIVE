"use client";

import { useEffect, useState } from "react";

/**
 * App-wide text size — the web twin of mobile's Settings → Appearance →
 * Text size.
 *
 * A SLIDER, not fixed stops (Wilson 2026-08-04: "I'd rather you be able
 * to scroll left and right on the text size and see it growing and
 * getting smaller in the settings"). The page resizes live under the
 * thumb, which is the entire point — for the reader this exists for,
 * seeing it beats reading a label that says "Large".
 *
 * Mobile multiplies every declared fontSize through a Text wrapper. Web
 * gets the same result from the cascade: Tailwind's type scale is in
 * `rem`, so scaling the root font-size scales every piece of text
 * proportionally and the existing hierarchy is preserved exactly. Same
 * 0.85–1.4 range as mobile.
 *
 * Stored per-device in localStorage, like the theme choice — someone who
 * wants large type on their phone doesn't necessarily want it on a
 * desktop monitor. The inline script in the root layout applies it
 * before first paint so there's no flash-and-jump on load.
 *
 * Set as a PERCENTAGE rather than px so it multiplies the browser's own
 * base size instead of replacing it: a reader who already enlarged their
 * browser default keeps it and this compounds on top — the same
 * composes-with-the-platform behavior as mobile's relationship to iOS
 * Dynamic Type.
 */

export const TEXT_SIZE_KEY = "textSize";

export const MIN_SCALE = 0.85;
export const MAX_SCALE = 1.4;
const DEFAULT_SCALE = 1;

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function describeScale(value: number): string {
  if (value < 0.95) return "Smaller";
  if (value < 1.05) return "Standard";
  if (value < 1.2) return "Larger";
  return "Largest";
}

function readStored(): number {
  if (typeof window === "undefined") return DEFAULT_SCALE;
  try {
    const raw = window.localStorage.getItem(TEXT_SIZE_KEY);
    if (raw !== null) {
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed)) return clampScale(parsed);
    }
  } catch {
    /* localStorage throws in Private Mode */
  }
  return DEFAULT_SCALE;
}

function apply(scale: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize =
    scale === 1 ? "" : `${clampScale(scale) * 100}%`;
}

export function TextSizeControl() {
  // null until mounted so the slider doesn't render at the wrong
  // position before localStorage has been read (and so SSR and the
  // first client render agree).
  const [scale, setScale] = useState<number | null>(null);

  useEffect(() => {
    setScale(readStored());
  }, []);

  function onChange(next: number) {
    const clamped = clampScale(next);
    setScale(clamped);
    // Live: the page resizes as the thumb moves.
    apply(clamped);
    try {
      window.localStorage.setItem(TEXT_SIZE_KEY, String(clamped));
    } catch {
      /* Private Mode — still applies for this session */
    }
  }

  const value = scale ?? DEFAULT_SCALE;

  return (
    <div className="px-4 py-3">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="text-[15px] font-medium text-warm-50">Text size</span>
        <p className="text-xs text-warm-400">{describeScale(value)}</p>
      </div>

      {/* Small A / large A on either side, the way iOS and every
          reading app mark this control. */}
      <div className="mt-3.5 flex items-center gap-3">
        <span aria-hidden className="text-[13px] font-semibold text-warm-400">
          A
        </span>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.01}
          value={value}
          onChange={(e) => onChange(Number.parseFloat(e.target.value))}
          aria-label="Text size"
          aria-valuetext={describeScale(value)}
          className="h-9 flex-1 cursor-pointer accent-teal-strong"
        />
        <span aria-hidden className="text-[21px] font-semibold text-warm-400">
          A
        </span>
      </div>

      {/* Preview. Sized in rem so it rides the same root scale as the
          rest of the app and resizes under the thumb. */}
      <p className="mt-3 text-warm-200" style={{ fontSize: "0.9375rem", lineHeight: 1.4 }}>
        Some evenings you just want to hear their voice again.
      </p>
      <p className="mt-1.5 text-[11px] leading-4 text-warm-400">
        Applies everywhere on the web app, on top of your browser&rsquo;s own
        text size.
      </p>
    </div>
  );
}
