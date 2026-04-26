import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";
import { questions } from "@/content/questions";
import { generateRandomizedArchive } from "./actions";

export const metadata = {
  title: "Randomize — chapter3five",
};

export default async function RandomizePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, mode, preferred_language, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  if (profile.onboarding_completed) redirect("/dashboard");
  if (profile.mode !== "randomize") redirect("/onboarding/questions");

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];
  const oracleName = profile.oracle_name ?? "your thirtyfive";

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
        <Orb size={560} />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 mb-4 leading-tight">
          <span className="italic font-light">Meet</span> {oracleName}.
        </h1>
        <p className="text-warm-200 text-lg leading-relaxed mb-2">
          {t.intro(questions.length)}
        </p>
        <p className="text-warm-300 text-sm leading-relaxed mb-10 max-w-sm">
          {t.note}
        </p>

        <form action={generateRandomizedArchive} className="w-full space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-warm-200 text-sm mb-2">
              {t.genderLabel}
            </legend>
            <div className="grid grid-cols-3 gap-2">
              <GenderRadio value="female" label={t.female} defaultChecked />
              <GenderRadio value="male" label={t.male} />
              <GenderRadio value="any" label={t.any} />
            </div>
          </fieldset>

          <button
            type="submit"
            className="h-12 px-10 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors w-full"
          >
            {t.cta}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-300/80">{error}</p>}

        <p className="mt-10 text-xs text-warm-400">
          <Link
            href="/onboarding"
            className="hover:text-warm-200 transition-colors"
          >
            ← {t.back}
          </Link>
        </p>
      </div>
    </main>
  );
}

function GenderRadio({
  value,
  label,
  defaultChecked,
}: {
  value: "female" | "male" | "any";
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer rounded-full border border-warm-400/30 bg-warm-700/20 h-11 inline-flex items-center justify-center text-warm-100 hover:bg-warm-700/40 transition-colors has-[:checked]:border-warm-200 has-[:checked]:bg-warm-700/50 has-[:checked]:text-warm-50 text-sm px-3">
      <input
        type="radio"
        name="gender"
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
        required
      />
      {label}
    </label>
  );
}

const COPY = {
  en: {
    intro: (n: number) =>
      `We're about to mix you a character — drawing one answer at random for each of ${n} questions. The combination is yours alone. No two are the same.`,
    note: "A stranger to talk to, a gift, a piece of fiction. Whatever fits.",
    genderLabel: "Pick a gender for your character",
    female: "Female",
    male: "Male",
    any: "Surprise me",
    cta: "Generate",
    back: "Back",
  },
  es: {
    intro: (n: number) =>
      `Vamos a mezclarte un personaje — eligiendo una respuesta al azar para cada una de las ${n} preguntas. La combinación es tuya. Ninguna otra es igual.`,
    note: "Un desconocido con quien hablar, un regalo, una pieza de ficción. Lo que te quede.",
    genderLabel: "Elige el género de tu personaje",
    female: "Mujer",
    male: "Hombre",
    any: "Sorpréndeme",
    cta: "Generar",
    back: "Atrás",
  },
};
