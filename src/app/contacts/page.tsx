import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { switchOracle } from "../oracles/actions";

export const metadata = {
  title: "Contacts — chapter3five",
};

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, active_oracle_id")
    .eq("id", user.id)
    .maybeSingle();
  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const activeId = profile?.active_oracle_id ?? null;
  const t = COPY[language];

  const { data: oracleRows } = await supabase
    .from("oracles")
    .select("id, name, avatar_url, mode, created_at")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("name", { ascending: true });
  const oracles = oracleRows ?? [];

  // Trashed count for the footer link.
  const { count: trashedCount } = await supabase
    .from("oracles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .not("deleted_at", "is", null);

  return (
    <>
      <header className="border-b border-warm-700/40">
        {/* pr-16 on mobile leaves room for HomeChrome's top-right compose
            pill so the right-aligned "Manage" link doesn't sit under it. */}
        <div className="max-w-2xl mx-auto pl-6 pr-16 md:pr-6 py-6 flex items-center gap-3">
          <Link
            href="/account"
            aria-label={t.back}
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-warm-200 hover:text-warm-50 hover:bg-warm-700/30 transition-colors"
          >
            <BackIcon />
          </Link>
          <h1 className="font-serif text-xl tracking-tight text-warm-50 flex-1">
            {t.title}
          </h1>
          <Link
            href="/identities"
            className="text-sm text-warm-300 hover:text-warm-50 transition-colors"
          >
            {t.manage}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-8 pb-32">
          <p className="text-sm text-warm-300 mb-8 leading-relaxed">
            {t.intro}
          </p>

          {saved && (
            <div className="rounded-lg bg-warm-700/30 border border-warm-300/30 px-4 py-3 mb-6 text-sm text-warm-100">
              {t.saved}
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-300/30 px-4 py-3 mb-6 text-sm text-red-200">
              {error}
            </div>
          )}

          {oracles.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warm-700/30 flex items-center justify-center text-warm-400">
                <PeopleIcon />
              </div>
              <p className="font-serif text-2xl text-warm-100 mb-2">
                {t.emptyTitle}
              </p>
              <p className="text-sm text-warm-400 max-w-xs mx-auto leading-relaxed mb-6">
                {t.emptyBody}
              </p>
              <Link
                href="/onboarding"
                className="inline-flex h-11 px-6 rounded-full bg-warm-50 text-ink text-sm font-medium hover:bg-warm-100 transition-colors"
              >
                {t.emptyCta}
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {oracles.map((o) => {
                const name = (o.name as string)?.trim() || t.unnamed;
                const isActive = o.id === activeId;
                return (
                  <li key={o.id}>
                    <form
                      action={switchOracle}
                      className="flex items-center gap-3 rounded-2xl border border-warm-700/50 bg-warm-700/15 hover:bg-warm-700/30 hover:border-warm-300/40 transition-colors"
                    >
                      <input
                        type="hidden"
                        name="oracle_id"
                        value={o.id as string}
                      />
                      <button
                        type="submit"
                        className="flex items-center gap-3 flex-1 min-w-0 text-left px-4 py-3"
                      >
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-warm-700/40 flex-shrink-0">
                          {o.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={o.avatar_url as string}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base text-warm-50 truncate flex items-center gap-2">
                            {name}
                            {isActive && (
                              <span className="text-[10px] uppercase tracking-[0.18em] text-amber">
                                {t.activeBadge}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-warm-400 mt-0.5">
                            {modeLabel(o.mode as string, t)}
                          </p>
                        </div>
                        <svg
                          aria-hidden
                          viewBox="0 0 24 24"
                          className="w-4 h-4 text-warm-400 flex-shrink-0 mr-2"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="9 6 15 12 9 18" />
                        </svg>
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer link to trash if there's anything there. Cleaner
              than putting it inline above; doesn't distract from the
              primary "open someone" list. */}
          {(trashedCount ?? 0) > 0 && (
            <div className="mt-10 pt-6 border-t border-warm-700/40">
              <Link
                href="/trash"
                className="flex items-center gap-3 text-sm text-warm-300 hover:text-warm-50 transition-colors"
              >
                <span className="w-9 h-9 rounded-xl bg-warm-700/40 flex items-center justify-center">
                  <TrashIconSmall />
                </span>
                <span>
                  {t.trashLink.replace("{n}", String(trashedCount ?? 0))}
                </span>
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function modeLabel(
  mode: string | null,
  t: (typeof COPY)["en"],
): string {
  switch (mode) {
    case "real":
      return t.modeReal;
    case "memory":
      return t.modeMemory;
    case "randomize":
      return t.modeRandomize;
    case "import":
      return t.modeImport;
    default:
      return "";
  }
}

const COPY = {
  en: {
    back: "Back",
    title: "Contacts",
    manage: "Manage",
    intro:
      "The people in your archive. Tap to open the chat. Use Manage to rename or remove someone.",
    saved: "Done.",
    unnamed: "(no name)",
    activeBadge: "Open",
    modeReal: "From real answers",
    modeMemory: "From memory",
    modeRandomize: "Randomized",
    modeImport: "Imported",
    emptyTitle: "No one yet.",
    emptyBody: "Make your first identity to start a conversation.",
    emptyCta: "Make someone",
    trashLink: "Trash · {n}",
  },
  es: {
    back: "Atrás",
    title: "Contactos",
    manage: "Gestionar",
    intro:
      "Las personas en tu archivo. Toca para abrir el chat. Usa Gestionar para renombrar o eliminar.",
    saved: "Hecho.",
    unnamed: "(sin nombre)",
    activeBadge: "Abierto",
    modeReal: "Respuestas reales",
    modeMemory: "Desde memoria",
    modeRandomize: "Aleatorio",
    modeImport: "Importado",
    emptyTitle: "Aún no hay nadie.",
    emptyBody: "Crea tu primera identidad para empezar una conversación.",
    emptyCta: "Crear alguien",
    trashLink: "Papelera · {n}",
  },
};

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="9" r="3.2" />
      <circle cx="17" cy="9.5" r="2.5" />
      <path d="M3 19c0-2.8 2.7-5 6-5s6 2.2 6 5" />
      <path d="M14 17c.5-1.8 2.3-3 4.5-3s3.5 1 3.5 3" />
    </svg>
  );
}

function TrashIconSmall() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-warm-200" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
