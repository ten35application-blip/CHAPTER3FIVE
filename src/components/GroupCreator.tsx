"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Oracle = { id: string; name: string; avatarUrl: string | null };

type Props = {
  eligibleOracles: Oracle[];
  language: "en" | "es";
};

const COPY = {
  en: {
    needTwo:
      "Group chats need at least 2 of your own identities. Create another from the dashboard first.",
    namePlaceholder: "Name this group (e.g. \"family dinner\")",
    pickHint: "Pick 2–4 of your identities.",
    create: "Create group chat",
    creating: "Creating…",
    error: "Couldn't create the group. Try again?",
  },
  es: {
    needTwo:
      "Los chats grupales necesitan al menos 2 identidades tuyas. Crea otra desde el dashboard primero.",
    namePlaceholder: "Nombre del grupo (p. ej. \"cena familiar\")",
    pickHint: "Elige 2–4 de tus identidades.",
    create: "Crear chat grupal",
    creating: "Creando…",
    error: "No se pudo crear el grupo. ¿Intentas de nuevo?",
  },
};

export function GroupCreator({ eligibleOracles, language }: Props) {
  const t = COPY[language];
  const router = useRouter();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (eligibleOracles.length < 2) {
    return (
      <div className="rounded-2xl border border-warm-700/60 bg-warm-700/15 px-5 py-4">
        <p className="text-sm text-warm-200 leading-relaxed">{t.needTwo}</p>
      </div>
    );
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  }

  const canSubmit = name.trim().length > 0 && selected.size >= 2 && selected.size <= 4;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          language,
          oracle_ids: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) throw new Error(data?.error ?? t.error);
      router.push(`/groups/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-warm-400/30 bg-warm-700/20 px-5 py-5 space-y-4"
    >
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.namePlaceholder}
        maxLength={80}
        className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
      />

      <div>
        <p className="text-xs text-warm-300 mb-2">{t.pickHint}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {eligibleOracles.map((o) => {
            const isSelected = selected.has(o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => toggle(o.id)}
                className={
                  isSelected
                    ? "flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-50 bg-warm-50 text-ink transition-colors"
                    : "flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-400/30 bg-warm-700/20 text-warm-100 hover:bg-warm-700/40 transition-colors"
                }
              >
                {o.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.avatarUrl}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <span
                    className={
                      isSelected
                        ? "w-7 h-7 rounded-full bg-warm-300/50 flex-shrink-0"
                        : "w-7 h-7 rounded-full bg-warm-700/40 flex-shrink-0"
                    }
                  />
                )}
                <span className="text-sm truncate">{o.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-300/80">{error}</p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || busy}
        className="w-full h-11 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {busy ? t.creating : t.create}
      </button>
    </form>
  );
}
