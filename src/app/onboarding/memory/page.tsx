import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";
import { MemorySeedForm } from "./MemorySeedForm";

export const metadata = {
  title: "Tell me about them — chapter3five",
};

export default async function MemoryOnboardingPage({
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
    .select("oracle_name, mode, preferred_language, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) redirect("/dashboard");
  if (profile?.mode !== "memory") redirect("/onboarding");

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const oracleName = profile.oracle_name ?? "";

  const t = COPY[language];

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-2xl flex flex-col">
        <Link
          href="/onboarding"
          className="text-sm text-warm-300 hover:text-warm-100 transition-colors mb-12"
        >
          ← {t.back}
        </Link>

        <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 leading-tight mb-3">
          <span className="italic font-light">{t.title(oracleName)}</span>
        </h1>
        <p className="text-warm-200 leading-relaxed mb-2 max-w-xl">
          {t.intro}
        </p>
        <p className="text-warm-300 text-sm leading-relaxed mb-8 max-w-xl">
          {t.honest}
        </p>

        <MemorySeedForm language={language} oracleName={oracleName} />

        {error && (
          <p className="mt-4 text-sm text-red-300/80">{error}</p>
        )}
      </div>
    </main>
  );
}

const COPY = {
  en: {
    back: "Back",
    title: (n: string) =>
      n.trim() ? `Tell me about ${n}.` : "Tell me about them.",
    intro:
      "Type as much as you can — how they talked, what they cared about, the way they made you feel. The little stuff helps: their go-to phrases, what they always ordered, who they checked on. Don't worry about structure. Just write.",
    honest:
      "This is a starter. It won't be exactly them, especially at the beginning — we'll fill gaps with plausible details and tell you which is which. The more you share, the more it sounds like them. You can keep adding any time.",
  },
  es: {
    back: "Atrás",
    title: (n: string) =>
      n.trim() ? `Cuéntame de ${n}.` : "Cuéntame de esa persona.",
    intro:
      "Escribe lo que puedas — cómo hablaban, qué les importaba, cómo te hacían sentir. Lo pequeño ayuda: sus frases típicas, lo que siempre pedían, a quién cuidaban. No te preocupes por la estructura. Solo escribe.",
    honest:
      "Esto es un punto de partida. No será exactamente esa persona, sobre todo al inicio — llenaremos huecos con detalles plausibles y te diremos cuáles son. Mientras más compartas, más se parecerá. Puedes seguir agregando cuando quieras.",
  },
};
