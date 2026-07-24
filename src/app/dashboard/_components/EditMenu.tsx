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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center rounded-full bg-warm-700/70 px-4 text-sm font-medium text-warm-100 backdrop-blur transition-colors hover:bg-warm-700"
      >
        Edit
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-menu-in absolute left-0 top-11 z-20 w-72 overflow-hidden rounded-2xl bg-ink-soft shadow-xl ring-1 ring-warm-700"
        >
          {/* Profile card */}
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-warm-700/30"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber text-base font-semibold text-white">
              {initial}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-warm-50">
                {email}
              </span>
              <span className="text-xs text-warm-300">Name & Photo</span>
            </span>
          </Link>

          <div className="h-px bg-warm-700" />

          <MenuItem href="/identity/new" onClose={() => setOpen(false)}>
            <span aria-hidden className="text-lg leading-none text-amber">
              +
            </span>
            <span>Create an identity</span>
          </MenuItem>
          <MenuItem href="/identity/inherit" onClose={() => setOpen(false)}>
            <span aria-hidden className="text-base leading-none text-amber">
              ↩
            </span>
            <span>Inherit an identity</span>
          </MenuItem>

          <div className="h-px bg-warm-700" />

          <MenuItem href="/settings" onClose={() => setOpen(false)}>
            <span aria-hidden className="text-base leading-none text-warm-300">
              ⚙
            </span>
            <span>Settings</span>
          </MenuItem>

          <div className="h-px bg-warm-700" />

          <form action={signOutAction}>
            <button
              type="submit"
              className="w-full px-4 py-3 text-center text-sm font-medium text-warm-100 hover:bg-warm-700/30"
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
      className="flex items-center gap-3 px-4 py-3 text-sm text-warm-50 hover:bg-warm-700/30"
    >
      {children}
    </Link>
  );
}
