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
  activeOracleId: string | null;
};

const COPY = {
  en: {
    yours: "Your thirtyfives",
    newOracle: "+ New thirtyfive",
    settings: "Settings",
    signOut: "Sign out",
    untitled: "(untitled)",
  },
  es: {
    yours: "Tus thirtyfives",
    newOracle: "+ Nuevo thirtyfive",
    settings: "Ajustes",
    signOut: "Cerrar sesión",
    untitled: "(sin título)",
  },
};

export function UserMenu({
  oracleName,
  language,
  oracles,
  activeOracleId,
}: Props) {
  const t = COPY[language];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

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
        className="flex items-center gap-2 h-9 px-3 rounded-full border border-warm-400/30 bg-warm-700/30 text-warm-100 hover:bg-warm-700/50 transition-colors text-sm"
      >
        <span className="font-serif">{oracleName}</span>
        <span
          className={`text-warm-300 text-xs transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 rounded-2xl border border-warm-400/30 bg-ink-soft shadow-xl overflow-hidden"
        >
          {oracles.length > 0 && (
            <>
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs uppercase tracking-[0.2em] text-warm-400">
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
                            ? "text-warm-50 bg-warm-700/40 cursor-default"
                            : "text-warm-100 hover:bg-warm-700/30"
                        }`}
                      >
                        <span className="font-serif truncate">
                          {o.name?.trim() || t.untitled}
                        </span>
                        {isActive && (
                          <span className="text-warm-300 text-xs">●</span>
                        )}
                      </button>
                    </form>
                  );
                })}
              </div>
              <div className="border-t border-warm-700/60" />
            </>
          )}

          <form action={newOracle}>
            <button
              type="submit"
              className="w-full text-left px-4 py-2.5 text-sm text-warm-100 hover:bg-warm-700/30 transition-colors"
            >
              {t.newOracle}
            </button>
          </form>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-warm-100 hover:bg-warm-700/30 transition-colors border-t border-warm-700/60"
          >
            {t.settings}
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              className="w-full text-left px-4 py-2.5 text-sm text-warm-100 hover:bg-warm-700/30 transition-colors border-t border-warm-700/60"
            >
              {t.signOut}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
