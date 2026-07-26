"use client";

import { useEffect, useRef, useState } from "react";
import {
  REACTION_KINDS,
  REPORT_REASONS,
  type ReactionKind,
  type ReportReason,
} from "@/lib/reactions";

/**
 * iMessage-style tapback popover + report modal.
 *
 * The parent owns the "which message is targeted" state (anchoring the
 * popover to the correct bubble). This component renders the popover +
 * report modal and calls the two callbacks for wire-up. Reactions are
 * a single tap; report is a two-step (menu → reason picker) to prevent
 * accidental reports.
 */

export type MessageActionsProps = {
  /** Anchor rect from the parent's long-press event — the popover
   *  positions itself just above this rect. */
  anchor: DOMRect;
  /** Current user-side reaction on this message (null if none). */
  currentReaction: ReactionKind | null;
  onReact: (kind: ReactionKind) => void;
  onReport: (reason: ReportReason, notes: string) => Promise<void> | void;
  onClose: () => void;
};

export function MessageActions({
  anchor,
  currentReaction,
  onReact,
  onReport,
  onClose,
}: MessageActionsProps) {
  const [showReport, setShowReport] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Position: center horizontally over the bubble; sit just above.
  // Constrained so it never leaves the viewport.
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 320;
  const popoverWidth = 288;
  const popoverHeight = 60;
  const centerX = anchor.left + anchor.width / 2;
  const leftUnclamped = centerX - popoverWidth / 2;
  const left = Math.max(12, Math.min(viewportW - popoverWidth - 12, leftUnclamped));
  const top = Math.max(12, anchor.top - popoverHeight - 12);

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Message actions"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0"
      />

      {showReport ? (
        <ReportPanel
          onSubmit={async (reason, notes) => {
            await onReport(reason, notes);
            onClose();
          }}
          onBack={() => setShowReport(false)}
          onClose={onClose}
        />
      ) : (
        <div
          ref={rootRef}
          className="animate-popover-in absolute flex items-center gap-1 rounded-full bg-ink-soft px-2 py-2 shadow-[0_20px_48px_-10px_rgba(28,28,26,0.28)] ring-1 ring-warm-700/60"
          style={{ top, left, width: popoverWidth }}
        >
          {REACTION_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                onReact(kind);
                onClose();
              }}
              aria-label={REACTION_LABELS[kind]}
              aria-pressed={currentReaction === kind}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                currentReaction === kind
                  ? "bg-coral/15 text-coral-strong"
                  : "text-warm-300 hover:bg-warm-700/40 hover:text-warm-50"
              }`}
            >
              <ReactionIcon kind={kind} className="h-5 w-5" />
            </button>
          ))}
          <span className="mx-1 h-6 w-px bg-warm-700/60" aria-hidden />
          <button
            type="button"
            onClick={() => setShowReport(true)}
            aria-label="Report message"
            className="flex h-9 w-9 items-center justify-center rounded-full text-warm-300 transition-colors hover:bg-coral/10 hover:text-coral-strong"
          >
            <FlagIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ReportPanel({
  onSubmit,
  onBack,
  onClose,
}: {
  onSubmit: (reason: ReportReason, notes: string) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>("inappropriate");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="absolute inset-x-4 top-1/2 mx-auto max-w-md -translate-y-1/2 rounded-3xl bg-ink-soft p-6 shadow-[0_24px_60px_-16px_rgba(28,28,26,0.28)] ring-1 ring-warm-700/60 sm:inset-x-auto sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
      <h2 className="text-lg font-bold text-warm-50">Report this message</h2>
      <p className="mt-2 text-sm leading-relaxed text-warm-300">
        Reports go to our moderation team. Please tell us what&rsquo;s
        wrong.
      </p>

      <fieldset className="mt-5 flex flex-col gap-2">
        <legend className="sr-only">Reason</legend>
        {REPORT_REASONS.map((r) => (
          <label
            key={r.value}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
              reason === r.value
                ? "bg-coral/10 text-coral-strong ring-1 ring-coral/25"
                : "text-warm-100 hover:bg-warm-700/30"
            }`}
          >
            <input
              type="radio"
              name="reason"
              value={r.value}
              checked={reason === r.value}
              onChange={() => setReason(r.value)}
              className="sr-only"
            />
            <span className="flex h-4 w-4 items-center justify-center rounded-full ring-1 ring-warm-500">
              {reason === r.value ? (
                <span className="h-2 w-2 rounded-full bg-coral-strong" />
              ) : null}
            </span>
            <span>{r.label}</span>
          </label>
        ))}
      </fieldset>

      <label className="mt-5 block">
        <span className="text-xs font-medium uppercase tracking-wider text-warm-400">
          Details (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
          className="mt-2 w-full resize-none rounded-xl bg-warm-700/30 px-3 py-2 text-sm text-warm-50 placeholder:text-warm-400 focus:outline-none focus:ring-1 focus:ring-coral/40"
          placeholder="Anything else our team should know?"
        />
      </label>

      {err ? (
        <p role="alert" className="mt-3 text-sm text-coral-strong">
          {err}
        </p>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-full px-4 py-2 text-sm font-medium text-warm-300 transition-colors hover:text-warm-50 disabled:opacity-60"
        >
          Back
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-full px-4 py-2 text-sm font-medium text-warm-200 transition-colors hover:text-warm-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={async () => {
              setErr(null);
              setSubmitting(true);
              try {
                await onSubmit(reason, notes.trim());
              } catch (e) {
                setErr(
                  e instanceof Error ? e.message : "Something went wrong.",
                );
                setSubmitting(false);
              }
            }}
            className="bg-gradient-cta rounded-full px-5 py-2 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(232,138,118,0.55)] transition-all hover:-translate-y-px disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}

const REACTION_LABELS: Record<ReactionKind, string> = {
  heart: "Heart",
  exclamation: "Emphasize",
  thumbs_up: "Like",
  thumbs_down: "Dislike",
  question: "Question",
  ha_ha: "Laugh",
};

export function ReactionIcon({
  kind,
  className,
}: {
  kind: ReactionKind;
  className?: string;
}) {
  switch (kind) {
    case "heart":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M12 21s-7.5-4.6-9.6-9.4C.9 8.1 2.6 4.5 6 4.5c2 0 3.3 1 4 2.2C10.7 5.5 12 4.5 14 4.5c3.4 0 5.1 3.6 3.6 7.1C19.5 16.4 12 21 12 21z" />
        </svg>
      );
    case "exclamation":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M11 3h2v11h-2zM11 17h2v3h-2z" />
        </svg>
      );
    case "thumbs_up":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M2 10h4v11H2zM8 10l4-8c1.5 0 2.5 1 2.5 2.5V9h5c1.4 0 2.5 1.1 2.5 2.5l-2 8c-.3 1.2-1.3 1.5-2.5 1.5H8V10z" />
        </svg>
      );
    case "thumbs_down":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M2 3h4v11H2zM8 14l4 8c1.5 0 2.5-1 2.5-2.5V15h5c1.4 0 2.5-1.1 2.5-2.5l-2-8C19.7 3.3 18.7 3 17.5 3H8v11z" />
        </svg>
      );
    case "question":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M12 4c-3 0-5 2-5 4.5h2.5C9.5 7.1 10.6 6 12 6s2.5 1 2.5 2.2c0 .8-.4 1.3-1.3 2-1.4 1-2.2 1.9-2.2 3.8v.5h2.5v-.5c0-1 .3-1.5 1.4-2.3 1.4-1 2.1-2 2.1-3.6C17 5.9 14.9 4 12 4zM11 17h2v3h-2z" />
        </svg>
      );
    case "ha_ha":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <path d="M8.5 9v.5M15.5 9v.5" />
        </svg>
      );
  }
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 21V4h13l-2 4 2 4H4" />
    </svg>
  );
}
