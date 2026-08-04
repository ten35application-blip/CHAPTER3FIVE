"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ProfileAvatarImage } from "@/components/profile-avatar-image";

type Props = {
  email: string;
  isAdmin: boolean;
  signOutAction: () => void;
  /** Signed URL for the user's profile photo, or null for initial fallback. */
  avatarUrl: string | null;
};

/**
 * User avatar in the top-right of the dashboard. Tap → dropdown menu.
 * Replaces the old "Edit" text pill. Renders the user's uploaded
 * profile photo when set (private profile-avatars bucket, signed
 * server-side); falls back to the gradient email-initial circle.
 *
 * Admin link (Admin dashboard) only renders for allowlisted emails.
 * The isAdmin flag is computed server-side in the page component and
 * passed in — the client never trusts a client-side allowlist check.
 */
export function UserMenu({ email, isAdmin, signOutAction, avatarUrl }: Props) {
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
      {/* Avatar button — mobile-parity double ring: outer coral, inner
          teal, ink-soft disc holding either the user's photo or their
          email initial in coral-strong. The mobile UserBubble uses two
          concentric 2px + 1.5px border rings; we approximate on web
          with a coral outer ring on the button and a teal inner ring
          on the inset avatar disc. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Your account"
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full ring-2 ring-coral transition-transform hover:-translate-y-px active:scale-95"
      >
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-ink-soft ring-[1.5px] ring-teal">
          <ProfileAvatarImage
            signedUrl={avatarUrl}
            className="h-full w-full object-cover"
            fallback={
              <span className="text-sm font-bold text-coral-strong">
                {initial}
              </span>
            }
          />
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="animate-menu-in absolute right-0 top-12 z-30 w-72 overflow-hidden rounded-2xl bg-ink-soft shadow-[0_16px_36px_-14px_rgba(28,28,26,0.20),_0_6px_16px_-6px_rgba(28,28,26,0.10)] ring-1 ring-warm-700"
        >
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-coral/5"
          >
            <ProfileAvatarImage
              signedUrl={avatarUrl}
              className="h-10 w-10 rounded-full object-cover shadow-[0_4px_12px_-2px_rgba(232,138,118,0.3)]"
              fallback={
                <span className="bg-gradient-cta flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.3)]">
                  {initial}
                </span>
              }
            />
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
              <span className="font-bold text-coral-strong">Admin</span>
            </MenuItem>
          ) : null}

          {/* Recently-deleted moved into the hub FAB (Trash sub-panel)
              per Wilson — settings is for the ACCOUNT, not for what's
              in the dashboard. */}

          <MenuItem href="/settings" onClose={() => setOpen(false)}>
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center text-warm-400"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
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
