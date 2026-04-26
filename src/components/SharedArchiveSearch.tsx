"use client";

import { useMemo, useState } from "react";
import { SharedAudioPlayer } from "./SharedAudioPlayer";

type Depth = "surface" | "texture" | "depth" | "soul";

type Entry = {
  id: number;
  question: string;
  depthLabel: string;
  depth: Depth;
  body: string;
  audioUrl: string | null;
  audioDuration: number | null;
  photoUrl: string | null;
};

type Props = {
  entries: Entry[];
  language: "en" | "es";
  ownerName: string;
};

const COPY = {
  en: {
    placeholder: "Search…",
    clear: "Clear",
    noResults: (q: string) => `Nothing matches “${q}”.`,
    countAll: (n: number) => `${n} answers.`,
    countFiltered: (shown: number, total: number) =>
      `${shown} of ${total} answers match.`,
    surface: "Surface",
    texture: "Texture",
    depth: "Depth",
    soul: "Soul",
    all: "All",
    voiceOnly: "Voice",
    photoOnly: "Photos",
  },
  es: {
    placeholder: "Buscar…",
    clear: "Limpiar",
    noResults: (q: string) => `Nada coincide con «${q}».`,
    countAll: (n: number) => `${n} respuestas.`,
    countFiltered: (shown: number, total: number) =>
      `${shown} de ${total} respuestas coinciden.`,
    surface: "Superficie",
    texture: "Textura",
    depth: "Profundidad",
    soul: "Alma",
    all: "Todas",
    voiceOnly: "Voz",
    photoOnly: "Fotos",
  },
} as const;

type Filter = "all" | "voice" | "photo";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function SharedArchiveSearch({ entries, language, ownerName }: Props) {
  const t = COPY[language];
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const total = entries.length;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return entries.filter((e) => {
      if (filter === "voice" && !e.audioUrl) return false;
      if (filter === "photo" && !e.photoUrl) return false;
      if (!q) return true;
      return (
        normalize(e.question).includes(q) || normalize(e.body).includes(q)
      );
    });
  }, [entries, query, filter]);

  const trimmed = query.trim();

  return (
    <div>
      <div className="mb-6 space-y-3">
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            className="w-full h-12 rounded-full bg-warm-700/30 border border-warm-400/30 pl-5 pr-24 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors"
          />
          {trimmed && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-warm-300 hover:text-warm-50 transition-colors"
            >
              {t.clear}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <FilterButton
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={t.all}
          />
          <FilterButton
            active={filter === "voice"}
            onClick={() => setFilter("voice")}
            label={t.voiceOnly}
          />
          <FilterButton
            active={filter === "photo"}
            onClick={() => setFilter("photo")}
            label={t.photoOnly}
          />
          <span className="ml-auto text-xs text-warm-400">
            {trimmed || filter !== "all"
              ? t.countFiltered(filtered.length, total)
              : t.countAll(total)}
          </span>
        </div>
      </div>

      <div className="space-y-10">
        {filtered.map((e) => (
          <div key={e.id} className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-warm-300">
              {e.depthLabel} · #{e.id}
            </p>
            <h2 className="font-serif text-xl text-warm-50 leading-snug">
              <Highlight text={e.question} query={trimmed} />
            </h2>
            {e.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.photoUrl}
                alt=""
                className="rounded-2xl max-w-md w-full max-h-96 object-cover border border-warm-300/20"
              />
            )}
            {e.body && (
              <p className="text-warm-100 font-serif text-lg leading-relaxed whitespace-pre-wrap">
                <Highlight text={e.body} query={trimmed} />
              </p>
            )}
            {e.audioUrl && (
              <SharedAudioPlayer
                url={e.audioUrl}
                durationSeconds={e.audioDuration ?? 0}
                language={language}
              />
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-warm-300 italic text-center py-16">
            {trimmed
              ? t.noResults(trimmed)
              : language === "es"
                ? `${ownerName} aún no ha grabado respuestas.`
                : `${ownerName} hasn't recorded any answers yet.`}
          </p>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "text-xs uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-warm-50 text-ink"
          : "text-xs uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border border-warm-400/30 text-warm-200 hover:text-warm-50 hover:border-warm-200/60 transition-colors"
      }
    >
      {label}
    </button>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const nQuery = normalize(query);
  if (!nQuery) return <>{text}</>;

  // Walk the source string by codepoint, comparing against a normalized
  // window — this preserves the original case + accents in the output.
  const pieces: Array<{ s: string; hit: boolean }> = [];
  let i = 0;
  while (i < text.length) {
    const remaining = text.slice(i);
    const nRemaining = normalize(remaining);
    const idx = nRemaining.indexOf(nQuery);
    if (idx < 0) {
      pieces.push({ s: remaining, hit: false });
      break;
    }
    if (idx > 0) {
      // Find the prefix in the original string whose normalized length
      // equals idx. Since normalize() may collapse chars, we walk
      // character-by-character.
      let consumed = 0;
      let k = 0;
      while (k < remaining.length && consumed < idx) {
        consumed += normalize(remaining[k]).length;
        k++;
      }
      pieces.push({ s: remaining.slice(0, k), hit: false });
      i += k;
      continue;
    }
    // idx === 0: take enough chars to cover the query length.
    let consumed = 0;
    let k = 0;
    while (k < remaining.length && consumed < nQuery.length) {
      consumed += normalize(remaining[k]).length;
      k++;
    }
    pieces.push({ s: remaining.slice(0, k), hit: true });
    i += k;
  }

  return (
    <>
      {pieces.map((p, idx) =>
        p.hit ? (
          <mark
            key={idx}
            className="bg-warm-200/30 text-warm-50 rounded px-0.5"
          >
            {p.s}
          </mark>
        ) : (
          <span key={idx}>{p.s}</span>
        ),
      )}
    </>
  );
}
