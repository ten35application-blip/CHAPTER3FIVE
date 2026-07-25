"use client";

import { useRef, useState, useTransition } from "react";
import { removeProfilePhoto, uploadProfilePhoto } from "./actions";

type Props = {
  email: string;
  /** Signed URL for the current photo, if the user has one. */
  photoUrl: string | null;
};

/**
 * Profile photo widget for /settings/profile. Preview + file picker +
 * remove button. Server actions handle the upload/remove work; this
 * component only manages the transient upload state and surfaces
 * errors.
 */
export function PhotoWidget({ email, photoUrl }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const initial = (email[0] ?? "?").toUpperCase();

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("photo", file);

    setError(null);
    startTransition(async () => {
      const result = await uploadProfilePhoto(formData);
      if (!result.ok) setError(result.error);
      // Reset the input so picking the same file again re-triggers.
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeProfilePhoto();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-6">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Your profile photo"
          className="h-28 w-28 rounded-full object-cover shadow-[0_10px_28px_-6px_rgba(232,138,118,0.35)] ring-2 ring-coral/25"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-28 w-28 items-center justify-center rounded-full bg-amber text-4xl font-semibold text-white shadow-[0_10px_28px_-6px_rgba(232,138,118,0.3)]"
        >
          {initial}
        </span>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="bg-gradient-cta hover:bg-gradient-cta-hover rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.35)] transition-transform hover:-translate-y-px active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Working…" : photoUrl ? "Change photo" : "Add photo"}
        </button>
        {photoUrl ? (
          <button
            type="button"
            disabled={pending}
            onClick={onRemove}
            className="rounded-full bg-warm-800/60 px-4 py-2 text-sm font-semibold text-warm-100 ring-1 ring-warm-700/60 transition-colors hover:bg-warm-800 disabled:opacity-60"
          >
            Remove
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={onPickFile}
        className="sr-only"
        aria-label="Choose profile photo"
      />

      <p className="text-center text-xs text-warm-400">
        JPEG, PNG, WebP, or HEIC. Up to 8 MB. We resize to 512×512.
      </p>

      {error ? (
        <p
          role="alert"
          className="w-full rounded-2xl bg-coral-strong/10 px-4 py-3 text-center text-sm font-medium text-coral-strong"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
