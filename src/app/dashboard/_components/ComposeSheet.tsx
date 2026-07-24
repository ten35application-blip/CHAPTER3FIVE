"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Identity = {
  id: string;
  name: string;
  avatar_url: string | null;
};

type Props = {
  identities: Identity[];
};

export function ComposeSheet({ identities }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* FAB — the primary action on the dashboard. Was flat dusty blue;
          now filled with the brand gradient at a full 64px with a
          heavy two-layer coral+teal glow so it reads as the important
          moment on the screen. Extra ring for lift against the peach
          background. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="New message"
        className="bg-gradient-cta hover:bg-gradient-cta-hover fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_20px_48px_-10px_rgba(232,138,118,0.55),_0_10px_28px_-6px_rgba(126,196,196,0.45)] ring-2 ring-white/40 transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_54px_-10px_rgba(232,138,118,0.6),_0_12px_32px_-6px_rgba(126,196,196,0.5)] active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Who do you want to message?"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-warm-50/30 backdrop-blur-sm"
          />

          {/* Sheet — grabber tinted coral so even the smallest chrome
              piece belongs to the brand color story. */}
          <div className="animate-sheet-up relative z-10 w-full max-w-md rounded-t-3xl bg-ink-soft pb-8 shadow-[0_-24px_60px_-20px_rgba(28,28,26,0.2),_0_-8px_24px_rgba(232,138,118,0.1)]">
            <div className="flex justify-center pt-3">
              <span className="bg-gradient-cta h-1.5 w-12 rounded-full opacity-60" />
            </div>

            <div className="px-6 pb-3 pt-5">
              <h2 className="text-xl font-bold tracking-tight">
                Who do you want to <span className="text-gradient-cta">message?</span>
              </h2>
            </div>

            {identities.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-warm-300">
                  You haven&apos;t made anyone yet. Tap Edit &rarr; Create an
                  identity.
                </p>
              </div>
            ) : (
              <ul className="max-h-[60dvh] overflow-y-auto px-2 pb-2">
                {identities.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/chat/${p.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-coral/5"
                    >
                      <Avatar name={p.name} url={p.avatar_url} />
                      <span className="text-base font-semibold text-warm-50">
                        {p.name}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initial = (name[0] ?? "?").toUpperCase();
  if (url) {
    return (
      // Plain img — avatar URLs can be any host; avoids remotePatterns config.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-11 w-11 rounded-full object-cover shadow-[0_4px_12px_-2px_rgba(232,138,118,0.25)] ring-2 ring-coral/20"
      />
    );
  }
  return (
    <span className="bg-gradient-cta flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.3)]">
      {initial}
    </span>
  );
}
