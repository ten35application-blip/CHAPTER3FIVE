"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  removeProfilePhoto,
  uploadProfilePhoto,
  type PhotoRemoveState,
  type PhotoUploadState,
} from "../actions";

type Props = {
  /** Signed URL for the current photo, if the user has one. Sourced from RSC. */
  initialPhotoUrl: string | null;
  /** Fallback initial when no photo is set (usually first char of email). */
  initial: string;
  /** Render the on-screen debug panel — enabled by `?debug=1`. */
  debug: boolean;
};

/**
 * PhotoUploader — round-4 rebuild of the profile photo widget.
 *
 * Rounds 1-3 all iterated on a `startTransition` + `router.refresh()` +
 * shared ProfileAvatarImage flow and Wilson kept reporting the same
 * symptom ("goes to add, doesn't, reverts to original"). Storage logs
 * confirmed uploads WERE succeeding on iOS Safari — the bytes wrote and
 * a 200 GET followed — but the visible photo snapped back. Fourth-round
 * theory: the render was depending on the RSC round-trip to swap in the
 * fresh signed URL, and something in that pipeline (client router
 * transition timing? Safari's RSC-payload caching?) wasn't landing on
 * that user's device.
 *
 * This rewrite removes that dependence entirely:
 *   - Native `<form action={uploadAction}>` + useActionState — no
 *     manual startTransition, no router.refresh. React 19 handles state.
 *   - The server action RETURNS the new signed URL alongside `ok: true`.
 *     Rendering uses that returned URL directly; the RSC re-render
 *     becomes a fallback for other surfaces, not the display source.
 *   - `URL.createObjectURL(file)` at pick-time shows the picked photo
 *     immediately inside the bubble — that's the "goes to add" moment
 *     the user has been chasing.
 *   - Plain `<img>` element, no ProfileAvatarImage abstraction, no
 *     onError fallback that could hide a real render (the UserMenu
 *     copy of ProfileAvatarImage is untouched — that surface works).
 *   - `?debug=1` renders a fixed-bottom panel with live state (picked
 *     file info, action-return payload, display URL, pending flags) so
 *     Wilson can screenshot exactly what's happening on his phone.
 *
 * Display priority per render:
 *   1. Local objectURL preview WHILE an upload is in flight
 *   2. `currentUrl` local state — updated from either the action-return
 *      signedUrl or the incoming initialPhotoUrl prop
 *   3. Fallback initial when no URL exists
 */
