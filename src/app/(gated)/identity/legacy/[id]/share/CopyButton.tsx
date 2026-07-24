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
      className="bg-gradient-cta flex h-14 w-full items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5),_0_4px_12px_rgba(126,196,196,0.18)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90"
    >
      {copied ? "Copied" : "Copy the code"}
    </button>
  );
}
