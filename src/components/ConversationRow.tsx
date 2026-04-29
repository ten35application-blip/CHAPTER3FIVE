"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  removeConversation,
  toggleFavorite,
  toggleMute,
  markConversationUnread,
} from "@/app/settings/actions";
import {
  useEditMode,
  EditModeCheckbox,
  type SelectableKey,
} from "./EditMode";

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
  isMuted: boolean;
  language: "en" | "es";
  unread: boolean;
  children: React.ReactNode;
};

type ConfirmKind = "owned" | "shared" | "group" | "together";

const CONFIRMS: Record<"en" | "es", Record<ConfirmKind, string>> = {
  en: {
    owned:
      "Heads up — this isn't just clearing the chat.\n\nYou're deleting the IDENTITY itself: every answer, every message, every photo tied to it. It moves to a 30-day grace window where you can bring it back from /identities. After 30 days it's gone for good.\n\nDelete this identity?",
    together:
      "Heads up — this is the randomized identity itself, not just the conversation.\n\nDeleting it moves the identity to a 30-day grace window. You can restore it from /identities before then. After 30 days it's gone for good.\n\nDelete this identity?",
    group:
      "Delete this group room?\n\nThe room and everything said in it disappears for everyone in it — the identities themselves stay (you'll still see them as separate 1:1 conversations).",
    shared:
      "Drop this shared archive?\n\nYou'll lose access to it, but the archive itself isn't touched — it stays exactly where it is for the person who shared it with you. They won't be told you dropped it.",
  },
  es: {
    owned:
      "Atención — esto no es solo borrar el chat.\n\nEstás eliminando la IDENTIDAD: cada respuesta, cada mensaje, cada foto. Pasa a un periodo de gracia de 30 días desde el cual puedes restaurarla en /identities. Después de 30 días se elimina para siempre.\n\n¿Eliminar esta identidad?",
    together:
      "Atención — esta es la identidad aleatoria misma, no solo el chat.\n\nEliminarla la pone en un periodo de gracia de 30 días. Puedes restaurarla desde /identities antes de eso. Después de 30 días se elimina para siempre.\n\n¿Eliminar esta identidad?",
    group:
      "¿Eliminar este chat grupal?\n\nEl cuarto y todo lo dicho en él desaparece para todos sus miembros — las identidades en sí permanecen (las verás como conversaciones 1:1).",
    shared:
      "¿Salir de este archivo compartido?\n\nPerderás acceso, pero el archivo en sí queda intacto — sigue siendo de la persona que lo compartió contigo. No le avisaremos.",
  },
};

const COPY = {
  en: {
    delete: "Delete",
    deleting: "…",
    pin: "Pin",
    unpin: "Unpin",
    mute: "Hide alerts",
    unmute: "Show alerts",
    markUnread: "Mark as unread",
    markRead: "Mark as read",
  },
  es: {
    delete: "Eliminar",
    deleting: "…",
    pin: "Fijar",
    unpin: "Desfijar",
    mute: "Silenciar",
    unmute: "Activar alertas",
    markUnread: "Marcar como no leído",
    markRead: "Marcar como leído",
  },
};

const REVEAL_THRESHOLD = 70;
const COMMIT_THRESHOLD = 160;
const LONG_PRESS_MS = 450;
const DRAG_TOLERANCE = 8;

/**
 * iMessage / Google-Messages style conversation row.
 *
 * Tap → navigate to href.
 * Swipe LEFT → reveal a red Delete tray on the right. Past commit
 *   threshold + release → confirm + delete in one motion.
 * Swipe RIGHT → reveal an amber Unread tray on the left. Tap or
 *   swipe past commit → mark as unread (clears the read cursor).
 * Long-press / right-click → context menu with Pin/Unpin, Hide
 *   Alerts, Mark Unread, Delete (matches Apple's long-press menu).
 */
