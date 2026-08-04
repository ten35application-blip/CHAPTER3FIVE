"use client";

import { useState, useTransition } from "react";

import { setOutreachEnabled } from "../actions";

/**
 * Account-level notification switch.
 *
 * Writes `profiles.outreach_enabled`, the column every outreach cron
 * filters on — so OFF means a persona never composes an unprompted
 * message in the first place, not that one is written and silently
 * dropped. Wilson 2026-08-03: both surfaces must expose this, and they
 * must match; the mobile twin is the "Messages from your identities"
 * row in app/settings.tsx.
 *
 * Optimistic: the switch flips immediately and rolls back if the server
 * action fails, so a flaky connection can never leave the UI claiming a
 * preference the database doesn't hold.
 */
export function NotificationsToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    const previous = enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const res = await setOutreachEnabled(next);
      if (!res.ok) {
        setEnabled(previous);
        setError(res.error);
      }
    });
  }

  return (
    <div className="px-4 py-3">
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="text-[15px] font-medium text-warm-50">
          Messages from your identities
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Messages from your identities"
          onClick={toggle}
          disabled={pending}
          className={`relative h-[31px] w-[51px] flex-shrink-0 rounded-full transition-colors disabled:opacity-60 ${
            enabled ? "bg-teal-strong" : "bg-warm-600"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-sm transition-[left] ${
              enabled ? "left-[22px]" : "left-[2px]"
            }`}
          />
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-warm-400">
        {enabled
          ? "They can reach out first — a check-in, a memory, an old story coming back up."
          : "They'll only reply when you write to them first."}
      </p>
      {error ? (
        <p className="mt-1.5 text-[11px] leading-4 text-red-500">{error}</p>
      ) : null}
    </div>
  );
}
