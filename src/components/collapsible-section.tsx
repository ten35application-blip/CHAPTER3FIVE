"use client";

import { useEffect, useState, type ReactNode } from "react";

type Props = {
  /**
   * sessionStorage key used to persist the open/closed state across
   * in-session navigation. Different callsites MUST use different keys —
   * e.g. `hub.deleted.messages`, `settings.how-this-works`.
   */
  storageKey: string;
  label: string;
  /** Optional count/hint shown after the label (e.g. row count). */
  count?: number;
  /** Optional hint chip shown when `count` is not appropriate. */
  hint?: string;
  /** Defaults to true — first-time users see the section expanded. */
  defaultOpen?: boolean;
  /**
   * If true, the header row sticks to the top of its scrolling parent
   * (used inside the Hub sheet's scrolling panel). Off by default so
   * settings-page sections don't stick as the page scrolls.
   */
  sticky?: boolean;
  children: ReactNode;
};

/**
 * Shared collapsible-section shell. Header row is a chevron + label +
 * optional count/hint, tap to toggle. State is persisted per-key to
 * sessionStorage so a within-session preference survives navigation
 * without polluting long-term storage.
 *
 * Extracted from HubSheet's local implementation so /settings and the
 * hub sheet can share one component. Kept in `src/components/` since
 * it's brand-neutral and independent of any route.
 *
 * Hydration: the initial render always mirrors `defaultOpen` so SSR
 * markup matches the first client render — sessionStorage is read in
 * an effect after mount, then the panel snaps to the persisted state
 * without warning React.
 */
export function CollapsibleSection({
  storageKey,
  label,
  count,
  hint,
  defaultOpen = true,
  sticky = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (raw === "0") setOpen(false);
      else if (raw === "1") setOpen(true);
    } catch {
      // sessionStorage unavailable (private tab, quota) — keep default.
    }
    // Only run once per storageKey mount; the write-back effect below
    // handles subsequent toggles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    try {
      window.sessionStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [storageKey, open]);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={
          sticky
            ? "sticky top-0 z-[1] flex w-full items-center gap-2 bg-ink-soft/95 px-4 py-2 text-left backdrop-blur transition-colors hover:bg-warm-800/20"
            : "flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-warm-800/20"
        }
      >
        <SectionChevron open={open} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-warm-400">
          {label}
        </span>
        {typeof count === "number" ? (
          <span className="ml-1 text-[11px] font-semibold text-warm-500">
            {count}
          </span>
        ) : null}
        {hint ? (
          <span className="ml-1 text-[11px] font-medium text-warm-500">
            {hint}
          </span>
        ) : null}
      </button>
      {open ? children : null}
    </section>
  );
}

function SectionChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={
        open
          ? "text-warm-400 transition-transform duration-150"
          : "-rotate-90 text-warm-400 transition-transform duration-150"
      }
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
