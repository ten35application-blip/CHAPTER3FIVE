"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  oracleId: string;
  oracleName: string;
  language: "en" | "es";
};

const COPY = {
  en: {
    trigger: "Add more about them",
    title: (n: string) => `Tell me more about ${n}.`,
    intro:
      "Anything new — a memory, a phrase they used, the thing they hated. It gets added to what they know about themselves.",
    placeholder:
      "She used to wake me up by humming. Hated when anyone clinked silverware on a plate. Bought the same brand of yellow notebooks her whole life...",
    submit: "Add",
    submitting: "Adding…",
    cancel: "Cancel",
    minChars: (n: number) => `A little more — about ${n} more characters.`,
    success: (n: number) =>
      n > 0
        ? `Saved. They learned ${n} new thing${n === 1 ? "" : "s"} about themselves.`
        : "Saved.",
    error: "Couldn't save. Try again?",
  },
  es: {
    trigger: "Agregar más sobre ellos",
    title: (n: string) => `Cuéntame más de ${n}.`,
    intro:
      "Cualquier cosa nueva — un recuerdo, una frase que usaban, lo que odiaban. Se agrega a lo que saben sobre sí mismos.",
    placeholder:
      "Me despertaba tarareando. Odiaba cuando alguien hacía ruido con los cubiertos. Compraba la misma marca de cuadernos amarillos toda su vida...",
    submit: "Agregar",
    submitting: "Agregando…",
    cancel: "Cancelar",
    minChars: (n: number) => `Un poco más — unos ${n} caracteres más.`,
    success: (n: number) =>
      n > 0
        ? `Guardado. Aprendieron ${n} cosa${n === 1 ? "" : "s"} nueva${n === 1 ? "" : "s"} sobre sí mismos.`
        : "Guardado.",
    error: "No se pudo guardar. ¿Intentas de nuevo?",
  },
};

const MIN_CHARS = 60;

/**
 * Memory-mode "Add more about them" sheet. Lives next to the chat
 * header for any memory-mode identity. The user types whatever new
 * detail they want; we append to the seed and extract durable
 * persona memories so the chat persona uses them immediately.
 */
export function AddMoreSheet({ oracleId, oracleName, language }: Props) {
  const router = useRouter();
  const t = COPY[language];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (text.trim().length < MIN_CHARS) {
      setErr(t.minChars(MIN_CHARS - text.trim().length));
      return;
    }
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const res = await fetch(`/api/identities/${oracleId}/memory-add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error ?? t.error);
      }
      setOk(t.success(Number(data.extracted ?? 0)));
      setText("");
      router.refresh();
      // Auto-close after a beat so the user sees the success.
      setTimeout(() => {
        setOpen(false);
        setOk(null);
      }, 1800);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setErr(null);
          setOk(null);
        }}
        className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
      >
        {t.trigger}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="w-full max-w-lg bg-ink-soft border border-warm-300/40 rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-3">
              <h2 className="font-serif text-2xl text-warm-50">
                {t.title(oracleName)}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-warm-400 hover:text-warm-100 transition-colors text-2xl leading-none p-1 -mt-1"
                aria-label={t.cancel}
              >
                ×
              </button>
            </div>
            <p className="text-sm text-warm-300 mb-4 leading-relaxed">
              {t.intro}
            </p>

            <form onSubmit={submit} className="space-y-3">
              <textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setErr(null);
                }}
                placeholder={t.placeholder}
                rows={8}
                maxLength={5000}
                autoFocus
                className="w-full rounded-2xl bg-warm-700/30 border border-warm-400/30 px-5 py-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors resize-y leading-relaxed text-sm"
              />
              {err && <p className="text-sm text-red-300/80">{err}</p>}
              {ok && <p className="text-sm text-warm-100">{ok}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="h-11 px-4 rounded-full border border-warm-400/30 text-warm-100 hover:bg-warm-700/40 transition-colors text-sm"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={busy || text.trim().length < MIN_CHARS}
                  className="flex-1 h-11 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {busy ? t.submitting : t.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
