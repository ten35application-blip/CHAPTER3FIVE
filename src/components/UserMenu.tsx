"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { newOracle, switchOracle } from "@/app/oracles/actions";

type OracleEntry = {
  id: string;
  name: string | null;
};

type Props = {
  oracleName: string;
  language: "en" | "es";
  oracles: OracleEntry[];
  sharedOracles?: OracleEntry[];
  activeOracleId: string | null;
  lastSeenAt?: string | null;
};

const COPY = {
  en: {
    yours: "Your thirtyfives",
    newOracle: "+ New thirtyfive",
    settings: "Settings",
    groups: "Group chats",
    signOut: "Sign out",
    untitled: "(untitled)",
  },
  es: {
    yours: "Tus thirtyfives",
    newOracle: "+ Nuevo thirtyfive",
    settings: "Ajustes",
    groups: "Chats grupales",
    signOut: "Cerrar sesión",
    untitled: "(sin título)",
  },
};

export function UserMenu({
  oracleName,
  language,
  oracles,
  sharedOracles = [],
  activeOracleId,
  lastSeenAt,
}: Props) {
  const t = COPY[language];
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);

  // Compute unread proactive/unseen count by querying messages newer than
  // lastSeenAt. Fire-and-forget on mount; failure is silent.
  useEffect(() => {
    if (!lastSeenAt) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/messages/unread?since=${encodeURIComponent(lastSeenAt)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.count === "number") {
          setUnreadCount(data.count);
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lastSeenAt]);

  useEffect(() => {
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
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex items-center gap-2 h-9 px-3 rounded-full border border-warm-400/30 bg-warm-700/30 text-warm-100 hover:bg-warm-700/50 transition-colors text-sm"
      >
        <span className="font-serif">{oracleName}</span>
        <span
          className={`text-warm-300 text-xs transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-amber text-ink text-[11px] font-medium flex items-center justify-center"
            aria-label={`${unreadCount} new`}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-warm-300/40 bg-warm-700 shadow-2xl overflow-hidden"
        >
          {oracles.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs uppercase tracking-[0.2em] text-warm-300">
                  {t.yours}
                </p>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {oracles.map((o) => {
                  const isActive = o.id === activeOracleId;
                  return (
                    <form
                      action={switchOracle}
                      key={o.id}
                      className="contents"
                    >
                      <input type="hidden" name="oracle_id" value={o.id} />
                      <button
                        type="submit"
                        disabled={isActive}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center justify-between ${
                          isActive
                            ? "text-warm-50 bg-warm-600 cursor-default"
                            : "text-warm-100 hover:bg-warm-600/60"
                        }`}
                      >
                        <span className="font-serif truncate">
                          {o.name?.trim() || t.untitled}
                        </span>
                        {isActive && (
                          <span className="text-warm-200 text-xs">●</span>
                        )}
                      </button>
                    </form>
                  );
                })}
              </div>
              <div className="border-t border-warm-600/80" />
            </>
          )}

          {sharedOracles.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs uppercase tracking-[0.2em] text-warm-300">
                  {language === "es" ? "Compartidos contigo" : "Shared with you"}
                </p>
              </div>
              {sharedOracles.map((o) => (
                <Link
                  key={o.id}
                  href={`/shared/${o.id}`}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-warm-100 hover:bg-warm-600/60 transition-colors font-serif truncate"
                >
                  {o.name?.trim() || t.untitled}
                </Link>
              ))}
              <div className="border-t border-warm-600/80" />
            </>
          )}

          {oracles.length >= 2 && (
            <Link
              href="/dashboard/group"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-warm-100 hover:bg-warm-600/60 transition-colors"
            >
              {language === "es" ? "Chat grupal" : "Group chat"}
            </Link>
          )}

          <form action={newOracle}>
            <button
              type="submit"
              className="w-full text-left px-4 py-2.5 text-sm text-warm-100 hover:bg-warm-600/60 transition-colors"
            >
              {t.newOracle}
            </button>
          </form>

          <Link
            href="/groups"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-warm-100 hover:bg-warm-600/60 transition-colors border-t border-warm-600/80"
          >
            {t.groups}
          </Link>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-warm-100 hover:bg-warm-600/60 transition-colors border-t border-warm-600/80"
          >
            {t.settings}
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left px-4 py-2.5 text-sm text-warm-100 hover:bg-warm-600/60 transition-colors border-t border-warm-600/80"
            >
              {t.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
