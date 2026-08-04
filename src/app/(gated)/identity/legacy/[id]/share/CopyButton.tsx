"use client";

import { useState } from "react";

export function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (old browser / permissions) — the code is
      // right there on screen; nothing else to do.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      // Secondary now that Share is the primary action above it. Two
      // gradient buttons stacked read as two equally-important choices,
      // and sharing is the one this screen exists for.
      className="flex h-13 w-full items-center justify-center rounded-full text-base font-semibold text-warm-100 ring-1 ring-warm-700 transition-colors hover:ring-coral/40"
    >
      {copied ? "Copied" : "Copy the code"}
    </button>
  );
}
