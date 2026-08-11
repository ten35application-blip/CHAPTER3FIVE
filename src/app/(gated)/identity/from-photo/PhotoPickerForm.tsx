"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createIdentityFromPhoto } from "./actions";

/**
 * Submit button with a pending lock. Vision + synthesis take ~40s and
 * the button had no disabled state, so a double-tap fired the server
 * action twice — two identities, two synthesis bills, quota jumped by
 * two. The server re-checks quota before insert now (belt), this is
 * the suspenders. useFormStatus must live INSIDE the <form>, hence the
 * child component.
 */
function MeetThemButton({ disabled = false }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-amber text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(107,140,175,0.55),_0_4px_12px_rgba(232,138,118,0.12)] transition-all hover:-translate-y-px hover:shadow-[0_18px_44px_-10px_rgba(107,140,175,0.6),_0_6px_14px_rgba(232,138,118,0.15)] active:translate-y-0 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Bringing them to life…" : "Meet them"}
    </button>
  );
}

/**
 * Client wrapper around the photo-upload form so we can render a
 * 128×128 preview of the picked file above the submit button — mobile
 * parity 2026-08-03 (chapter3five-app/app/identity/from-photo.tsx
 * shows the picked photo before "Meet them" fires). The submit still
 * dispatches the existing server action.
 */
export function PhotoPickerForm() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Rights attestation (Wilson 2026-08-11, after the celebrity
  // question). The Guidelines have always banned impersonating a real
  // living person without permission — this puts that promise at the
  // moment of upload, explicit and required, so every violation breaks
  // a logged attestation instead of a page nobody re-reads. The server
  // action enforces it too; this checkbox is the honest UI half.
  const [attested, setAttested] = useState(false);

  // Revoke any previously-issued object URL so we don't leak blobs
  // across selections; also releases the last one on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  return (
    <form action={createIdentityFromPhoto} className="mt-8 w-full">
      <label className="flex w-full cursor-pointer flex-col items-center rounded-2xl border border-dashed border-warm-400/40 px-6 py-8 text-warm-300 transition-colors hover:border-warm-300 hover:text-warm-100">
        <span className="text-sm font-medium">
          Choose a photo (JPEG, PNG, GIF, or WebP — up to 4 MB)
        </span>
        <input
          ref={inputRef}
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/gif,image/webp"
          required
          onChange={onFileChange}
          className="mt-4 w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-amber file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
      </label>

      {/* 128×128 preview + "different photo" affordance — mobile parity
          2026-08-03. Only rendered once a file is picked; tapping the
          preview forwards to the file input to re-open the picker. */}
      {previewUrl ? (
        <div className="mt-6 flex flex-col items-center">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="group rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            aria-label="Choose a different photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected photo preview"
              width={128}
              height={128}
              className="h-32 w-32 rounded-2xl object-cover ring-2 ring-coral/25 transition-opacity group-active:opacity-80"
            />
          </button>
          <p className="mt-3 text-xs text-warm-400">
            Tap to choose a different photo
          </p>
        </div>
      ) : null}

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-ink-soft px-4 py-4 text-left ring-1 ring-warm-700 transition-all hover:ring-coral/40">
        <input
          type="checkbox"
          name="photo_rights"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
          required
          className="mt-1 h-5 w-5 shrink-0 accent-coral"
        />
        <span className="text-sm leading-relaxed text-warm-200">
          This photo is of <strong className="text-warm-50">me</strong>,
          or of someone who{" "}
          <strong className="text-warm-50">gave me permission</strong> to
          use it — not a public figure, and not someone who hasn&rsquo;t
          consented.
        </span>
      </label>

      <MeetThemButton disabled={!attested} />
    </form>
  );
}
