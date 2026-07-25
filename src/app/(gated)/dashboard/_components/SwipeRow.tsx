"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";

type SwipeAction = {
  /** Icon shown in the reveal panel. Kept simple — SVG passed as ReactNode. */
  icon: ReactNode;
  /** Short label shown next to the icon in the reveal panel. */
  label: string;
  /** Background classes for the reveal panel (e.g. gradient or solid). */
  bgClassName: string;
  /** Called when the swipe commits or the reveal panel is tapped. */
  onCommit: () => Promise<{ ok: boolean; error?: string }>;
  /**
   * Set when a successful commit does NOT remove the row from the list
   * (e.g. mark-unread). The row snaps back into view after the action
   * succeeds instead of staying translated off-screen forever.
   */
  restoreOnSuccess?: boolean;
};

type Props = {
  /** The row content (avatar + name + subtitle). Renders on top of reveals. */
  children: ReactNode;
  /** Swipe LEFT reveals a panel on the RIGHT side. */
  leftAction?: SwipeAction;
  /**
   * Secondary action revealed alongside the primary leftAction. Never
   * fires from a full-swipe commit — only from an explicit tap on its
   * button inside the reveal panel. Used to offer a second choice
   * (e.g. Delete alongside Archive) without letting a fast swipe
   * trigger the more destructive option.
   */
  leftSecondaryAction?: SwipeAction;
  /** Swipe RIGHT reveals a panel on the LEFT side. */
  rightAction?: SwipeAction;
  /** Called before commit; if false, the action is aborted (e.g. confirm). */
  confirmLeft?: () => boolean;
  confirmRight?: () => boolean;
  /** Optional confirm gate for the secondary left action's button tap. */
  confirmLeftSecondary?: () => boolean;
};

// Row commits at 40% of its own width. Below that, snap back.
const COMMIT_FRACTION = 0.4;

/**
 * Swipe-to-reveal row for the conversation list and trash list.
 *
 * Uses pointer events (unified touch + mouse). Vertical scroll is
 * preserved: if the initial motion is vertical-dominant, we bail out
 * and let the page scroll. Horizontal-dominant motion captures the
 * pointer and drags the row.
 *
 * On release:
 *   - If dragged past COMMIT_FRACTION and the direction has an action,
 *     the action commits and the row animates fully off-screen.
 *   - Otherwise, the row snaps back to zero.
 *
 * The reveal panel is tappable at any drag position — a light swipe
 * that reveals the panel, then a tap on the panel, also commits.
 */
