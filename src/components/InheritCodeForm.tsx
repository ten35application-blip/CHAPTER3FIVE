"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeShareCode } from "@/lib/share";

type Props = {
  language: "en" | "es";
};

const COPY = {
  en: {
    title: "Inherit a code",
    hint:
      "Someone shared their archive with you, or named you as a beneficiary. Paste the code or claim link.",
    placeholder: "XXXX-XXXX-XXXX",
    cta: "Connect",
    error: "That code doesn't look right.",
  },
  es: {
    title: "Heredar un código",
    hint:
      "Alguien compartió su archivo contigo o te nombró beneficiario. Pega el código o enlace.",
    placeholder: "XXXX-XXXX-XXXX",
    cta: "Conectar",
    error: "Ese código no parece correcto.",
  },
};

/**
 * Lives inside Settings (/sharing) so users can paste a code they
 * were given without leaving the conceptual Settings hierarchy.
 * Mirrors the inline form in HomeChrome's compose sheet — same
 * normalization, same routing rules:
 *   12 chars → /invite/[code]   (share or invite code)
 *   32 chars → /legacy/[token]  (beneficiary claim link)
 */
export function InheritCodeForm({ language }: Props) {
  const t = COPY[language];
  const router = useRouter();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeShareCode(code);
    if (normalized.length === 12) {
      const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
      router.push(`/invite/${encodeURIComponent(formatted)}`);
      return;
    }
    if (normalized.length === 32) {
      router.push(`/legacy/${encodeURIComponent(normalized.toLowerCase())}`);
      return;
    }
    setErr(t.error);
  }

  return (
    <section className="mb-10 rounded-2xl border border-warm-700/50 bg-warm-700/15 p-5">
      <h2 className="font-serif text-xl text-warm-50 mb-1">{t.title}</h2>
      <p className="text-sm text-warm-300 mb-4 leading-relaxed">{t.hint}</p>
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setErr(null);
          }}
          placeholder={t.placeholder}
          spellCheck={false}
          autoCapitalize="characters"
          className="flex-1 h-11 rounded-full bg-warm-700/40 border border-warm-400/40 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm font-mono tracking-wider uppercase min-w-0"
        />
        <button
          type="submit"
          disabled={!code.trim()}
          className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
        >
          {t.cta}
        </button>
      </form>
      {err && (
        <p className="text-xs text-red-300/80 mt-2 px-1">{err}</p>
      )}
    </section>
  );
}
