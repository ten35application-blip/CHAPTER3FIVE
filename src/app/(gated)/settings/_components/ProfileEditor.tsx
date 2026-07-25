"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ProfileAvatarImage } from "@/components/profile-avatar-image";
import {
  removeProfilePhoto,
  updateProfileName,
  uploadProfilePhoto,
} from "../actions";

type Props = {
  /** Signed URL for the current photo, if the user has one. */
  photoUrl: string | null;
  /** Fallback initial when no photo is set (usually first char of email). */
  initial: string;
  /** Current display name; null when the user hasn't set one. */
  fullName: string | null;
};

type Toast = { kind: "success" | "error"; text: string };

/**
 * Inline profile editor for /settings — the photo widget AND the name
 * input in one block. Replaces the old /settings/profile subpage per
 * Wilson's 2026-07-25 redesign: tap the bubble to change the photo, tap
 * the name field to edit; both live on the same screen so the account
 * flow is one hop, not two.
 *
 * Refresh strategy: after every successful mutation we call
 * `router.refresh()` client-side. The server actions ALSO revalidate
 * the affected paths, but Next 16's server-side `refresh()` from
 * next/cache proved unreliable on iOS Safari when the action is
 * dispatched from useTransition (rather than a native form submit) —
 * doing it here on the client router is the belt-and-suspenders fix
 * for the "boom, nothing" bug Wilson kept hitting after upload.
 *
 * Diagnostic logs live behind console.* calls — cheap, quiet in prod
 * console-viewer logs, and give a real trace the next time something
 * regresses.
 */
export function ProfileEditor({ photoUrl, initial, fullName }: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Name field is a controlled input; blur triggers the save if the
  // trimmed value diverges from what we last persisted. We track the
  // "committed" value separately so a no-op blur doesn't hit the DB.
  const initialName = fullName ?? "";
  const [nameValue, setNameValue] = useState(initialName);
  const [committedName, setCommittedName] = useState(initialName);
  const [nameSaving, setNameSaving] = useState(false);

  // If the parent-provided fullName changes underneath us (e.g. a
  // separate mutation refreshed the server component), snap back to
  // the new source of truth without stomping unsaved edits.
  useEffect(() => {
    setCommittedName(initialName);
    setNameValue((current) =>
      current === committedName ? initialName : current,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialName]);

  // Success toasts self-dismiss after 3s so the widget doesn't sit
  // with stale "Saved" chrome. Errors stick — the user needs to read
  // them and retry.
  useEffect(() => {
    if (toast?.kind !== "success") return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    console.log(
      "[ProfileEditor] onPickFile fired",
      file
        ? { name: file.name, size: file.size, type: file.type }
        : "no file",
    );
    if (!file) return;

    const formData = new FormData();
    formData.append("photo", file);

    setToast(null);
    startTransition(async () => {
      const result = await uploadProfilePhoto(formData);
      console.log("[ProfileEditor] uploadProfilePhoto returned", result);
      if (!result.ok) {
        setToast({ kind: "error", text: result.error });
      } else {
        setToast({ kind: "success", text: "Photo saved." });
        // Force the client router to re-fetch this route so the server
        // component re-renders with a fresh signed URL. Without this
        // step iOS Safari can hold the pre-upload prop indefinitely
        // (the actual regression Wilson kept flagging).
        router.refresh();
      }
      // Reset the input so picking the same file again re-triggers.
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onRemove() {
    setToast(null);
    startTransition(async () => {
      const result = await removeProfilePhoto();
      console.log("[ProfileEditor] removeProfilePhoto returned", result);
      if (!result.ok) {
        setToast({ kind: "error", text: result.error });
      } else {
        setToast({ kind: "success", text: "Photo removed." });
        router.refresh();
      }
    });
  }

  function onNameBlur() {
    const trimmed = nameValue.trim();
    if (trimmed === committedName.trim()) return;
    setNameSaving(true);
    setToast(null);
    startTransition(async () => {
      const result = await updateProfileName(trimmed);
      setNameSaving(false);
      if (!result.ok) {
        setToast({ kind: "error", text: result.error });
        return;
      }
      setCommittedName(trimmed);
      setToast({ kind: "success", text: "Name saved." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-6">
      {/* Tap-to-change photo. The whole bubble is a button so on
          touch devices there's no tiny hit-target — matches Wilson's
          "click your bubble and put the photo right there" ask. */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        aria-label={photoUrl ? "Change profile photo" : "Add a profile photo"}
        className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-coral/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-soft disabled:cursor-not-allowed"
      >
        <ProfileAvatarImage
          signedUrl={photoUrl}
          alt="Your profile photo"
          className="h-28 w-28 rounded-full object-cover shadow-[0_12px_32px_-8px_rgba(232,138,118,0.4),_0_6px_16px_-4px_rgba(126,196,196,0.35)] ring-2 ring-coral/30 transition-transform group-hover:-translate-y-0.5"
          fallback={
            <span
              aria-hidden
              className="bg-gradient-cta flex h-28 w-28 items-center justify-center rounded-full text-4xl font-bold text-white shadow-[0_12px_32px_-8px_rgba(232,138,118,0.4),_0_6px_16px_-4px_rgba(126,196,196,0.35)] transition-transform group-hover:-translate-y-0.5"
            >
              {initial}
            </span>
          }
        />

        {/* Camera badge — sits over the bottom-right of the bubble. */}
        <span
          aria-hidden
          className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-cta text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.5)] ring-2 ring-ink-soft transition-transform group-hover:scale-105"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>

        {pending ? (
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center rounded-full bg-warm-900/45 backdrop-blur-sm"
          >
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </span>
        ) : null}
      </button>

      {photoUrl ? (
        <button
          type="button"
          disabled={pending}
          onClick={onRemove}
          className="text-xs font-semibold text-warm-300 underline underline-offset-4 transition-colors hover:text-coral-strong disabled:opacity-60"
        >
          Remove photo
        </button>
      ) : (
        <p className="text-xs text-warm-400">
          Tap the bubble to add a photo.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={onPickFile}
        className="sr-only"
        aria-label="Choose profile photo"
      />

      {/* Name field — inline, auto-saves on blur. Personas will call
          the user by this name warmly at chat time when it's set. */}
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
            onBlur={onNameBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            maxLength={100}
            placeholder="What should we call you?"
            autoComplete="name"
            className="w-full rounded-2xl bg-warm-800/40 px-4 py-3 text-base text-warm-50 ring-1 ring-warm-700/60 transition-all placeholder:text-warm-500 focus:bg-warm-800/60 focus:outline-none focus:ring-2 focus:ring-coral/50"
          />
          {nameSaving ? (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 right-3 flex items-center"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-coral/30 border-t-coral" />
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
