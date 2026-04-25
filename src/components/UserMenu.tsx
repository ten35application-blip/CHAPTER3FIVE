"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/auth/actions";

type Props = {
  oracleName: string;
  language: "en" | "es";
};

const COPY = {
  en: {
    current: "Current thirtyfive",
    newOracle: "+ New thirtyfive",
    soon: "soon",
    settings: "Settings",
    signOut: "Sign out",
  },
  es: {
    current: "Thirtyfive actual",
    newOracle: "+ Nuevo thirtyfive",
    soon: "pronto",
    settings: "Ajustes",
    signOut: "Cerrar sesión",
  },
};

export function UserMenu({ oracleName, language }: Props) {
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
        <span className={`text-warm-300 text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-2xl border border-warm-400/30 bg-ink-soft shadow-xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-warm-700/60">
            <p className="text-xs uppercase tracking-[0.2em] text-warm-400">
              {t.current}
            </p>
            <p className="font-serif text-warm-50 text-base mt-1">{oracleName}</p>
          </div>

          <button
            type="button"
            disabled
            className="w-full text-left px-4 py-2.5 text-sm text-warm-400 hover:bg-warm-700/30 transition-colors flex items-center justify-between cursor-not-allowed"
          >
            <span>{t.newOracle}</span>
            <span className="text-xs uppercase tracking-wider text-warm-500">
              {t.soon}
            </span>
          </button>

          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm text-warm-100 hover:bg-warm-700/30 transition-colors"
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
