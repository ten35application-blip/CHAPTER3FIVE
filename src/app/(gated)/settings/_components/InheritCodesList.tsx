"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Inherit codes surface, rendered INLINE inside the Profile section
 * (settings/page.tsx) directly below NameField. Wilson's ask
 * 2026-07-28: this belongs with the user's identity chrome, not as
 * its own tile — the codes are how the person's family finds them,
 * so they sit with name + photo.
 *
 * Empty state teaches the flow with a soft CTA into /identity/legacy/new.
 * Populated state lists every legacy identity the user has minted and
 * puts a Share button on the right of each row — Web Share API when
 * available so the OS share sheet (Messages, Mail, WhatsApp, etc.)
 * opens directly; falls back to clipboard copy otherwise so the code
 * is still recoverable.
 */
type CodeItem = {
  oracleId: string;
  name: string;
  code: string;
  /** "self" = user recorded themselves; "other" = they recorded a
   *  loved one. Null for codes minted before the mode toggle shipped
   *  (2026-07-28) — those render without a label. */
  mode: "self" | "other" | null;
};

export function InheritCodesList({ items }: { items: Array<CodeItem> }) {
  return (
    <div className="border-t border-warm-700/60 px-4 py-4">
      <p className="mb-3 text-[15px] font-medium text-warm-50">Inherit codes</p>
      {items.length === 0 ? <EmptyState /> : <CodesList items={items} />}
    </div>
  );
}

function EmptyState() {
  return (
    <div>
      <p className="text-xs leading-relaxed text-warm-400">
        Your inherit code shows up here once you&rsquo;ve created a legacy
        identity. Sit with yourself, or with someone you love, and answer
        a warm set of questions about who they really are &mdash; the code
        is what you&rsquo;ll share with family so they can meet the person
        you&rsquo;re keeping alive.
      </p>
      <Link
        href="/identity/legacy/new"
        className="bg-gradient-cta mt-3 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_4px_10px_-2px_rgba(232,138,118,0.35)] transition-transform hover:-translate-y-0.5"
      >
        Create your inherit code
        <span aria-hidden>
          <ArrowIcon />
        </span>
      </Link>
    </div>
  );
}

function CodesList({ items }: { items: Array<CodeItem> }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => {
        // Small tag above the name so YOU can tell your own code from
        // one you made for a loved one at a glance. Pre-mode codes
        // (mode === null) render nameless so we don't guess wrong.
        const tag =
          item.mode === "self"
            ? "Your code"
            : item.mode === "other"
              ? `For ${item.name}`
              : null;
        return (
          <li
            key={item.oracleId}
            className="flex items-center justify-between gap-3 rounded-xl bg-warm-700/25 px-3.5 py-2.5 ring-1 ring-warm-700/60"
          >
            <div className="min-w-0 flex-1">
              {tag ? (
                <p className="text-[10px] font-semibold uppercase tracking-widest text-coral-strong">
                  {tag}
                </p>
              ) : null}
              <p className="truncate text-sm font-medium text-warm-50">
                {item.name}
              </p>
              <p className="mt-0.5 font-mono text-xs text-warm-300">
                {item.code}
              </p>
            </div>
            <ShareButton code={item.code} name={item.name} />
          </li>
        );
      })}
    </ul>
  );
}

function ShareButton({ code, name }: { code: string; name: string }) {
  // Two feedback states because the two flows land differently:
  //   "Copied" — clipboard fallback (Web Share unsupported / dismissed)
  //   "Shared" — the OS share sheet came back with a completed hand-off
  const [status, setStatus] = useState<"idle" | "copied" | "shared">("idle");

  async function onShare() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    // What the recipient reads. Chosen for text-message tone: short,
    // warm, includes the plain code so they can copy from the SMS
    // itself, and points them at the exact redemption page.
    const shareText =
      `I made an inherit code so you can meet ${name} on chapter3five.\n\n` +
      `Code: ${code}\n\n` +
      `Redeem it at ${origin}/identity/inherit`;
    const title = `Meet ${name} on chapter3five`;

    // Web Share is well-supported on iOS/Android; on desktop Chromium
    // it may or may not be present. Feature-detect and fall back to
    // clipboard copy so the code never ends up unreachable.
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ title, text: shareText });
        setStatus("shared");
        window.setTimeout(() => setStatus("idle"), 1600);
        return;
      } catch (err) {
        // AbortError = user dismissed the sheet: not an error, just no-op.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Any other failure falls through to the clipboard path so the
        // user still ends up with the code on their pasteboard.
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch {
      // Clipboard unavailable — the code is still visible in the row
      // above so the user can hand-select it.
    }
  }

  const label =
    status === "shared" ? "Shared" : status === "copied" ? "Copied" : "Share";

  return (
    <button
      type="button"
      onClick={() => void onShare()}
      aria-label={`Share the inherit code for ${name}`}
      className="bg-gradient-cta flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_4px_10px_-2px_rgba(232,138,118,0.35)] transition-transform hover:-translate-y-0.5"
    >
      <span aria-hidden>
        <ShareIcon />
      </span>
      <span>{label}</span>
    </button>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="12"
      height="12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

function ShareIcon() {
  // Paper plane -- Wilson's ask 2026-07-28 ("a paperplane with our
  // colors"). Filled triangle body + a subtle inner fold line so it
  // reads as "send", not a random arrow. Uses currentColor so the
  // parent's gradient text-fill (bg-gradient-cta on the button)
  // paints it in the coral+teal palette.
  return (
    <svg
      viewBox="0 0 20 20"
      width="13"
      height="13"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.6 2.4a1 1 0 0 1 .3 1.02l-4.2 13.3a1 1 0 0 1-1.83.16l-2.62-4.9-4.9-2.62a1 1 0 0 1 .16-1.83L17.02 2.1a1 1 0 0 1 .58.3zM8.7 11.3l1.7 3.18 2.85-9.03L8.7 11.3z" />
    </svg>
  );
}
