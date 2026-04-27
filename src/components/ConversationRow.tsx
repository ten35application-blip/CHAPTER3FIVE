"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  removeConversation,
  toggleFavorite,
} from "@/app/settings/actions";

type Props = {
  href: string;
  /** Discriminator for the remove server action. */
  removeKind: "owned" | "shared" | "group" | "together";
  removeId: string;
  /** False for kinds the user can't actually remove (beneficiary rooms). */
  removable: boolean;
  /** Same id used for favoriting; usually identical to removeId. */
  favoriteKind: "owned" | "shared" | "group" | "together";
  favoriteId: string;
  isFavorite: boolean;
  language: "en" | "es";
  unread: boolean;
  children: React.ReactNode;
};

const COPY = {
  en: {
    delete: "Delete",
    deleting: "…",
    pin: "Pin",
    unpin: "Unpin",
    confirm:
      "Delete this conversation? Identities go to a 30-day grace window; group rooms are gone.",
  },
  es: {
    delete: "Eliminar",
    deleting: "…",
    pin: "Fijar",
    unpin: "Desfijar",
    confirm:
      "¿Eliminar esta conversación? Las identidades pasan a un periodo de gracia de 30 días; los chats grupales se eliminan.",
  },
};

const REVEAL_THRESHOLD = 70;
const COMMIT_THRESHOLD = 160;
const LONG_PRESS_MS = 450;
const DRAG_TOLERANCE = 8;

/**
 * iMessage-style conversation row.
 *
 * Tap → navigate to href.
 * Swipe LEFT → reveal a red Delete tray on the right. Past commit
 *   threshold + release → confirm + delete in one motion.
 * Long-press → context menu with Pin/Unpin + Delete.
 *
 * The container is a tap target; gestures are layered without
 * fighting each other: the long-press timer cancels if the pointer
 * moves more than DRAG_TOLERANCE (it's becoming a swipe), and the
 * tap is suppressed if either a long-press or a swipe-reveal fired.
 */
export function ConversationRow({
  href,
  removeKind,
  removeId,
  removable,
  favoriteKind,
  favoriteId,
  isFavorite,
  language,
  unread,
  children,
}: Props) {
  const t = COPY[language];
  const [offset, setOffset] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number>(0);
  const lastX = useRef<number>(0);
  const swiping = useRef<boolean>(false);
  const longPressed = useRef<boolean>(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  function clearTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    startY.current = e.clientY;
    lastX.current = e.clientX;
    swiping.current = false;
    longPressed.current = false;
    clearTimer();
    pressTimer.current = setTimeout(() => {
      if (!swiping.current) {
        longPressed.current = true;
        setMenuOpen(true);
      }
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    lastX.current = e.clientX;
    if (
      !swiping.current &&
      (Math.abs(dx) > DRAG_TOLERANCE || Math.abs(dy) > DRAG_TOLERANCE)
    ) {
      // Movement started — cancel the long-press timer either way.
      clearTimer();
      // Only treat as a swipe if we're moving primarily horizontally.
      if (Math.abs(dx) > Math.abs(dy) && removable) {
        swiping.current = true;
      }
    }
    if (swiping.current) {
      const next = Math.min(0, Math.max(-COMMIT_THRESHOLD - 40, dx));
      setOffset(next);
    }
  }

  function onPointerUp() {
    clearTimer();
    if (startX.current === null) return;
    const final = lastX.current - startX.current;
    const wasSwiping = swiping.current;
    startX.current = null;
    swiping.current = false;

    if (!wasSwiping) return;

    if (final <= -COMMIT_THRESHOLD) {
      commitDelete();
      return;
    }
    if (final <= -REVEAL_THRESHOLD) {
      setOffset(-REVEAL_THRESHOLD);
      setRevealed(true);
      return;
    }
    setOffset(0);
    setRevealed(false);
  }

  function onLinkClick(e: React.MouseEvent) {
    // Suppress navigation if we just long-pressed or revealed a tray.
    if (longPressed.current || revealed) {
      e.preventDefault();
      longPressed.current = false;
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    // Right-click as desktop fallback for long-press.
    e.preventDefault();
    setMenuOpen(true);
  }

  function commitDelete() {
    if (deleting) return;
    if (!removable) return;
    if (typeof window !== "undefined" && !window.confirm(t.confirm)) {
      setOffset(0);
      setRevealed(false);
      return;
    }
    setDeleting(true);
    formRef.current?.requestSubmit();
  }

  // Click outside snaps tray + menu closed.
  useEffect(() => {
    if (!revealed && !menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOffset(0);
        setRevealed(false);
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOffset(0);
        setRevealed(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [revealed, menuOpen]);

  return (
    <div ref={wrapRef} className="relative overflow-hidden">
      {/* Hidden form submitted by the swipe / tap. */}
      {removable && (
        <form
          ref={formRef}
          action={removeConversation}
          className="hidden"
        >
          <input type="hidden" name="kind" value={removeKind} />
          <input type="hidden" name="id" value={removeId} />
        </form>
      )}

      {/* Red delete tray sitting under the row, revealed by the swipe. */}
      {removable && (
        <div className="absolute inset-y-0 right-0 flex items-stretch">
          <button
            type="button"
            onClick={commitDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-5 transition-colors disabled:opacity-60"
          >
            {deleting ? t.deleting : t.delete}
          </button>
        </div>
      )}

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={onContextMenu}
        style={{
          transform: `translateX(${offset}px)`,
          transition:
            startX.current === null ? "transform 200ms ease-out" : "none",
          touchAction: "pan-y",
        }}
        className={
          unread
            ? "relative bg-warm-700/15"
            : "relative bg-ink-soft"
        }
      >
        <Link
          href={href}
          onClick={onLinkClick}
          className="block select-none"
        >
          {children}
        </Link>
      </div>

      {/* Long-press / right-click context menu. */}
      {menuOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 rounded-xl border border-warm-300/60 bg-ink-soft shadow-2xl backdrop-blur-xl overflow-hidden min-w-[180px]">
          <form
            action={toggleFavorite}
            onSubmit={() => setMenuOpen(false)}
          >
            <input type="hidden" name="kind" value={favoriteKind} />
            <input type="hidden" name="id" value={favoriteId} />
            <button
              type="submit"
              className="block w-full text-left px-4 py-2.5 text-sm text-warm-50 hover:bg-warm-700/40 transition-colors border-b border-warm-700/40"
            >
              {isFavorite ? t.unpin : t.pin}
            </button>
          </form>
          {removable && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                commitDelete();
              }}
              className="block w-full text-left px-4 py-2.5 text-sm text-red-300 hover:bg-warm-700/40 transition-colors"
            >
              {t.delete}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
