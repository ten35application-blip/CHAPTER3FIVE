"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  language: "en" | "es";
  oracleName: string;
};

const COPY = {
  en: {
    placeholder:
      "She always answered the phone with \"oye\" instead of hello. Mostly quiet in groups, sharper in one-on-ones. Loved Sade, hated cilantro, dropped out of grad school the year before mom died. Kept a list of every house we ever lived in...",
    cta: "Build a starter",
    building: "Building…",
    minChars: (n: number) =>
      `A little more to work with — about ${n} more characters.`,
    error: "Couldn't build a starter from that. Try again with more detail?",
  },
  es: {
    placeholder:
      "Siempre contestaba el teléfono con \"oye\" en vez de hola. Callada en grupo, más afilada uno a uno. Adoraba a Sade, odiaba el cilantro, dejó la maestría el año antes de que muriera mamá. Guardaba una lista de cada casa donde vivimos...",
    cta: "Construir un punto de partida",
    building: "Construyendo…",
    minChars: (n: number) =>
      `Un poco más para trabajar — unos ${n} caracteres más.`,
    error: "No se pudo construir un punto de partida. ¿Intentas con más detalle?",
  },
};

const MIN_CHARS = 200;

export function MemorySeedForm({ language, oracleName }: Props) {
  const router = useRouter();
  const t = COPY[language];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (text.trim().length < MIN_CHARS) {
      setErr(t.minChars(MIN_CHARS - text.trim().length));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/onboarding/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: text.trim(), name: oracleName }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? t.error);
      }
      router.push("/agreements");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t.error);
      setBusy(false);
    }
  }

  const chars = text.trim().length;
  const enough = chars >= MIN_CHARS;

  return (
    <form onSubmit={submit} className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setErr(null);
        }}
        placeholder={t.placeholder}
        rows={12}
        maxLength={8000}
        autoFocus
        className="w-full rounded-2xl bg-warm-700/30 border border-warm-400/30 px-5 py-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors resize-y leading-relaxed text-base"
      />
      <div className="flex items-center justify-between">
        <p
          className={`text-xs ${
            enough ? "text-warm-300" : "text-warm-400"
          }`}
        >
          {chars} {language === "es" ? "caracteres" : "characters"}{" "}
          {enough && "✓"}
        </p>
        <button
          type="submit"
          disabled={busy || !enough}
          className="h-12 px-6 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? t.building : t.cta}
        </button>
      </div>
      {err && <p className="text-sm text-red-300/80">{err}</p>}
    </form>
  );
}
