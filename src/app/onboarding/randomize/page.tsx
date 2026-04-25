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
    .select("oracle_name, mode, preferred_language")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  if (profile.mode !== "randomize") redirect("/onboarding/questions");

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];
  const oracleName = profile.oracle_name ?? "your oracle";

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
        <p className="text-warm-300 text-sm leading-relaxed mb-12 max-w-sm">
          {t.note}
        </p>

        <form action={generateRandomizedArchive}>
          <button
            type="submit"
            className="h-12 px-10 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors"
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

const COPY = {
  en: {
    intro: (n: number) =>
      `We're about to generate a persona — answers to ${n} questions, written in one consistent voice. They'll become your archive. You'll be able to chat with them right after.`,
    note: "Take it as a gift, a bit of fiction, or just a stranger to talk to. Whatever fits.",
    cta: "Generate",
    back: "Back",
  },
  es: {
    intro: (n: number) =>
      `Vamos a generar una persona — respuestas a ${n} preguntas, escritas en una voz consistente. Serán tu archivo. Podrás conversar con ellas justo después.`,
    note: "Tómalo como un regalo, una pieza de ficción, o simplemente alguien con quien hablar. Lo que te quede.",
    cta: "Generar",
    back: "Atrás",
  },
};
