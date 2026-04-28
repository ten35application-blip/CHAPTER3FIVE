import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createShareCode,
  revokeShareCode,
} from "@/app/settings/actions";

export const metadata = {
  title: "Import codes — chapter3five",
};

export default async function ImportCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; code?: string }>;
}) {
  const { saved, error, code: justCreatedCode } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .single();

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  const { data: shareRows } = await supabase
    .from("shares")
    .select("code, label, revoked_at, created_at")
    .eq("source_user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Link
            href="/sharing"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            ← {t.back}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
          <h1 className="font-serif text-4xl text-warm-50 mb-2">{t.title}</h1>
          <p className="text-warm-200 mb-8 leading-relaxed">{t.intro}</p>

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

          <p className="text-sm text-warm-300 mb-4 leading-relaxed">
            {t.body}
          </p>

          {justCreatedCode && (
            <div className="rounded-lg border border-warm-300/40 bg-warm-700/40 px-4 py-3 mb-4 text-sm">
              <p className="text-warm-200 mb-2">{t.justCreated}</p>
              <code className="font-mono text-warm-50 text-base tracking-wide">
                {justCreatedCode}
              </code>
            </div>
          )}

          <form action={createShareCode} className="flex gap-2 mb-6">
            <input
              type="text"
              name="label"
              maxLength={80}
              placeholder={t.labelPlaceholder}
              className="flex-1 h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
            />
            <button
              type="submit"
              className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm whitespace-nowrap"
            >
              {t.cta}
            </button>
          </form>

          {shareRows && shareRows.length > 0 ? (
            <div className="space-y-2">
              {shareRows.map((s) => (
                <div
                  key={s.code}
                  className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                >
                  <div className="flex flex-col min-w-0">
                    <code className="font-mono text-sm text-warm-100 truncate">
                      {s.code}
                    </code>
                    <span className="text-xs text-warm-400 truncate">
                      {s.label ?? t.unlabeled} ·{" "}
                      {s.revoked_at ? t.revoked : t.active}
                    </span>
                  </div>
                  {!s.revoked_at && (
                    <form action={revokeShareCode}>
                      <input type="hidden" name="code" value={s.code} />
                      <button
                        type="submit"
                        className="text-xs text-warm-400 hover:text-warm-200 transition-colors whitespace-nowrap"
                      >
                        {t.revoke}
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-warm-400 italic">{t.empty}</p>
          )}
        </div>
      </main>
    </>
  );
}

const COPY = {
  en: {
    back: "Sharing",
    title: "Import codes.",
    intro:
      "An advanced way to share your archive: a code someone uses to start a fresh chapter3five account with a copy of your archive — their own version, separate from yours, that they can edit and pass on.",
    body: "Most people just want family to read your archive (current path on the Sharing page) or inherit it. Import codes are for the rare case where each family member should carry their own private copy forward independently. Codes can be revoked at any time.",
    saved: "Saved.",
    cta: "Generate code",
    labelPlaceholder: 'Label (e.g. "for my daughter")',
    justCreated: "Code generated:",
    unlabeled: "(unlabeled)",
    active: "active",
    revoked: "revoked",
    revoke: "Revoke",
    empty: "No import codes yet.",
  },
  es: {
    back: "Compartir",
    title: "Códigos de importación.",
    intro:
      "Una forma avanzada de compartir tu archivo: un código que alguien usa para abrir una cuenta nueva de chapter3five con una copia de tu archivo — su propia versión, separada de la tuya, que pueden editar y pasar adelante.",
    body: "La mayoría solo quiere que la familia lea tu archivo (el camino normal en la página de Compartir) o lo herede. Los códigos de importación son para el caso raro en el que cada familiar debe llevar su propia copia privada adelante de forma independiente. Los códigos se pueden revocar cuando quieras.",
    saved: "Guardado.",
    cta: "Generar código",
    labelPlaceholder: 'Etiqueta (p. ej. "para mi hija")',
    justCreated: "Código generado:",
    unlabeled: "(sin etiqueta)",
    active: "activo",
    revoked: "revocado",
    revoke: "Revocar",
    empty: "Aún no hay códigos de importación.",
  },
};