export function ConversationRow({
  href,
  removeKind,
  removeId,
  removable,
  favoriteKind,
  favoriteId,
  isFavorite,
  isMuted,
  language,
  unread,
  children,
}: Props) {
  const t = COPY[language];
  const editMode = useEditMode();
  const selectKey = `${favoriteKind}:${favoriteId}` as SelectableKey;
  const [offset, setOffset] = useState(0);
  const [revealedSide, setRevealedSide] = useState<"left" | "right" | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number>(0);
  const lastX = useRef<number>(0);
  const swiping = useRef<boolean>(false);
  const longPressed = useRef<boolean>(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const deleteFormRef = useRef<HTMLFormElement | null>(null);
  const unreadFormRef = useRef<HTMLFormElement | null>(null);

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
      clearTimer();
      if (Math.abs(dx) > Math.abs(dy)) {
        swiping.current = true;
      }
    }
    if (swiping.current) {
      // Allow leftward drag if removable; rightward drag always (mark unread).
      const minOffset = removable ? -COMMIT_THRESHOLD - 40 : 0;
      const maxOffset = COMMIT_THRESHOLD + 40;
      const next = Math.max(minOffset, Math.min(maxOffset, dx));
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

    // Leftward swipe → delete affordance
    if (final <= -COMMIT_THRESHOLD && removable) {
      commitDelete();
      return;
    }
    if (final <= -REVEAL_THRESHOLD && removable) {
      setOffset(-REVEAL_THRESHOLD);
      setRevealedSide("right");
      return;
    }

    // Rightward swipe → mark unread
    if (final >= COMMIT_THRESHOLD) {
      commitMarkUnread();
      return;
    }
    if (final >= REVEAL_THRESHOLD) {
      setOffset(REVEAL_THRESHOLD);
      setRevealedSide("left");
      return;
    }

    setOffset(0);
    setRevealedSide(null);
  }

  function onLinkClick(e: React.MouseEvent) {
    // In edit mode, taps toggle selection instead of navigating.
    if (editMode.active) {
      e.preventDefault();
      editMode.toggle(selectKey);
      return;
    }
    if (longPressed.current || revealedSide !== null) {
      e.preventDefault();
      longPressed.current = false;
    }
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setMenuOpen(true);
  }

  function commitDelete() {
    if (deleting || !removable) return;
    const message = CONFIRMS[language][removeKind];
    if (typeof window !== "undefined" && !window.confirm(message)) {
      setOffset(0);
      setRevealedSide(null);
      return;
    }
    setDeleting(true);
    deleteFormRef.current?.requestSubmit();
  }

  function commitMarkUnread() {
    setOffset(0);
    setRevealedSide(null);
    unreadFormRef.current?.requestSubmit();
  }

  // Click outside / Escape closes everything.
  useEffect(() => {
    if (revealedSide === null && !menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) {
        setOffset(0);
        setRevealedSide(null);
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOffset(0);
        setRevealedSide(null);
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [revealedSide, menuOpen]);

  return (
    <div ref={wrapRef} className="relative overflow-hidden">
      {/* Hidden forms for the actions. */}
      {removable && (
        <form
          ref={deleteFormRef}
          action={removeConversation}
          className="hidden"
        >
          <input type="hidden" name="kind" value={removeKind} />
          <input type="hidden" name="id" value={removeId} />
        </form>
      )}
      <form
        ref={unreadFormRef}
        action={markConversationUnread}
        className="hidden"
      >
        <input type="hidden" name="kind" value={favoriteKind} />
        <input type="hidden" name="id" value={favoriteId} />
      </form>

      {/* Left tray — Mark Unread (swipe right reveals this on the left). */}
      <div className="absolute inset-y-0 left-0 flex items-stretch">
        <button
          type="button"
          onClick={commitMarkUnread}
          className="bg-amber text-ink text-sm font-medium px-5 transition-colors"
        >
          {t.markUnread}
        </button>
      </div>

      {/* Right tray — Delete (swipe left reveals this on the right). */}
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
        className="relative bg-ink-soft"
      >
        <Link
          href={href}
          onClick={onLinkClick}
          className="block select-none relative"
        >
          {/* In edit mode, the checkbox floats over the leftmost
              part of the row. The row content shifts right so the
              checkbox doesn't overlap the avatar. */}
          {editMode.active && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10">
              <EditModeCheckbox selectableKey={selectKey} />
            </div>
          )}
          <div
            style={{
              transform: editMode.active
                ? "translateX(28px)"
                : "translateX(0)",
              transition: "transform 200ms ease-out",
            }}
          >
            {children}
          </div>
        </Link>
      </div>

      {/* Long-press / right-click context menu. */}
      {menuOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-30 rounded-xl border border-warm-300/60 bg-ink-soft shadow-2xl backdrop-blur-xl overflow-hidden min-w-[200px]">
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
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              if (unread) {
                // No "mark as read" action — just opening the conversation
                // does that. Show the message instead.
              } else {
                commitMarkUnread();
              }
            }}
            className="block w-full text-left px-4 py-2.5 text-sm text-warm-50 hover:bg-warm-700/40 transition-colors border-b border-warm-700/40 disabled:opacity-50"
            disabled={unread}
            title={unread ? t.markRead : t.markUnread}
          >
            {t.markUnread}
          </button>
          <form action={toggleMute} onSubmit={() => setMenuOpen(false)}>
            <input type="hidden" name="kind" value={favoriteKind} />
            <input type="hidden" name="id" value={favoriteId} />
            <button
              type="submit"
              className="block w-full text-left px-4 py-2.5 text-sm text-warm-50 hover:bg-warm-700/40 transition-colors border-b border-warm-700/40"
            >
              {isMuted ? t.unmute : t.mute}
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
