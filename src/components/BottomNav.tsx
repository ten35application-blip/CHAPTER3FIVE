"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  language: "en" | "es";
  isAdmin?: boolean;
};

const COPY = {
  en: {
    chats: "Chats",
    identities: "Identities",
    sharing: "Share",
    account: "Account",
    admin: "Admin",
  },
  es: {
    chats: "Chats",
    identities: "Identidades",
    sharing: "Compartir",
    account: "Cuenta",
    admin: "Admin",
  },
};

/**
 * Glass bottom navigation — frosted backdrop, semi-transparent, the
 * look Reddit and Instagram use. Visible on touch / phone / tablet
 * widths; hidden on desktop where the user can navigate via the
 * top-right menu. Replaces NavFab on the same surface.
 *
 * Skips itself on landing / auth / legal / sample pages where bottom
 * chrome would just be noise.
 */
export function BottomNav({ language, isAdmin = false }: Props) {
  const t = COPY[language];
  const pathname = usePathname();

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
    pathname.startsWith("/agreements");

  if (hidden) return null;

  const isActive = (href: string) => {
    if (href === "/dashboard")
      return (
        pathname === "/dashboard" ||
        pathname.startsWith("/chat/") ||
        pathname.startsWith("/shared/") ||
        pathname.startsWith("/groups/") ||
        pathname.startsWith("/beneficiary-groups/")
      );
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-30 md:hidden"
    >
      {/* Glass plate. Twist on Reddit/IG: warmer tint via our amber-
          accent border-top, not the cool-tone grays Apple uses. */}
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-px bg-amber/30" />
        <div className="bg-ink-soft/55 backdrop-blur-2xl border-t border-warm-700/40 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)]">
          <ul className="max-w-2xl mx-auto px-2 flex items-stretch justify-between">
            <NavItem
              href="/dashboard"
              label={t.chats}
              active={isActive("/dashboard")}
              icon={<ChatsIcon />}
            />
            <NavItem
              href="/identities"
              label={t.identities}
              active={isActive("/identities")}
              icon={<IdentitiesIcon />}
            />
            <NavItem
              href="/sharing"
              label={t.sharing}
              active={isActive("/sharing")}
              icon={<SharingIcon />}
            />
            <NavItem
              href="/account"
              label={t.account}
              active={isActive("/account")}
              icon={<AccountIcon />}
            />
            {isAdmin && (
              <NavItem
                href="/admin"
                label={t.admin}
                active={isActive("/admin")}
                icon={<AdminIcon />}
              />
            )}
          </ul>
          {/* Honor bottom safe-area on iOS. */}
          <div style={{ height: "env(safe-area-inset-bottom)" }} />
        </div>
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  active,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  icon: React.ReactNode;
}) {
  return (
    <li className="flex-1">
      <Link
        href={href}
        className={`flex flex-col items-center justify-center gap-1 py-2 transition-colors ${
          active ? "text-warm-50" : "text-warm-400 hover:text-warm-200"
        }`}
      >
        <span
          className={`w-6 h-6 flex items-center justify-center transition-transform ${
            active ? "scale-110" : ""
          }`}
        >
          {icon}
        </span>
        <span
          className={`text-[10px] tracking-wide ${
            active ? "text-warm-100" : ""
          }`}
        >
          {label}
        </span>
        {/* Active indicator — amber dot under the icon. Our twist on
            the typical underline indicator. */}
        <span
          className={`w-1 h-1 rounded-full ${
            active ? "bg-amber" : "bg-transparent"
          }`}
          aria-hidden
        />
      </Link>
    </li>
  );
}

function ChatsIcon() {
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
      <path d="M21 12c0 4.5-4 8-9 8-1.4 0-2.7-.2-3.9-.7L3 21l1.6-4.4C3.6 15.2 3 13.7 3 12 3 7.5 7 4 12 4s9 3.5 9 8z" />
    </svg>
  );
}

function IdentitiesIcon() {
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
      <circle cx="9" cy="9" r="3.2" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" />
      <path d="M14 17c.5-1.8 2.3-3 4.5-3s3.5 1 3.5 3" />
    </svg>
  );
}

function SharingIcon() {
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
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}

function AccountIcon() {
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
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function AdminIcon() {
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
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
