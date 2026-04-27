"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  language: "en" | "es";
  isAdmin?: boolean;
};

const COPY = {
  en: {
    open: "Menu",
    dashboard: "Dashboard",
    identities: "Identities",
    sharing: "Share & inherit",
    groups: "Group chats",
    account: "Account",
    settings: "Settings",
    admin: "Admin",
  },
  es: {
    open: "Menú",
    dashboard: "Dashboard",
    identities: "Identidades",
    sharing: "Compartir y heredar",
    groups: "Chats grupales",
    account: "Cuenta",
    settings: "Ajustes",
    admin: "Admin",
  },
};

/**
 * Floating navigation button. Sits bottom-right on every authenticated
 * page. Tap to expand a vertical popup with shortcuts to all the
 * places you'd want to be — kills the "stuck on a page with only a
 * back arrow" problem cold.
 *
 * Hidden on landing/auth/legal-doc paths where it'd just be noise.
 */
export function NavFab({ language, isAdmin = false }: Props) {
  const t = COPY[language];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Hide on routes where the FAB doesn't belong: marketing, auth,
  // legal docs, the in-flight onboarding (where the user shouldn't
  // be skipping out before the new identity is named).
  const hidden =
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/legacy") ||
    pathname === "/about" ||
    pathname === "/how" ||
    pathname === "/support" ||
    pathname === "/sample" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/cookies" ||
    pathname === "/account-deleted";

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close menu on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (hidden) return null;

  return (
    <div
      ref={ref}
      className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2"
    >
      {open && (
        <div className="rounded-2xl border border-warm-300/60 bg-ink-soft shadow-2xl backdrop-blur-xl overflow-hidden w-56 mb-1">
          <NavLink href="/dashboard" label={t.dashboard} />
          <NavLink href="/identities" label={t.identities} />
          <NavLink href="/groups" label={t.groups} />
          <NavLink href="/sharing" label={t.sharing} />
          <NavLink href="/account" label={t.account} />
          <NavLink href="/settings" label={t.settings} />
          {isAdmin && <NavLink href="/admin" label={t.admin} />}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.open}
        className="w-14 h-14 rounded-full bg-warm-50 text-ink shadow-2xl flex items-center justify-center hover:bg-warm-100 active:scale-95 transition-all border border-warm-300/40"
      >
        <svg
          viewBox="0 0 24 24"
          className={`w-6 h-6 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-4 py-3 text-sm text-warm-100 hover:bg-warm-700/40 hover:text-warm-50 transition-colors border-b border-warm-700/40 last:border-b-0"
    >
      {label}
    </Link>
  );
}
