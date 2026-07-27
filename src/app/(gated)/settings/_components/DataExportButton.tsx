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
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-warm-700/20 disabled:opacity-60"
      >
        <span className="text-base font-medium text-warm-100">
          Download my data
        </span>
        <span className="text-xs font-medium text-warm-400">
          {pending ? "Building…" : "JSON"}
        </span>
      </button>
      {error ? (
        <p className="px-4 pb-3 text-xs text-coral-strong">{error}</p>
      ) : null}
    </div>
  );
}
