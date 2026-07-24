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

/**
 * Bottom-right + FAB. Two-step compose flow:
 *   1. Tap FAB → contacts sheet with every identity you have.
 *   2. Tap a contact → confirmation card ("Message Marisol?").
 *   3. Confirm → route to /chat/[id].
 *
 * The confirmation step exists so an accidental tap on the contacts
 * list doesn't route someone straight into a chat. Cancel returns to
 * the contacts sheet without dismissing the whole flow.
 */
export function ComposeSheet({ identities }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Identity | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (selected) setSelected(null);
        else setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, selected]);

  function closeAll() {
    setOpen(false);
    setSelected(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="New message"
        className="bg-gradient-cta hover:bg-gradient-cta-hover fixed bottom-6 right-6 z-30 flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_20px_48px_-10px_rgba(232,138,118,0.55),_0_10px_28px_-6px_rgba(126,196,196,0.45)] ring-2 ring-white/40 transition-all hover:-translate-y-0.5 active:scale-95"
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
          aria-label={selected ? `Message ${selected.name}?` : "Choose a contact"}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={closeAll}
            className="absolute inset-0 bg-warm-50/30 backdrop-blur-sm"
          />

          <div className="animate-sheet-up relative z-10 w-full max-w-md rounded-t-3xl bg-ink-soft pb-8 shadow-[0_-24px_60px_-20px_rgba(28,28,26,0.2),_0_-8px_24px_rgba(232,138,118,0.1)]">
            <div className="flex justify-center pt-3">
              <span className="bg-gradient-cta h-1.5 w-12 rounded-full opacity-60" />
            </div>

            {selected ? (
              <ConfirmCard
                identity={selected}
                onCancel={() => setSelected(null)}
                onClose={closeAll}
              />
            ) : (
              <ContactList
                identities={identities}
                onPick={setSelected}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — contact list                                                */
/* ------------------------------------------------------------------ */

function ContactList({
  identities,
  onPick,
}: {
  identities: Identity[];
  onPick: (i: Identity) => void;
}) {
  return (
    <>
      <div className="px-6 pb-3 pt-5">
        <h2 className="text-xl font-bold tracking-tight">
          Who do you want to{" "}
          <span className="text-gradient-cta">message?</span>
        </h2>
      </div>

      {identities.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="text-sm text-warm-300">
            You haven&apos;t made anyone yet. Tap your avatar &rarr; Create an
            identity.
          </p>
        </div>
      ) : (
        <ul className="max-h-[60dvh] overflow-y-auto px-2 pb-2">
          {identities.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-coral/5"
              >
                <Avatar name={p.name} url={p.avatar_url} />
                <span className="text-base font-semibold text-warm-50">
                  {p.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — confirmation card                                          */
/* ------------------------------------------------------------------ */

function ConfirmCard({
  identity,
  onCancel,
  onClose,
}: {
  identity: Identity;
  onCancel: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-6 pb-2 pt-8 text-center">
      <Avatar name={identity.name} url={identity.avatar_url} size="lg" />
      <h2 className="mt-5 text-2xl font-bold tracking-tight text-warm-50">
        Message <span className="text-gradient-cta">{identity.name}</span>?
      </h2>
      <p className="mt-2 max-w-xs text-sm text-warm-300">
        We&rsquo;ll open a fresh conversation with them.
      </p>

      <div className="mt-8 flex w-full flex-col gap-3">
        <Link
          href={`/chat/${identity.id}`}
          onClick={onClose}
          className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-bold text-white shadow-[0_12px_28px_-8px_rgba(232,138,118,0.5),_0_6px_16px_-4px_rgba(126,196,196,0.4)] transition-all active:scale-[0.98]"
        >
          Yes, message them
        </Link>
        <button
          type="button"
          onClick={onCancel}
          className="flex h-12 items-center justify-center text-sm font-semibold text-warm-300 hover:text-warm-100"
        >
          Pick someone else
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar (shared)                                                      */
/* ------------------------------------------------------------------ */

function Avatar({
  name,
  url,
  size = "md",
}: {
  name: string;
  url: string | null;
  size?: "md" | "lg";
}) {
  const initial = (name[0] ?? "?").toUpperCase();
  const dims = size === "lg" ? "h-20 w-20 text-2xl" : "h-11 w-11 text-base";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={`${dims} rounded-full object-cover shadow-[0_4px_12px_-2px_rgba(232,138,118,0.25)] ring-2 ring-coral/20`}
      />
    );
  }
  return (
    <span
      className={`bg-gradient-cta ${dims} flex items-center justify-center rounded-full font-bold text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.3)]`}
    >
      {initial}
    </span>
  );
}
