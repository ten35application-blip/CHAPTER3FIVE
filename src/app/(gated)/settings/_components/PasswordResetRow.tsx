"use client";

import { useState, useTransition } from "react";
import { sendPasswordResetEmail } from "../actions";

/**
 * "Change password" row for the Profile section. Clicking triggers a
 * server action that sends a Supabase password-reset email to the
 * caller's own address; the email link lands on /auth/update-password
 * where they set a new one. Wilson's ask 2026-07-28: users need a way
 * to update their password, done the standard link-in-email way.
 *
 * The row itself mirrors the static Row shape from settings/page.tsx
 * (icon + label on the left, action on the right) so it sits cleanly
 * next to the plain Email row without visual drift.
 */
export function PasswordResetRow({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  function onClick() {
    setToast(null);
    startTransition(async () => {
      const result = await sendPasswordResetEmail();
      if (!result.ok) {
        setToast({ kind: "error", text: result.error });
        return;
      }
      setToast({
        kind: "success",
        text: `Check ${email} for a link to set a new password.`,
      });
    });
  }

  return (
    <div className="flex flex-col">
      <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
        <span
          aria-hidden
          className="flex w-6 flex-shrink-0 items-center justify-center text-warm-300"
        >
          <LockIcon />
        </span>
        <span className="flex-1 text-[15px] font-medium text-warm-50">
          Password
        </span>
        <button
          type="button"
          onClick={onClick}
          disabled={pending}
          className="text-sm font-medium text-coral-strong transition-colors hover:text-coral disabled:opacity-60"
        >
          {pending ? "Sending…" : "Change"}
        </button>
      </div>
      {toast ? (
        <p
          role={toast.kind === "error" ? "alert" : "status"}
          className={
            toast.kind === "error"
              ? "mx-4 mb-3 rounded-xl bg-coral-strong/10 px-3.5 py-2 text-xs font-medium text-coral-strong"
              : "mx-4 mb-3 rounded-xl bg-teal/10 px-3.5 py-2 text-xs font-medium text-teal-strong"
          }
        >
          {toast.text}
        </p>
      ) : null}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.25" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}
