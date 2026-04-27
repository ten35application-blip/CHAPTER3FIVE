"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Archive = { id: string; name: string; avatarUrl: string | null };

type Props = {
  eligibleArchives: Archive[];
  language: "en" | "es";
};

const COPY = {
  en: {
    pickArchive: "Which archive?",
    namePlaceholder: 'Name this room (e.g. "with mom, with my sister")',
    create: "Create room",
    creating: "Creating…",
    error: "Couldn't create the room. Try again?",
  },
  es: {
    pickArchive: "¿Qué archivo?",
    namePlaceholder: 'Nombre del cuarto (p. ej. "con mamá, con mi hermana")',
    create: "Crear cuarto",
    creating: "Creando…",
    error: "No se pudo crear el cuarto. ¿Intentas de nuevo?",
  },
};

export function BeneficiaryGroupCreator({
  eligibleArchives,
  language,
}: Props) {
  const t = COPY[language];
  const router = useRouter();
  const [name, setName] = useState("");
  const [oracleId, setOracleId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (eligibleArchives.length === 0) return null;

  const canSubmit = name.trim().length > 0 && oracleId !== "" && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/beneficiary-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oracle_id: oracleId,
          name: name.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) throw new Error(data?.error ?? t.error);
      router.push(`/beneficiary-groups/${data.id}`);
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
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-warm-300 mb-2">
          {t.pickArchive}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {eligibleArchives.map((a) => {
            const isSelected = oracleId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setOracleId(a.id)}
                className={
                  isSelected
                    ? "flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-50 bg-warm-50 text-ink transition-colors"
                    : "flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-400/30 bg-warm-700/20 text-warm-100 hover:bg-warm-700/40 transition-colors"
                }
              >
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.avatarUrl}
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
                <span className="text-sm truncate">{a.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.namePlaceholder}
        maxLength={80}
        className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
      />

      {error && <p className="text-sm text-red-300/80">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full h-11 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {busy ? t.creating : t.create}
      </button>
    </form>
  );
}
