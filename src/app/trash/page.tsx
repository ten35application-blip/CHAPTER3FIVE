import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { restoreOracle } from "../settings/actions";

export const metadata = {
  title: "Trash — chapter3five",
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export default async function TrashPage({
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
    .select("preferred_language")
    .eq("id", user.id)
    .maybeSingle();
  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  const { data: rows } = await supabase
    .from("oracles")
    .select("id, name, avatar_url, deleted_at, scheduled_purge_at")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  const trashed = (rows ?? []).filter((o) => {
    if (!o.scheduled_purge_at) return true;
    // eslint-disable-next-line react-hooks/purity
    return new Date(o.scheduled_purge_at).getTime() > Date.now();
  });

  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-2xl mx-auto pl-6 pr-16 md:pr-6 py-6 flex items-center gap-3">
          <Link
            href="/account"
            aria-label={t.back}
            className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full text-warm-200 hover:text-warm-50 hover:bg-warm-700/30 transition-colors"
          >
            <BackIcon />
          </Link>
          <h1 className="font-serif text-xl tracking-tight text-warm-50">
            {t.title}
          </h1>
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

          {trashed.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warm-700/30 flex items-center justify-center text-warm-400">
                <TrashIcon />
              </div>
              <p className="font-serif text-2xl text-warm-100 mb-2">
                {t.emptyTitle}
              </p>
              <p className="text-sm text-warm-400 max-w-xs mx-auto leading-relaxed">
                {t.emptyBody}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {trashed.map((o) => {
                const purgeAt = o.scheduled_purge_at
                  ? new Date(o.scheduled_purge_at).getTime()
                  : null;
                const daysLeft = purgeAt
                  ? // eslint-disable-next-line react-hooks/purity
                    Math.max(0, Math.ceil((purgeAt - Date.now()) / ONE_DAY_MS))
                  : null;
                const name = (o.name as string)?.trim() || t.unnamed;
                return (
                  <li
                    key={o.id}
                    className="rounded-2xl border border-warm-700/50 bg-warm-700/15 p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-warm-700/40 flex-shrink-0">
                      {o.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={o.avatar_url as string}
                          alt=""
                          className="w-full h-full object-cover opacity-60"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base text-warm-50 truncate">{name}</p>
                      <p className="text-xs text-warm-400 mt-0.5">
                        {daysLeft === null
                          ? t.gracePending
                          : daysLeft === 0
                            ? t.daysLeftZero
                            : daysLeft === 1
                              ? t.daysLeftOne
                              : t.daysLeftMany.replace("{n}", String(daysLeft))}
                      </p>
                    </div>
                    <form action={restoreOracle}>
                      <input
                        type="hidden"
                        name="oracle_id"
                        value={o.id as string}
                      />
                      <button
                        type="submit"
                        className="h-10 px-4 rounded-full bg-warm-50 text-ink text-sm font-medium hover:bg-warm-100 transition-colors"
                      >
                        {t.restoreCta}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

const COPY = {
  en: {
    back: "Back",
    title: "Trash",
    intro:
      "People you removed are held here for 30 days. Bring one back for $5 — they return exactly as they were. After 30 days, they're gone for good.",
    emptyTitle: "Nothing here.",
    emptyBody: "People you remove appear here for 30 days. Then they're gone.",
    saved: "Done.",
    unnamed: "(no name)",
    daysLeftZero: "Last day — disappears soon.",
    daysLeftOne: "1 day left.",
    daysLeftMany: "{n} days left.",
    gracePending: "Held safely.",
    restoreCta: "Restore",
  },
  es: {
    back: "Atrás",
    title: "Papelera",
    intro:
      "Las personas que eliminas se guardan aquí 30 días. Recupera una por $5 — vuelve exactamente como estaba. Después de 30 días, desaparece para siempre.",
    emptyTitle: "Nada aquí.",
    emptyBody:
      "Las personas que elimines aparecen aquí 30 días. Luego desaparecen.",
    saved: "Hecho.",
    unnamed: "(sin nombre)",
    daysLeftZero: "Último día — pronto desaparece.",
    daysLeftOne: "1 día restante.",
    daysLeftMany: "{n} días restantes.",
    gracePending: "Guardado a salvo.",
    restoreCta: "Recuperar",
  },
};

function BackIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 6 9 12 15 18" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-7 h-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}
