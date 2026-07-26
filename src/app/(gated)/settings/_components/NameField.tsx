"use client";

import { useEffect, useState, useTransition } from "react";
import { updateProfileName } from "../actions";

type Props = {
  /** Current display name; null when the user hasn't set one. */
  fullName: string | null;
};

/**
 * Inline display-name editor — auto-saves on blur when the trimmed
 * value diverges from what we last persisted. Extracted from the old
 * ProfileEditor as part of the round-4 photo rebuild; the name path
 * never had the "revert to original" bug and doesn't need the same
 * form-action treatment, so it keeps the useTransition pattern with
 * its committed-value bookkeeping.
 */
export function NameField({ fullName }: Props) {
  const [pending, startTransition] = useTransition();

  const initialName = fullName ?? "";
  const [nameValue, setNameValue] = useState(initialName);
  const [committedName, setCommittedName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  // If the parent-provided fullName changes underneath us (e.g. another
  // tab or mutation refreshed the row), adopt the new source of truth
  // without stomping on an unsaved edit.
  useEffect(() => {
    setCommittedName(initialName);
    setNameValue((current) =>
      current === committedName ? initialName : current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialName]);

  useEffect(() => {
    if (toast?.kind !== "success") return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  function onBlur() {
    const trimmed = nameValue.trim();
    if (trimmed === committedName.trim()) return;
    setSaving(true);
    setToast(null);
    startTransition(async () => {
      const result = await updateProfileName(trimmed);
      setSaving(false);
      if (!result.ok) {
        setToast({ kind: "error", text: result.error });
        return;
      }
      setCommittedName(trimmed);
      setToast({ kind: "success", text: "Name saved." });
    });
  }

  return (
    <div className="flex w-full flex-col items-center gap-3 px-4 pb-6">
      <div className="w-full max-w-sm">
        <label
          htmlFor="profile-name-input"
          className="mb-1 block text-xs font-semibold uppercase tracking-widest text-warm-400"
        >
          Your name
        </label>
        <div className="relative">
          <input
            id="profile-name-input"
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={onBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            maxLength={100}
            placeholder="What should we call you?"
            autoComplete="name"
            disabled={pending}
            className="w-full rounded-2xl bg-warm-800/40 px-4 py-3 text-base text-warm-50 ring-1 ring-warm-700/60 transition-all placeholder:text-warm-500 focus:bg-warm-800/60 focus:outline-none focus:ring-2 focus:ring-coral/50 disabled:opacity-70"
          />
          {saving ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-warm-400"
            >
              Saving…
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-warm-400">
          Your identities will use this to greet you.
        </p>
      </div>

      {toast ? (
        <p
          role={toast.kind === "error" ? "alert" : "status"}
          className={
            toast.kind === "error"
              ? "w-full max-w-sm rounded-2xl bg-coral-strong/10 px-4 py-3 text-center text-sm font-medium text-coral-strong"
              : "w-full max-w-sm rounded-2xl bg-teal/10 px-4 py-3 text-center text-sm font-medium text-teal-strong"
          }
        >
          {toast.text}
        </p>
      ) : null}
    </div>
  );
}
