import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptAgreements } from "./actions";

export const metadata = {
  title: "Agreements — chapter3five",
};

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl">
        <Link
          href="/"
          className="block text-center font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl text-warm-50 mb-3">
            {t.title}
          </h1>
          <p className="text-warm-200 leading-relaxed">{t.intro}</p>
        </div>

        <form
          action={acceptAgreements}
          className="space-y-4 rounded-2xl border border-warm-400/30 bg-warm-700/20 p-6"
        >
          <Checkbox
            name="terms"
            label={t.terms}
            link={{ href: "/terms", text: t.read }}
          />
          <Checkbox
            name="privacy"
            label={t.privacy}
            link={{ href: "/privacy", text: t.read }}
          />
          <Checkbox
            name="cookies"
            label={t.cookies}
            link={{ href: "/cookies", text: t.read }}
          />

          {error && (
            <p className="text-sm text-red-300/80 text-center pt-2">{error}</p>
          )}

          <div className="pt-4">
            <button
              type="submit"
              className="w-full h-12 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors"
            >
              {t.cta}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Checkbox({
  name,
  label,
  link,
}: {
  name: string;
  label: string;
  link: { href: string; text: string };
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer text-warm-100">
      <input
        type="checkbox"
        name={name}
        className="mt-1 h-4 w-4 rounded border-warm-300/60 bg-warm-700/40 accent-warm-200"
      />
      <span className="text-sm leading-relaxed">
        {label}{" "}
        <Link
          href={link.href}
          className="text-warm-200 underline underline-offset-2 hover:text-warm-50"
          target="_blank"
        >
          {link.text}
        </Link>
        .
      </span>
    </label>
  );
}

const COPY = {
  en: {
    title: "One more thing.",
    intro:
      "Before you enter, please confirm you've read and agreed to how chapter3five handles your data.",
    terms: "I agree to the Terms of Service.",
    privacy: "I agree to the Privacy Policy.",
    cookies: "I understand the Cookie Policy.",
    read: "Read",
    cta: "Continue",
  },
  es: {
    title: "Una cosa más.",
    intro:
      "Antes de entrar, confirma que leíste y aceptas cómo chapter3five maneja tu información.",
    terms: "Acepto los Términos del Servicio.",
    privacy: "Acepto la Política de Privacidad.",
    cookies: "Entiendo la Política de Cookies.",
    read: "Leer",
    cta: "Continuar",
  },
};
