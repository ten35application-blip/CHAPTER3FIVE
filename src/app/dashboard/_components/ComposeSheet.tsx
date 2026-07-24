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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="New message"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-white shadow-[0_16px_40px_-10px_rgba(107,140,175,0.6),_0_6px_16px_rgba(232,138,118,0.18)] transition-all hover:-translate-y-px active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
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

          {/* Sheet */}
          <div className="animate-sheet-up relative z-10 w-full max-w-md rounded-t-3xl bg-ink-soft pb-8 shadow-[0_-24px_60px_-20px_rgba(28,28,26,0.18),_0_-4px_16px_rgba(232,138,118,0.05)]">
            <div className="flex justify-center pt-3">
              <span className="h-1.5 w-10 rounded-full bg-warm-700" />
            </div>

            <div className="px-6 pt-4 pb-2">
              <h2 className="text-lg font-semibold tracking-tight">
                Who do you want to message?
              </h2>
            </div>

            {identities.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-warm-300">
                  You haven&apos;t made anyone yet. Tap Edit → Create an
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
                      className="flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-warm-700/30"
                    >
                      <Avatar name={p.name} url={p.avatar_url} />
                      <span className="text-base font-medium text-warm-50">
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
        className="h-11 w-11 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-warm-700/60 text-base font-semibold text-warm-100">
      {initial}
    </span>
  );
}
