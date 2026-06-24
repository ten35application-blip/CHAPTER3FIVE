"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  language: "en" | "es";
};

const COPY = {
  en: { settings: "Settings" },
  es: { settings: "Ajustes" },
};

/**
 * Mobile chrome — a single floating glass pill anchored bottom-right
 * with a Settings cog. Replaces the four-tab BottomNav.
 *
 * iMessage-shape: the home screen IS the conversation list, the only
 * persistent chrome is one cog corner. Everything else (identities,
 * sharing, trash, etc.) is reached *from* Settings — keeps the home
 * surface uncluttered the way Apple's Messages does.
 *
 * Desktop (md+) is handled by NavFab.
 */
export function HomeChrome({ language }: Props) {
  const t = COPY[language];
  const pathname = usePathname();

  // Same hidden set as BottomNav had — marketing/auth/legal/onboarding
  // shouldn't show app chrome.
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
    pathname === "/account-deleted" ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/agreements") ||
    // Inside chat threads the keyboard/composer owns the bottom area;
    // a floating pill would land on top of the send button.
    pathname.startsWith("/chat/") ||
    pathname.startsWith("/shared/") ||
    pathname.startsWith("/groups/") ||
    pathname.startsWith("/beneficiary-groups/");

  if (hidden) return null;

  // Don't render on /account itself — they're already there.
  const onAccount = pathname === "/account" || pathname.startsWith("/account/");

  return (
    <div
      className="fixed z-30 md:hidden"
      style={{
        right: "max(1rem, env(safe-area-inset-right))",
        bottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <Link
        href="/account"
        aria-label={t.settings}
        title={t.settings}
        aria-current={onAccount ? "page" : undefined}
        className={`w-14 h-14 rounded-full backdrop-blur-2xl border flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] transition-colors ${
          onAccount
            ? "bg-warm-50 border-warm-50 text-ink"
            : "bg-ink-soft/70 border-warm-700/50 text-warm-100 hover:text-warm-50 hover:bg-ink-soft/85"
        }`}
      >
        <SettingsIcon />
      </Link>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-6 h-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}
