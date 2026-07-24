"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Props = {
  email: string;
  isAdmin: boolean;
  signOutAction: () => void;
};

/**
 * User avatar in the top-right of the dashboard. Tap → dropdown menu.
 * Replaces the old "Edit" text pill. The avatar is currently a
 * gradient-filled circle with the email's first initial; when we
 * add a photo upload flow in Settings, swap `initial` for the
 * uploaded avatar_url on the profile.
 *
 * Admin link (Admin dashboard) only renders for allowlisted emails.
 * The isAdmin flag is computed server-side in the page component and
 * passed in — the client never trusts a client-side allowlist check.
 */
export function UserMenu({ email, isAdmin, signOutAction }: Props) {
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
      {/* Avatar button — filled with the brand gradient, ring for
          weight against the peach page. Bigger than the old Edit pill
          because it's now the primary chrome anchor. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account"
        className="bg-gradient-cta flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white shadow-[0_6px_18px_-4px_rgba(232,138,118,0.4),_0_2px_8px_-2px_rgba(126,196,196,0.3)] ring-2 ring-white/50 transition-transform hover:-translate-y-px active:scale-95"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-menu-in absolute right-0 top-12 z-30 w-72 overflow-hidden rounded-2xl bg-ink-soft shadow-[0_24px_48px_-16px_rgba(28,28,26,0.18),_0_10px_28px_rgba(232,138,118,0.12)] ring-1 ring-warm-700"
        >
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
              <span className="text-xs text-warm-300">Name &amp; Photo</span>
            </span>
          </Link>

          <div className="mx-4 h-px bg-gradient-to-r from-transparent via-coral/25 to-transparent" />

          <MenuItem href="/identity/create" onClose={() => setOpen(false)}>
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

          {/* Admin link — sits ABOVE Settings, gradient-colored so it
              signals "you have elevated access here." Only rendered
              when the server-computed isAdmin flag is true. */}
          {isAdmin ? (
            <MenuItem href="/admin" onClose={() => setOpen(false)}>
              <span
                aria-hidden
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-coral/12 text-base leading-none"
              >
                <span className="text-gradient-cta">◆</span>
              </span>
              <span className="text-gradient-cta font-bold">Admin</span>
            </MenuItem>
          ) : null}

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
