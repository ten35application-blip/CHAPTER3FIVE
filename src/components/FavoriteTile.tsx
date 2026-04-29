"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toggleFavorite } from "@/app/settings/actions";

type Props = {
  href: string;
  title: string;
  /** Storage id used for favoriting (oracle id, room id, etc). */
  favoriteId: string;
  /** Bucket the favorites store uses. */
  favoriteKind: "owned" | "shared" | "group" | "together";
  language: "en" | "es";
  /** New activity since the user last opened this conversation. */
  unread?: boolean;
  /** Last assistant-message snippet (max ~80 chars). When provided
      and the row is unread, renders as a small bubble above the
      avatar — same idea as iMessage's latest-message overlay on
      pinned bubbles. */
  preview?: string | null;
  children: React.ReactNode;
};

const COPY = {
  en: { unfavorite: "Unfavorite", cancel: "Cancel" },
  es: { unfavorite: "Quitar de favoritos", cancel: "Cancelar" },
};

const LONG_PRESS_MS = 450;

/**
 * Favorited conversation tile in the dashboard's pinned strip.
 * Tap to navigate. Long-press (or right-click) opens a small popover
 * with one option: Unfavorite. Removes the redundant always-on star
 * button from the list-row level — once pinned, the only way back
 * down is the long-press here.
 */
export function FavoriteTile({
  href,
  title,
  favoriteId,
  favoriteKind,
  language,
  unread = false,
  preview = null,
  children,
}: Props) {
  const t = COPY[language];
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  function startPress() {
    longPressed.current = false;
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setMenuOpen(true);
    }, LONG_PRESS_MS);
  }

  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function onClick(e: React.MouseEvent) {
    // Suppress navigation if a long-press just fired.
    if (longPressed.current) {
      e.preventDefault();
      longPressed.current = false;
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuOpen(true);
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Truncate the preview to ~50 chars for the floating bubble.
  // Skip if there's no preview to show.
  const previewText = preview
    ? preview.length > 50
      ? preview.slice(0, 50).trimEnd() + "…"
      : preview
    : null;

  return (
    <div ref={wrapRef} className="relative">
      <Link
        href={href}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onPointerDown={startPress}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        className="flex flex-col items-center w-20 flex-shrink-0 group select-none relative"
        title={title}
      >
        {/* Floating last-message bubble above the tile. Twist on
            iMessage's iconic pinned-bubble: rounded with a subtle
            tail pointing down toward the avatar, in our warm-50/ink
            colors instead of Apple's gray. Only renders when there's
            unread activity AND a preview to surface — read tiles
            stay clean. */}
        {unread && previewText && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            style={{ bottom: "calc(100% + 4px)" }}
          >
            <div className="relative">
              <div className="bg-warm-50 text-ink text-[11px] leading-snug px-3 py-1.5 rounded-2xl shadow-md max-w-[160px] whitespace-normal text-left">
                {previewText}
              </div>
              {/* Tail — small triangle aligned to the avatar. */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-warm-50 rotate-45 -mt-1" />
            </div>
          </div>
        )}

        {/* Amber unread dot on the top-right of the avatar. */}
        {unread && (
          <span
            className="absolute top-0 right-1 w-3 h-3 rounded-full bg-amber border-2 border-ink-soft z-10"
            aria-label="unread"
          />
        )}
        {children}
      </Link>

      {menuOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 rounded-xl border border-warm-300/60 bg-ink-soft shadow-2xl backdrop-blur-xl overflow-hidden min-w-[160px]">
          <form
            action={toggleFavorite}
            onSubmit={() => setMenuOpen(false)}
          >
            <input type="hidden" name="kind" value={favoriteKind} />
            <input type="hidden" name="id" value={favoriteId} />
            <button
              type="submit"
              className="block w-full text-left px-4 py-2.5 text-sm text-warm-50 hover:bg-warm-700/40 transition-colors"
            >
              {t.unfavorite}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
