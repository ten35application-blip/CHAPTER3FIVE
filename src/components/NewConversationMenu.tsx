"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { newOracle } from "@/app/oracles/actions";

type Props = {
  language: "en" | "es";
};

const COPY = {
  en: {
    open: "New",
    newIdentity: "+ New identity",
    newIdentityHint: "Start a fresh archive — yours, your dad's, anyone's.",
    newGroup: "+ New group chat",
    newGroupHint: "Put two or more of your identities in one room.",
    seeRemoved: "See removed identities",
    seeRemovedHint: "Soft-deleted identities still in their 30-day grace.",
  },
  es: {
    open: "Nuevo",
    newIdentity: "+ Nueva identidad",
    newIdentityHint: "Empieza un archivo nuevo — tuyo, de tu papá, de quien sea.",
    newGroup: "+ Nuevo chat grupal",
    newGroupHint: "Pon dos o más de tus identidades en un cuarto.",
    seeRemoved: "Ver identidades eliminadas",
    seeRemovedHint: "Identidades en su periodo de gracia de 30 días.",
  },
};

/**
 * Dashboard-only "+ New" menu. Sits next to the page title; opens a
 * small popover with the actions you'd want from a conversation
 * list: create another identity, create a group chat, or browse
 * recently-removed identities.
 *
 * Lives separately from the global NavFab (which is for navigation
 * to top-level pages). This is for *making things* on the dashboard.
 */
export function NewConversationMenu({ language }: Props) {
  const t = COPY[language];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-10 px-4 rounded-full border border-warm-300/40 text-warm-100 hover:bg-warm-700/40 hover:text-warm-50 transition-colors text-sm flex items-center gap-1.5"
      >
        <span className="text-base leading-none">+</span>
        <span>{t.open}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-warm-300/60 bg-ink-soft shadow-2xl backdrop-blur-xl overflow-hidden z-40">
          <form action={newOracle}>
            <button
              type="submit"
              className="block w-full text-left px-4 py-3 hover:bg-warm-700/40 transition-colors border-b border-warm-700/40"
            >
              <p className="text-sm font-medium text-warm-50">
                {t.newIdentity}
              </p>
              <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
                {t.newIdentityHint}
              </p>
            </button>
          </form>

          <Link
            href="/groups"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 hover:bg-warm-700/40 transition-colors border-b border-warm-700/40"
          >
            <p className="text-sm font-medium text-warm-50">{t.newGroup}</p>
            <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
              {t.newGroupHint}
            </p>
          </Link>

          <Link
            href="/identities"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 hover:bg-warm-700/40 transition-colors"
          >
            <p className="text-sm font-medium text-warm-50">{t.seeRemoved}</p>
            <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
              {t.seeRemovedHint}
            </p>
          </Link>
        </div>
      )}
    </div>
  );
}
