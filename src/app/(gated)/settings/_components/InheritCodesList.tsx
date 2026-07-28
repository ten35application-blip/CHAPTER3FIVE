"use client";

import Link from "next/link";
import { useState } from "react";

/**
 * Inherit codes surface for the settings page. Empty state teaches
 * the user how to create one; populated state lists every legacy
 * identity they own with a one-tap copy chip for its share code.
 *
 * Codes only exist for identities minted via the legacy flow ("For
 * someone to keep"). Randomized / from-photo identities have no code
 * because they aren't inheritable. If the user hasn't minted any
 * legacy identity yet, the CTA sends them to /identity/legacy/new.
 *
 * Kept as a small client component so the copy interaction stays
 * hydrated without turning the whole settings page into one.
 */
export function InheritCodesList({
  items,
}: {
  items: Array<{ oracleId: string; name: string; code: string }>;
}) {
  if (items.length === 0) {
    return (
      <div className="px-4 py-5">
        <p className="text-sm leading-relaxed text-warm-200">
          Your inherit code shows up here once you&rsquo;ve created a
          legacy identity. Sit with yourself, or with someone you love,
          and answer a warm set of questions about who they really are
          &mdash; the code is what you&rsquo;ll share with family so they
          can meet the person you&rsquo;re keeping alive.
        </p>
        <Link
          href="/identity/legacy/new"
          className="bg-gradient-cta mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_10px_-2px_rgba(232,138,118,0.35)] transition-transform hover:-translate-y-0.5"
        >
          Create your inherit code
          <span aria-hidden>
            <ArrowIcon />
          </span>
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-warm-700/60">
      {items.map((item) => (
        <li key={item.oracleId} className="px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-warm-50">
                {item.name}
              </p>
              <p className="mt-0.5 text-xs text-warm-400">
                Share this with family so they can meet {item.name}.
              </p>
            </div>
            <CopyChip code={item.code} label={`Copy code for ${item.name}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function CopyChip({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void (async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          } catch {
            // Clipboard API unavailable — quietly no-op; the code text
            // is still visible in the chip so the user can select it.
          }
        })();
      }}
      aria-label={copied ? "Copied" : label}
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-coral/10 px-3 py-1.5 text-xs font-medium text-coral-strong ring-1 ring-coral/25 transition-colors hover:bg-coral/15"
    >
      <span aria-hidden>
        <ShareIcon />
      </span>
      <span className="font-mono">{copied ? "Copied" : code}</span>
    </button>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="14"
      height="14"
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
      <rect x="6" y="2" width="10" height="12" rx="1.75" />
      <path d="M4 6v10a2 2 0 0 0 2 2h8" />
    </svg>
  );
}
