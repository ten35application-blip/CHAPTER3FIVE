"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "../users/[id]/actions";

/**
 * Small client wrapper for admin server actions. Pass a pre-bound server
 * action; optional `confirm` text inserts a confirmation modal before the
 * action fires (used for the destructive ones). The returned message is
 * shown inline.
 */
export function ActionButton({
  label,
  action,
  confirm,
  danger = false,
}: {
  label: string;
  action: () => Promise<ActionResult>;
  /** If set, a modal with this text must be confirmed first. */
  confirm?: string;
  danger?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function run() {
    setConfirming(false);
    startTransition(async () => {
      const result = await action();
      setMessage(result.message);
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => (confirm ? setConfirming(true) : run())}
        className={
          danger
            ? "rounded-full px-4 py-1.5 text-sm font-semibold text-coral-strong ring-1 ring-coral/40 transition-colors hover:bg-coral/10 disabled:opacity-50"
            : "rounded-full px-4 py-1.5 text-sm font-medium text-warm-200 ring-1 ring-warm-700 transition-colors hover:bg-warm-700/40 disabled:opacity-50"
        }
      >
        {pending ? "Working…" : label}
      </button>
      {message ? <span className="text-xs text-warm-300">{message}</span> : null}

      {confirming ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-warm-50/30 px-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-3xl bg-ink-soft p-6 shadow-[0_24px_60px_-20px_rgba(28,28,26,0.35)] ring-1 ring-warm-700">
            <p className="text-base font-semibold text-warm-50">Are you sure?</p>
            <p className="mt-2 text-sm leading-relaxed text-warm-300">{confirm}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-11 flex-1 rounded-full text-sm font-medium text-warm-200 ring-1 ring-warm-700 transition-colors hover:bg-warm-700/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={run}
                className="bg-gradient-cta h-11 flex-1 rounded-full text-sm font-semibold text-white transition-all hover:-translate-y-px active:opacity-90"
              >
                {label}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
}
