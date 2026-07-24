"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  email: string;
  signOutAction: () => void;
};

export function EditMenu({ email, signOutAction }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      {/* Edit pill — was plain frosted gray; now sits on the warm ink-soft
          surface with a coral-tinted shadow and a small coral dot that
          signals "there's identity here" at a glance. Height bumped
          h-9 -> h-10 for weight. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 items-center gap-2 rounded-full bg-ink-soft/90 pl-3 pr-4 text-sm font-semibold text-warm-100 shadow-[0_4px_12px_-2px_rgba(232,138,118,0.15)] ring-1 ring-warm-700/70 backdrop-blur transition-all hover:-translate-y-px hover:bg-ink-soft hover:ring-coral/40"
      >
        <span
          aria-hidden
          className="bg-gradient-cta h-2 w-2 rounded-full"
        />
        Edit
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-menu-in absolute left-0 top-12 z-20 w-72 overflow-hidden rounded-2xl bg-ink-soft shadow-[0_24px_48px_-16px_rgba(28,28,26,0.18),_0_10px_28px_rgba(232,138,118,0.12)] ring-1 ring-warm-700"
        >
          {/* Profile card — avatar circle now filled with the brand
              gradient so the menu opens with a splash of color. */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-coral/5"
          >
            <span className="bg-gradient-cta flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.3)]">
              {initial}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-warm-50">
                {email}
              </span>
              <span className="text-xs text-warm-300">Name & Photo</span>
            </span>
          </Link>

          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-coral/25 to-transparent" />

          {/* The two identity actions get gradient-clipped glyphs on
              coral wells so the primary create actions read as brand-
              colored moments rather than plain menu rows. */}
          <MenuItem href="/identity/new" onClose={() => setOpen(false)}>
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-coral/12 text-lg font-bold leading-none"
            >
              <span className="text-gradient-cta">+</span>
            </span>
            <span className="font-semibold">Create an identity</span>
          </MenuItem>
          <MenuItem href="/identity/inherit" onClose={() => setOpen(false)}>
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-coral/12 text-base leading-none"
            >
              <span className="text-gradient-cta">↩</span>
            </span>
            <span className="font-semibold">Inherit an identity</span>
          </MenuItem>

          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-coral/25 to-transparent" />

          <MenuItem href="/settings" onClose={() => setOpen(false)}>
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center text-base leading-none text-warm-400"
            >
              ⚙
            </span>
            <span>Settings</span>
          </MenuItem>

          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-coral/25 to-transparent" />

          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full px-4 py-3 text-center text-sm font-medium text-warm-200 transition-colors hover:bg-coral/5 hover:text-coral-strong"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  href,
  children,
  onClose,
}: {
  href: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex items-center gap-3 px-4 py-3 text-sm text-warm-50 transition-colors hover:bg-coral/5"
    >
      {children}
    </Link>
  );
}
