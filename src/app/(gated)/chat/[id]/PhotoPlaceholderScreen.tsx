"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Photo-placeholder chat surface — replaces the Phase-3 stub.
 *
 * The row is a photo-companion slot the auto-populate helper reserved
 * post-subscribe (is_photo_placeholder = true), and the user just
 * tapped it from the dashboard. Instead of a broken composer, this
 * screen renders a large tap-target avatar that opens the file picker;
 * on choose, it POSTs to /api/identity/from-photo with the multipart
 * `photo` part AND a `placeholder_id` so the endpoint UPDATE-in-place
 * fills the row (name, traits, persona_prompt, avatar_url, all the
 * details) and flips is_photo_placeholder = false in a single write.
 *
 * The row id survives the fill — router.refresh() re-renders the
 * server page and the SAME chat surface comes up as a live persona.
 *
 * Wilson's Phase-4 spec:
 *   "Because persona synthesis takes 30-60s, don't block the button;
 *    show progress state, poll for completion, then transition."
 *
 * The endpoint runs synchronously (maxDuration = 300s on the route),
 * so instead of a background job + poll we render the progress state
 * for the duration of the round trip and only refresh on success.
 * This keeps the flow simple; if 300s ever gets brittle in production
 * a background-job pattern can drop in behind the same UI.
 */
// 4 MB — the server (from-photo route) rejects above 4, and Vercel's
// 4.5 MB body limit kills anything bigger before our code even runs.
// This was 5: a 4.2 MB photo passed here, then failed server-side with
// an error that blamed the user.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/gif,image/webp";


/** localStorage twin of mobile's lib/photoAttempt.ts. The upload work
 *  runs server-side, so a closed tab doesn't stop it — but it used to
 *  also erase all sight of it: reopen the page and nothing explained
 *  whether the photo took. One marker, written when the request
 *  starts, cleared on every exit path, self-expiring so a killed tab
 *  can't leave a stale banner forever. */
const ATTEMPT_KEY = "c3f.photo.attempt";
const ATTEMPT_STALE_MS = 5 * 60 * 1000;

function markAttemptStarted(): void {
  try {
    window.localStorage.setItem(ATTEMPT_KEY, String(Date.now()));
  } catch {
    /* a missing marker only costs the notice */
  }
}
function clearAttempt(): void {
  try {
    window.localStorage.removeItem(ATTEMPT_KEY);
  } catch {}
}
// Pure read — used as a useSyncExternalStore snapshot, so it must not
// mutate. Stale markers are simply reported false; they get overwritten
// by the next markAttemptStarted or removed by a clear path.
function readInterruptedAttempt(): boolean {
  try {
    const raw = window.localStorage.getItem(ATTEMPT_KEY);
    if (!raw) return false;
    const at = Number(raw);
    return Number.isFinite(at) && Date.now() - at <= ATTEMPT_STALE_MS;
  } catch {
    return false;
  }
}

const noSubscription = () => () => {};

