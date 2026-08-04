"use client";

import { useState } from "react";

/**
 * The share sheet, on the legacy code screen.
 *
 * Mobile has had this since the beginning — the OS sheet opens and the
 * code goes out by Messages, Mail, WhatsApp, whatever the person
 * actually uses. This screen had a copy button and a mailto link and
 * nothing else, so on a phone browser the only route out was email.
 *
 * Same component shape as the one in settings/_components (feature
 * detect at click time, clipboard fallback, two distinct confirmations),
 * because they are the same action in two places and should not behave
 * differently.
 *
 * Detection happens on click rather than in an effect: navigator does
 * not exist during SSR, and setting state from an effect just to pick a
 * label causes a cascading render for no benefit. The label stays
 * "Share" either way — on desktop without a share sheet, the click
 * copies, and the confirmation says so.
 *
 * The clipboard fallback copies the WHOLE message, not just the code. A
 * bare code pasted into a text years from now means nothing to whoever
 * receives it; the sentence around it is the part that makes it usable.
 */
export function ShareButton({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "shared">("idle");

  async function onShare() {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ title, text: message });
        setStatus("shared");
        window.setTimeout(() => setStatus("idle"), 1600);
        return;
      } catch (err) {
        // AbortError means they opened the sheet and closed it. That is
        // a deliberate "not now" — falling through to the clipboard
        // would silently do the thing they just declined.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Anything else falls through so the tap still does something.
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch {
      // No clipboard either (old browser, insecure context). The code is
      // on screen and selectable; nothing further to do.
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      className="bg-gradient-cta flex h-14 w-full items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5),_0_4px_12px_rgba(126,196,196,0.18)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90"
    >
      {status === "shared"
        ? "Shared"
        : status === "copied"
          ? "Copied"
          : "Share"}
    </button>
  );
}
