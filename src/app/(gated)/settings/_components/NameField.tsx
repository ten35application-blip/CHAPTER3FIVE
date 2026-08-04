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
    <div className="flex w-full flex-col gap-3 px-4 pb-5">
      <div className="w-full">
        <label
          htmlFor="profile-name-input"
          className="mb-1.5 block text-[15px] font-medium text-warm-50"
        >
          Name
        </label>
        {/* Mobile input uses solid bg-ink inside the elevated card so
            the field reads as a sunken pane inside the section — same
            palette relationship as iOS grouped-list rows. */}
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
            className="h-[46px] w-full rounded-xl bg-ink px-3.5 text-[15px] text-warm-50 ring-1 ring-warm-700 transition-colors placeholder:text-warm-500 focus:outline-none focus:ring-2 focus:ring-coral/50 disabled:opacity-70"
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
              ? "w-full rounded-xl bg-coral-strong/10 px-4 py-2.5 text-sm font-medium text-coral-strong"
              : "w-full rounded-xl bg-teal/10 px-4 py-2.5 text-sm font-medium text-teal-strong"
          }
        >
          {toast.text}
        </p>
      ) : null}
    </div>
  );
}
