"use client";

import { useState, useTransition } from "react";

/**
 * "Download your data" — GETs /api/user/export and triggers a JSON
 * download. The endpoint already sets Content-Disposition: attachment,
 * so a plain window.location.href would work, but doing it via fetch
 * lets us surface a spinner + error state (and doesn't leave the
 * current page mid-download).
 *
 * GDPR / CCPA / Play Data Safety: this is the "data portability"
 * surface. The API existed already; this button is the missing UI.
 * App Store review often asks for a visible export path — this is it.
 */
export function DataExportButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await fetch("/api/user/export", {
                method: "GET",
                headers: { Accept: "application/json" },
              });
              if (!res.ok) {
                setError(
                  res.status === 401
                    ? "Please sign in again and try."
                    : "Couldn't build your export. Try again in a moment.",
                );
                return;
              }
              const blob = await res.blob();
              const disposition = res.headers.get("Content-Disposition") ?? "";
              const match = /filename="?([^"]+)"?/.exec(disposition);
              const filename =
                match?.[1] ?? `chapter3five-export-${Date.now()}.json`;

              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
            } catch {
              setError("Network error. Try again.");
            }
          });
        }}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-warm-700/30 disabled:opacity-60"
      >
        <span
          aria-hidden
          className="flex w-6 flex-shrink-0 items-center justify-center text-warm-300"
        >
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </span>
        <span className="flex-1 text-[15px] font-medium text-warm-50">
          Download my data
        </span>
        <span className="text-sm text-warm-300">
          {pending ? "Building…" : "JSON"}
        </span>
      </button>
      {error ? (
        <p className="px-4 pb-3 text-xs text-coral-strong">{error}</p>
      ) : null}
    </div>
  );
}
