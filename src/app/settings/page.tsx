import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateLanguage,
  updateTextingStyle,
  deleteAccount,
} from "./actions";

export const metadata = {
  title: "Settings — chapter3five",
};

export default async function SettingsPage({
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
    .select("oracle_name, mode, preferred_language, texting_style, created_at")
    .eq("id", user.id)
    .single();

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            chapter3five
          </Link>
          <Link
            href="/dashboard"
            className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
          >
            ← {t.back}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <h1 className="font-serif text-4xl text-warm-50 mb-2">{t.title}</h1>
          <p className="text-warm-300 mb-12">{t.intro}</p>

          {saved && (
            <div className="rounded-lg bg-warm-700/30 border border-warm-300/30 px-4 py-3 mb-8 text-sm text-warm-100">
              {t.saved}
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-300/30 px-4 py-3 mb-8 text-sm text-red-200">
              {error}
            </div>
          )}

          <Section title={t.accountTitle}>
            <Row label={t.email} value={user.email ?? "—"} />
            <Row
              label={t.oracle}
              value={profile?.oracle_name ?? "—"}
            />
            <Row
              label={t.mode}
              value={
                profile?.mode === "randomize"
                  ? t.modeRandomize
                  : t.modeReal
              }
            />
            <Row
              label={t.created}
              value={
                profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString()
                  : "—"
              }
            />
          </Section>

          <Section title={t.languageTitle}>
            <form action={updateLanguage} className="flex items-center gap-3">
              <select
                name="language"
                defaultValue={language}
                className="h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 focus:outline-none focus:border-warm-200"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
              >
                {t.save}
              </button>
            </form>
          </Section>

          <Section title={t.styleTitle}>
            <p className="text-sm text-warm-300 mb-3">{t.styleHint}</p>
            <form action={updateTextingStyle} className="space-y-3">
              <textarea
                name="texting_style"
                rows={3}
                defaultValue={profile?.texting_style ?? ""}
                placeholder={t.stylePlaceholder}
                className="w-full rounded-2xl bg-warm-700/30 border border-warm-400/30 px-4 py-3 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors leading-relaxed"
              />
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
              >
                {t.save}
              </button>
            </form>
          </Section>

          <Section title={t.legalTitle}>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/terms"
                  className="text-warm-200 underline underline-offset-2 hover:text-warm-50"
                >
                  {t.terms}
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-warm-200 underline underline-offset-2 hover:text-warm-50"
                >
                  {t.privacy}
                </Link>
              </li>
              <li>
                <Link
                  href="/cookies"
                  className="text-warm-200 underline underline-offset-2 hover:text-warm-50"
                >
                  {t.cookies}
                </Link>
              </li>
            </ul>
          </Section>

          <Section title={t.dangerTitle} danger>
            <p className="text-sm text-warm-300 mb-4">{t.dangerHint}</p>
            <form action={deleteAccount}>
              <button
                type="submit"
                className="h-11 px-5 rounded-full border border-red-300/40 bg-red-900/20 text-red-200 hover:bg-red-900/30 transition-colors text-sm"
              >
                {t.delete}
              </button>
            </form>
          </Section>
        </div>
      </main>
    </>
  );
}

function Section({
  title,
  children,
  danger,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <section
      className={`mb-10 pb-10 ${danger ? "border-t border-red-300/20 pt-10" : "border-b border-warm-700/40"}`}
    >
      <h2 className="font-serif text-2xl text-warm-50 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-warm-700/30 last:border-b-0">
      <span className="text-sm text-warm-300">{label}</span>
      <span className="text-warm-100">{value}</span>
    </div>
  );
}

const COPY = {
  en: {
    title: "Settings",
    intro: "Manage your account, language, and how chapter3five sounds.",
    back: "Back",
    saved: "Saved.",
    accountTitle: "Account",
    email: "Email",
    oracle: "Oracle name",
    mode: "Mode",
    modeReal: "Real",
    modeRandomize: "Randomize",
    created: "Created",
    languageTitle: "Language",
    styleTitle: "Texting style (optional)",
    styleHint:
      "Describe how you actually text — punctuation, emojis, length, tone. The oracle will match it.",
    stylePlaceholder:
      "Lowercase, no periods, lol when funny, never emojis, short replies",
    save: "Save",
    legalTitle: "Legal",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    cookies: "Cookie Policy",
    dangerTitle: "Delete account",
    dangerHint:
      "This permanently removes your archive, your answers, and your account. There is no undo.",
    delete: "Delete my account",
  },
  es: {
    title: "Ajustes",
    intro: "Administra tu cuenta, idioma, y cómo suena chapter3five.",
    back: "Atrás",
    saved: "Guardado.",
    accountTitle: "Cuenta",
    email: "Correo",
    oracle: "Nombre del oráculo",
    mode: "Modo",
    modeReal: "Real",
    modeRandomize: "Aleatorio",
    created: "Creada",
    languageTitle: "Idioma",
    styleTitle: "Estilo al escribir (opcional)",
    styleHint:
      "Describe cómo escribes realmente — puntuación, emojis, largo, tono. El oráculo lo igualará.",
    stylePlaceholder:
      "minúsculas, sin puntos, jaja cuando sea chistoso, sin emojis, respuestas cortas",
    save: "Guardar",
    legalTitle: "Legal",
    terms: "Términos del Servicio",
    privacy: "Política de Privacidad",
    cookies: "Política de Cookies",
    dangerTitle: "Eliminar cuenta",
    dangerHint:
      "Esto elimina permanentemente tu archivo, tus respuestas y tu cuenta. No hay vuelta atrás.",
    delete: "Eliminar mi cuenta",
  },
};