export function SwipeRow({
  children,
  leftAction,
  leftSecondaryAction,
  rightAction,
  confirmLeft,
  confirmRight,
  confirmLeftSecondary,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dx, setDx] = useState(0);
  const [committed, setCommitted] = useState<null | "left" | "right">(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const captured = useRef(false);
  const cancelled = useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (committed) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    dragging.current = true;
    captured.current = false;
    cancelled.current = false;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    // pointermove fires on plain mouse hover too — only track motion
    // while a press that started on this row is in progress.
    if (!dragging.current || committed || cancelled.current) return;
    const dxRaw = e.clientX - startX.current;
    const dyRaw = e.clientY - startY.current;

    // Once we know the intent, lock it in. Vertical intent = let the
    // page scroll; horizontal intent = capture and drag.
    if (!captured.current) {
      const absX = Math.abs(dxRaw);
      const absY = Math.abs(dyRaw);
      if (absX < 8 && absY < 8) return; // dead zone
      if (absY > absX) {
        cancelled.current = true;
        return;
      }
      captured.current = true;
      wrapRef.current?.setPointerCapture(e.pointerId);
    }

    // Prevent swiping in a direction with no action
    let clamped = dxRaw;
    if (clamped < 0 && !leftAction) clamped = 0;
    if (clamped > 0 && !rightAction) clamped = 0;

    setDx(clamped);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    wrapRef.current?.releasePointerCapture(e.pointerId);
    if (!captured.current || cancelled.current || committed) {
      setDx(0);
      return;
    }
    const width = wrapRef.current?.offsetWidth ?? 320;
    const threshold = width * COMMIT_FRACTION;

    if (dx <= -threshold && leftAction) {
      commit("left");
    } else if (dx >= threshold && rightAction) {
      commit("right");
    } else {
      setDx(0);
    }
  }

  async function commit(dir: "left" | "right") {
    const action = dir === "left" ? leftAction : rightAction;
    const confirm = dir === "left" ? confirmLeft : confirmRight;
    if (!action) return;
    if (confirm && !confirm()) {
      setDx(0);
      return;
    }
    setErrorMsg(null);
    setCommitted(dir);
    setDx(dir === "left" ? -9999 : 9999);
    startTransition(async () => {
      const res = await action.onCommit();
      if (!res.ok) {
        setErrorMsg(res.error ?? "Something went wrong.");
        // Rollback the row so the user can see it again.
        setCommitted(null);
        setDx(0);
        return;
      }
      if (action.restoreOnSuccess) {
        // The row stays in the list (e.g. mark-unread) — bring it back.
        setCommitted(null);
        setDx(0);
      }
      // Otherwise we DON'T restore — the row is gone from the list
      // (parent re-renders after revalidatePath).
    });
  }

  async function commitLeftSecondary() {
    if (!leftSecondaryAction) return;
    if (confirmLeftSecondary && !confirmLeftSecondary()) {
      setDx(0);
      return;
    }
    setErrorMsg(null);
    setCommitted("left");
    setDx(-9999);
    startTransition(async () => {
      const res = await leftSecondaryAction.onCommit();
      if (!res.ok) {
        setErrorMsg(res.error ?? "Something went wrong.");
        setCommitted(null);
        setDx(0);
        return;
      }
      if (leftSecondaryAction.restoreOnSuccess) {
        setCommitted(null);
        setDx(0);
      }
    });
  }

  const showLeftReveal = dx < 0 && leftAction;
  const showRightReveal = dx > 0 && rightAction;

  return (
    <div className="relative overflow-hidden">
      {/* Reveal panels — sit behind the row. Secondary is rendered
          UNDER the primary so as the swipe deepens both remain visible
          side-by-side without either popping in mid-drag. */}
      {leftAction ? (
        <div
          className="absolute inset-y-0 right-0 flex items-stretch justify-end overflow-hidden"
          style={{ width: `${Math.max(0, -dx)}px` }}
          aria-hidden={!showLeftReveal}
        >
          {leftSecondaryAction ? (
            <button
              type="button"
              onClick={commitLeftSecondary}
              className={`flex items-center justify-center px-4 text-white font-semibold ${leftSecondaryAction.bgClassName}`}
            >
              <span className="flex items-center gap-2">
                <span className="opacity-90">{leftSecondaryAction.icon}</span>
                <span className="hidden sm:inline">
                  {leftSecondaryAction.label}
                </span>
              </span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => commit("left")}
            className={`flex items-center justify-center px-6 text-white font-semibold ${leftAction.bgClassName}`}
          >
            <span className="flex items-center gap-2">
              <span className="opacity-90">{leftAction.icon}</span>
              <span className="hidden sm:inline">{leftAction.label}</span>
            </span>
          </button>
        </div>
      ) : null}
      {rightAction ? (
        <div
          className={`absolute inset-y-0 left-0 flex items-center justify-start pl-6 ${rightAction.bgClassName}`}
          style={{ width: `${Math.max(0, dx)}px` }}
          aria-hidden={!showRightReveal}
        >
          <button
            type="button"
            onClick={() => commit("right")}
            className="flex items-center gap-2 text-white font-semibold"
          >
            <span className="opacity-90">{rightAction.icon}</span>
            <span className="hidden sm:inline">{rightAction.label}</span>
          </button>
        </div>
      ) : null}

      {/* The row itself — sliding surface */}
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translate3d(${dx}px, 0, 0)`,
          transition: dx === 0 || committed ? "transform 200ms ease-out" : "none",
          touchAction: "pan-y", // let vertical scrolling through
        }}
        className="relative bg-ink-soft"
      >
        {children}
      </div>

      {errorMsg ? (
        <div
          role="alert"
          className="absolute inset-x-0 bottom-0 bg-coral/10 px-4 py-1 text-xs text-coral-strong"
        >
          {errorMsg}
        </div>
      ) : null}
    </div>
  );
}
