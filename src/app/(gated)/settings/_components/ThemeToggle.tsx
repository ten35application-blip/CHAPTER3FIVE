"use client";

import { useEffect, useState } from "react";

/**
 * Three-state theme toggle: Light · Dark · System. Persists the choice
 * to localStorage under key `theme` and applies data-theme on <html>
 * so the CSS variables in globals.css switch immediately. FOUC on hard
 * refresh is prevented by the inline init script in RootLayout — this
 * component is only responsible for USER-DRIVEN changes after load.
 *
 * Applied value vs. stored value:
 *   - stored 'light' → html has no data-theme (default @theme wins)
 *   - stored 'dark'  → html data-theme="dark"
 *   - stored 'system'→ resolves via prefers-color-scheme; we set the
 *                      attribute to match and re-run on OS change
 *
 * Kept in one client component (rather than a Radix Segmented wrapper
 * etc.) so the persisted-state + matchMedia subscription live next to
 * the tap targets that trigger them.
 */
type ThemeChoice = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

function readStored(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* localStorage can throw in Private Mode. */
  }
  return "system";
}

function apply(choice: ThemeChoice): void {
  if (typeof document === "undefined") return;
  const resolved: "light" | "dark" =
    choice === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : choice;
  if (resolved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeToggle() {
  // Start as null → prevents a flash of the wrong tab-highlight before
  // we've read localStorage. First useEffect populates on mount.
  const [choice, setChoice] = useState<ThemeChoice | null>(null);

  useEffect(() => {
    setChoice(readStored());
  }, []);

  // Live-follow the OS setting while the user has "System" selected.
  // Unsubscribes when the user picks Light or Dark explicitly, so we
  // don't clobber their choice if their OS toggles later.
  useEffect(() => {
    if (choice !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => apply("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [choice]);

  function select(next: ThemeChoice) {
    setChoice(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Private Mode again — the UI still updates for this session. */
    }
    apply(next);
  }

  const active = choice ?? "system";

  return (
    <div className="px-4 py-3">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="text-[15px] font-medium text-warm-50">Theme</span>
        <p className="text-xs text-warm-400">
          {active === "system"
            ? "Follows your device"
            : active === "dark"
              ? "Always dark"
              : "Always light"}
        </p>
      </div>
      {/* Segmented control — three equal-width tabs. Uses radiogroup
          semantics so screen readers announce it as a single choice
          picker rather than three unrelated buttons. Neutral inverted
          pill for the active tab (2026-07-27 grouped-list redesign:
          no gradients in settings chrome). */}
      <div
        role="radiogroup"
        aria-label="Theme"
        className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-warm-700 p-1"
      >
        <SegmentButton
          active={active === "light"}
          onClick={() => select("light")}
          label="Light"
          icon={<SunIcon />}
        />
        <SegmentButton
          active={active === "dark"}
          onClick={() => select("dark")}
          label="Dark"
          icon={<MoonIcon />}
        />
        <SegmentButton
          active={active === "system"}
          onClick={() => select("system")}
          label="System"
          icon={<DeviceIcon />}
        />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-warm-400">
        Applies to the whole app.
      </p>
    </div>
  );
}

function SegmentButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-ink-soft text-warm-50 shadow-sm"
          : "text-warm-300 hover:text-warm-50"
      }`}
    >
      <span aria-hidden className="flex h-3.5 w-3.5 items-center justify-center">
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}


function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 18v3" />
    </svg>
  );
}
