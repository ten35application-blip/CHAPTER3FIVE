import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Settings — chapter3five",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, oracle_name")
    .eq("id", user.id)
    .single();

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            chapter3five
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <h1 className="font-serif text-4xl text-warm-50 mb-2">{t.title}</h1>
          <p className="text-warm-300 mb-12 leading-relaxed">{t.intro}</p>

          <div className="space-y-4">
            <Card
              href="/account"
              title={t.accountTitle}
              body={t.accountBody}
            />
            <Card
              href="/identities"
              title={t.identitiesTitle}
              body={t.identitiesBody}
            />
            <Card
              href="/sharing"
              title={t.sharingTitle}
              body={t.sharingBody}
            />
          </div>
        </div>
      </main>
    </>
  );
}

function Card({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-warm-300/30 bg-warm-700/15 px-6 py-5 hover:bg-warm-700/30 hover:border-warm-300/50 transition-colors group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-serif text-2xl text-warm-50 mb-2">{title}</h2>
          <p className="text-sm text-warm-200 leading-relaxed">{body}</p>
        </div>
        <span className="text-warm-300 group-hover:text-warm-50 transition-colors text-xl mt-1">
          →
        </span>
      </div>
    </Link>
  );
}

const COPY = {
  en: {
    title: "Settings.",
    intro: "Three sections. Pick the one you came for.",
    back: "Dashboard",
    accountTitle: "Your account",
    accountBody:
      "Email, language, billing, downloads, and deleting your account. The user-level stuff.",
    identitiesTitle: "Identities",
    identitiesBody:
      "The identity you're talking to. Photo, what they remember about you, removed identities, deleting this one, creating another.",
    sharingTitle: "Sharing & inheritance",
    sharingBody:
      "Texting style. Codes that copy your archive. Invite links so family can talk to the same identity. Beneficiaries who inherit it later.",
  },
  es: {
    title: "Ajustes.",
    intro: "Tres secciones. Elige por la que viniste.",
    back: "Dashboard",
    accountTitle: "Tu cuenta",
    accountBody:
      "Correo, idioma, pagos, descargas y eliminación de la cuenta. Lo del nivel del usuario.",
    identitiesTitle: "Identidades",
    identitiesBody:
      "La identidad con la que hablas. Foto, lo que recuerda de ti, identidades eliminadas, borrar esta, crear otra.",
    sharingTitle: "Compartir y heredar",
    sharingBody:
      "Estilo al escribir. Códigos para copiar tu archivo. Enlaces para que la familia hable con la misma identidad. Beneficiarios que la heredan después.",
  },
};