export function PhotoUploader({
  initialPhotoUrl,
  initial,
  debug,
}: Props) {
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [uploadState, uploadAction, uploadPending] = useActionState<
    PhotoUploadState,
    FormData
  >(uploadProfilePhoto, null);
  const [removeState, removeAction, removePending] = useActionState<
    PhotoRemoveState,
    FormData
  >(removeProfilePhoto, null);

  // Object-URL preview of the file the user just picked. Shown inside
  // the bubble while `uploadPending` is true, then revoked once the
  // action returns a real signed URL.
  const [pickedPreview, setPickedPreview] = useState<string | null>(null);
  const [pickedFileInfo, setPickedFileInfo] = useState<{
    name: string;
    size: number;
    type: string;
  } | null>(null);

  // Local mirror of the "currently shown photo". Starts as the prop,
  // updates when the action returns a fresh signed URL, and syncs when
  // the RSC prop changes (e.g. another surface refreshed the row).
  const [currentUrl, setCurrentUrl] = useState<string | null>(initialPhotoUrl);

  // Sync from prop — RSC re-renders after revalidatePath may deliver an
  // updated signed URL (or null) independently of any local action.
  useEffect(() => {
    setCurrentUrl(initialPhotoUrl);
  }, [initialPhotoUrl]);

  // Optimistic swap: the moment the server action returns a signedUrl,
  // paint it. This is what rounds 1-3 relied on RSC re-render for.
  useEffect(() => {
    if (uploadState?.ok && uploadState.signedUrl) {
      setCurrentUrl(uploadState.signedUrl);
    }
  }, [uploadState]);

  useEffect(() => {
    if (removeState?.ok) {
      setCurrentUrl(null);
    }
  }, [removeState]);

  // Once we have a real signed URL from the server, drop the objectURL
  // preview. Revoke it so the browser can release the blob.
  useEffect(() => {
    if (!pickedPreview) return;
    if (uploadState?.ok && uploadState.signedUrl) {
      URL.revokeObjectURL(pickedPreview);
      setPickedPreview(null);
    }
  }, [uploadState, pickedPreview]);

  // Belt-and-suspenders unmount cleanup for any lingering objectURL.
  useEffect(() => {
    return () => {
      if (pickedPreview) URL.revokeObjectURL(pickedPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast lifecycle — success dismisses after 3s, errors stick until
  // the next action call overwrites them (or the component re-mounts).
  const [toast, setToast] = useState<
    { kind: "success" | "error"; text: string } | null
  >(null);

  useEffect(() => {
    if (uploadState === null) return;
    if (uploadState.ok) setToast({ kind: "success", text: "Photo saved." });
    else setToast({ kind: "error", text: uploadState.error });
  }, [uploadState]);

  useEffect(() => {
    if (removeState === null) return;
    if (removeState.ok) setToast({ kind: "success", text: "Photo removed." });
    else setToast({ kind: "error", text: removeState.error });
  }, [removeState]);

  useEffect(() => {
    if (toast?.kind !== "success") return;
    const id = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(id);
  }, [toast]);

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Revoke any prior preview so we don't leak object URLs on
    // rapid pick-again.
    if (pickedPreview) URL.revokeObjectURL(pickedPreview);

    const url = URL.createObjectURL(file);
    setPickedPreview(url);
    setPickedFileInfo({ name: file.name, size: file.size, type: file.type });
    setToast(null);

    // Native form submission — React 19 intercepts and runs the action
    // that useActionState wired up. The file input's `name="photo"`
    // makes it show up as formData.get("photo") on the server.
    uploadFormRef.current?.requestSubmit();
  }

  const pending = uploadPending || removePending;

  // What we actually paint: the local object URL while uploading, the
  // current signed URL otherwise. This never depends on any single
  // upstream signal — it's a small state machine driven by pending +
  // returned data.
  const displayUrl = uploadPending && pickedPreview ? pickedPreview : currentUrl;

  return (
    <div className="flex flex-col items-center gap-5 px-4 py-6">
      {/* One <form> per action. Both are `contents`-styled so they
          don't add layout — they're just wire, not chrome. */}
      <form
        ref={uploadFormRef}
        action={uploadAction}
        className="contents"
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          aria-label={
            displayUrl ? "Change profile photo" : "Add a profile photo"
          }
          className={`group relative rounded-full outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-coral/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-soft ${
            pending ? "cursor-progress opacity-70" : ""
          }`}
        >
          {displayUrl ? (
            // Plain <img>, no fallback wrapper — if this doesn't render
            // we WANT the broken glyph so we can see it. The fallback
            // habit was hiding real failures across rounds 1-3.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt="Your profile photo"
              className="h-28 w-28 rounded-full object-cover shadow-[0_12px_32px_-8px_rgba(232,138,118,0.4),_0_6px_16px_-4px_rgba(126,196,196,0.35)] ring-2 ring-coral/30 transition-transform group-hover:-translate-y-0.5"
            />
          ) : (
            <span
              aria-hidden
              className="bg-gradient-cta flex h-28 w-28 items-center justify-center rounded-full text-4xl font-bold text-white shadow-[0_12px_32px_-8px_rgba(232,138,118,0.4),_0_6px_16px_-4px_rgba(126,196,196,0.35)] transition-transform group-hover:-translate-y-0.5"
            >
              {initial}
            </span>
          )}

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
        </button>

        <input
          ref={inputRef}
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={onPickFile}
          className="sr-only"
          aria-label="Choose profile photo"
        />
      </form>

      {pending ? (
        <p
          role="status"
          aria-live="polite"
          className="text-xs font-medium text-warm-300"
        >
          {uploadPending ? "Uploading…" : "Removing…"}
        </p>
      ) : displayUrl ? (
        <form action={removeAction}>
          <button
            type="submit"
            disabled={pending}
            className="text-xs font-semibold text-warm-300 underline underline-offset-4 transition-colors hover:text-coral-strong disabled:opacity-60"
          >
            Remove photo
          </button>
        </form>
      ) : (
        <p className="text-xs text-warm-400">
          Tap the bubble to add a photo.
        </p>
      )}

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

      {debug ? (
        <DebugPanel
          initialPhotoUrl={initialPhotoUrl}
          currentUrl={currentUrl}
          displayUrl={displayUrl}
          pickedPreview={pickedPreview}
          pickedFileInfo={pickedFileInfo}
          uploadPending={uploadPending}
          removePending={removePending}
          uploadState={uploadState}
          removeState={removeState}
        />
      ) : null}
    </div>
  );
}

/**
 * Bottom-sheet debug panel — only mounted when `?debug=1` is in the URL.
 * Fixed to the viewport bottom so it stays visible while the user
 * interacts with the widget. All URLs are truncated so screenshots stay
 * readable and don't leak long signing tokens.
 */
function DebugPanel({
  initialPhotoUrl,
  currentUrl,
  displayUrl,
  pickedPreview,
  pickedFileInfo,
  uploadPending,
  removePending,
  uploadState,
  removeState,
}: {
  initialPhotoUrl: string | null;
  currentUrl: string | null;
  displayUrl: string | null;
  pickedPreview: string | null;
  pickedFileInfo: { name: string; size: number; type: string } | null;
  uploadPending: boolean;
  removePending: boolean;
  uploadState: PhotoUploadState;
  removeState: PhotoRemoveState;
}) {
  const rows: Array<[string, string]> = [
    ["prop initialPhotoUrl", short(initialPhotoUrl)],
    ["state currentUrl", short(currentUrl)],
    ["render displayUrl", short(displayUrl)],
    ["state pickedPreview", pickedPreview ? "set (blob:)" : "null"],
    [
      "state pickedFileInfo",
      pickedFileInfo
        ? `${pickedFileInfo.name} · ${pickedFileInfo.size}B · ${pickedFileInfo.type}`
        : "none",
    ],
    ["flag uploadPending", String(uploadPending)],
    ["flag removePending", String(removePending)],
    ["action uploadState", describeUploadState(uploadState)],
    ["action removeState", describeRemoveState(removeState)],
  ];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-72 w-full max-w-2xl overflow-auto rounded-t-2xl bg-ink-soft/95 p-3 font-mono text-[10px] leading-relaxed text-warm-100 shadow-[0_-8px_24px_-4px_rgba(0,0,0,0.4)] ring-1 ring-warm-700 backdrop-blur">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-coral-strong">
        photo debug · ?debug=1
      </p>
      <table className="w-full border-separate border-spacing-y-0.5">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="whitespace-nowrap pr-3 align-top text-warm-400">
                {k}
              </td>
              <td className="break-all align-top text-warm-100">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function short(url: string | null): string {
  if (!url) return "null";
  if (url.length <= 60) return url;
  return `${url.slice(0, 60)}… (${url.length}b)`;
}

function describeUploadState(state: PhotoUploadState): string {
  if (state === null) return "null (no action yet)";
  if (state.ok) {
    return `ok · ${state.bytes}B · ${state.contentType} · url=${short(state.signedUrl)}`;
  }
  const meta = state.bytes ? ` · ${state.bytes}B · ${state.contentType}` : "";
  return `error: ${state.error}${meta}`;
}

function describeRemoveState(state: PhotoRemoveState): string {
  if (state === null) return "null (no action yet)";
  if (state.ok) return "ok";
  return `error: ${state.error}`;
}
