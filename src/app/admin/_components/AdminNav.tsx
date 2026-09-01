"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/revenue", label: "Revenue" },
  { href: "/admin/identities", label: "Identities" },
  { href: "/admin/rewards", label: "Rewards" },
  { href: "/admin/reports", label: "Reports" },
] as const;

/** Sidebar nav with active-section highlighting. Client-only because the
 *  active state needs usePathname; everything else in the chrome is server. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
      {ITEMS.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-full bg-warm-700/70 px-4 py-2 text-sm font-semibold text-warm-50"
                : "rounded-full px-4 py-2 text-sm font-medium text-warm-300 transition-colors hover:bg-warm-700/40 hover:text-warm-100"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
