"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

type Oracle = { id: string; name: string; avatar_url: string | null };

const COPY = {
  en: { start: "Start group chat", picked: "picked", max: "max 3" },
  es: { start: "Empezar chat grupal", picked: "elegidos", max: "máx 3" },
};

export function GroupSelectorClient({
  oracles,
  language,
}: {
  oracles: Oracle[];
  language: "en" | "es";
}) {
  const t = COPY[language];
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  }

  const startHref = `/dashboard/group?ids=${Array.from(selected).join(",")}`;
  const canStart = selected.size >= 2;

  return (
    <div className="space-y-3">
      {oracles.map((o) => {
        const isSel = selected.has(o.id);
        const disabled = !isSel && selected.size >= 3;
        return (
          <button
            key={o.id}
            type="button"
            disabled={disabled}
            onClick={() => toggle(o.id)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl border transition-colors text-left ${
              isSel
                ? "border-warm-200 bg-warm-700/60"
                : disabled
                  ? "border-warm-700/40 bg-warm-700/10 opacity-50 cursor-not-allowed"
                  : "border-warm-700/60 bg-warm-700/20 hover:bg-warm-700/40"
            }`}
          >
            <div className="w-12 h-12 rounded-full overflow-hidden bg-warm-700/50 border border-warm-400/20 flex items-center justify-center shrink-0">
              {o.avatar_url ? (
                <Image
                  src={o.avatar_url}
                  alt=""
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-warm-400 text-xs">—</span>
              )}
            </div>
            <span className="font-serif text-warm-50 text-lg flex-1">
              {o.name}
            </span>
            <span
              className={`w-5 h-5 rounded-full border ${
                isSel
                  ? "border-warm-200 bg-warm-200"
                  : "border-warm-400/50 bg-transparent"
              }`}
            />
          </button>
        );
      })}

      <div className="pt-6 flex items-center justify-between">
        <span className="text-xs text-warm-400">
          {selected.size} {t.picked} · {t.max}
        </span>
        {canStart ? (
          <Link
            href={startHref}
            className="h-11 px-6 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm inline-flex items-center justify-center"
          >
            {t.start}
          </Link>
        ) : (
          <span className="h-11 px-6 rounded-full bg-warm-700/40 text-warm-400 font-medium text-sm inline-flex items-center justify-center cursor-not-allowed">
            {t.start}
          </span>
        )}
      </div>
    </div>
  );
}