export default function PhotoPlaceholderScreen({
  oracleId,
  name,
}: {
  oracleId: string;
  name: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Rights attestation. /api/identity/from-photo refuses any upload
  // without photo_rights === "on" (route.ts:161), and this screen never
  // sent it — so filling a placeholder from a browser was rejected every
  // single time, with the error telling people to confirm something the
  // page gave them no way to confirm. Deliberately a REAL checkbox
  // rather than hardcoding the flag: the whole point of the gate is that
  // a person affirmed it, and quietly asserting consent on their behalf
  // would be worse than the bug. Matches the main upload form.
  const [attested, setAttested] = useState(false);
  // A previous attempt this tab (or a killed one) started and never
  // resolved — "your last try may still have landed; check the
  // dashboard before paying the wait again." useSyncExternalStore
  // rather than an effect: the server snapshot is false (no
  // localStorage there), the client snapshot reads the marker, and no
  // setState-in-effect is needed for the compiler to object to.
  const interrupted = useSyncExternalStore(
    noSubscription,
    readInterruptedAttempt,
    () => false,
  );

  const pick = useCallback(() => {
    if (busy || !attested) return;
    setError(null);
    fileRef.current?.click();
  }, [busy, attested]);

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input so re-picking the same file re-fires change.
      e.target.value = "";
      if (!file) return;
      if (file.size > MAX_PHOTO_BYTES) {
        setError("That photo is over 4 MB. Try a smaller one.");
        return;
      }
      setBusy(true);
      setError(null);
      markAttemptStarted();
      try {
        const form = new FormData();
        form.append("photo", file);
        form.append("placeholder_id", oracleId);
        // Only reachable once `attested` is true — the picker refuses to
        // open otherwise — so this mirrors a box the user actually ticked.
        form.append("photo_rights", "on");
        const res = await fetch("/api/identity/from-photo", {
          method: "POST",
          body: form,
        });
        const data = (await res.json().catch(() => ({}))) as {
          id?: string;
          filled?: boolean;
          error?: string;
          code?: string;
        };
        if (!res.ok) {
          // "already_filled" is treated as success — the row is a live
          // persona now (probably a double-tap raced past the pre-check
          // or the user opened two tabs). Refresh to render it.
          if (data.code === "already_filled") {
            clearAttempt();
            router.refresh();
            return;
          }
          clearAttempt();
          setError(
            data.error ??
              "Something went wrong reading the photo. Try again in a moment.",
          );
          setBusy(false);
          return;
        }
        // Same-id refresh: the RSC page re-renders as the live persona
        // (is_photo_placeholder is now false, so the placeholder branch
        // above falls through to the normal ChatSurface).
        clearAttempt();
        router.refresh();
      } catch {
        // Deliberately NOT cleared here: a network drop mid-upload is
        // exactly the case where the server may still finish without
        // us — the marker is what explains that on the next visit.
        setError(
          "Something went wrong reading the photo. Try again in a moment.",
        );
        setBusy(false);
      }
    },
    [oracleId, router],
  );

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 py-24 text-center">
      <Link
        href="/dashboard"
        aria-label="Back to dashboard"
        className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full text-warm-200 hover:bg-ink-soft"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M12.5 4 6.5 10l6 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Link>

      {interrupted && !busy ? (
        <p className="mb-6 w-full rounded-2xl border border-warm-700 bg-ink-soft px-5 py-4 text-sm leading-relaxed text-warm-200">
          It looks like a photo was being uploaded here and the page
          closed before it finished. It may have completed anyway —
          check your{" "}
          <Link href="/dashboard" className="font-semibold text-coral-strong underline underline-offset-4">
            dashboard
          </Link>{" "}
          before trying again.
        </p>
      ) : null}

      <button
        type="button"
        onClick={pick}
        disabled={busy}
        aria-label="Upload a photo to create this identity"
        className="mb-6 flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-coral/40 bg-ink text-coral-strong transition-all hover:scale-105 hover:border-coral/70 disabled:cursor-wait disabled:opacity-70"
      >
        {busy ? (
          <span
            aria-hidden
            className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-coral/30 border-t-coral"
          />
        ) : (
          <svg
            viewBox="0 0 24 24"
            width="44"
            height="44"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 8h3l2-2h6l2 2h3v10H4z" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
        )}
      </button>

      <h1 className="text-lg font-semibold text-warm-50">{name}</h1>

      {busy ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm leading-relaxed text-warm-300"
        >
          Your identity is being created&hellip; this takes about a minute.
        </p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-warm-300">
          Tap the avatar to upload a photo &mdash; this identity will be
          created once you do.
        </p>
      )}

      {error ? (
        <p className="mt-4 rounded-xl bg-warm-700/25 px-4 py-3 text-xs text-coral-strong">
          {error}
        </p>
      ) : null}

      <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-ink-soft px-4 py-4 text-left ring-1 ring-warm-700 transition-all hover:ring-coral/40">
        <input
          type="checkbox"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
          disabled={busy}
          className="mt-1 h-5 w-5 shrink-0 accent-coral"
        />
        <span className="text-sm leading-relaxed text-warm-200">
          This photo is of <strong className="text-warm-50">me</strong>, or of
          someone who{" "}
          <strong className="text-warm-50">gave me permission</strong> to use
          it — not a public figure, and not someone who hasn&rsquo;t consented.
        </span>
      </label>

      <button
        type="button"
        onClick={pick}
        disabled={busy || !attested}
        className="bg-gradient-cta mt-8 flex h-12 w-full items-center justify-center rounded-full text-sm font-bold tracking-tight text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
      >
        {busy ? "Creating…" : "Upload a photo"}
      </button>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT}
        onChange={onFile}
        className="hidden"
      />
    </main>
  );
}
