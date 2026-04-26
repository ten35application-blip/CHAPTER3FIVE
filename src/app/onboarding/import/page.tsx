import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";
import { importFromCode } from "./actions";

export const metadata = {
  title: "Import — chapter3five",
};

export default async function ImportPage({
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
    .select("mode, preferred_language, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  if (profile.onboarding_completed) redirect("/dashboard");
  if (profile.mode !== "import") redirect("/onboarding");

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 mb-4 leading-tight">
          <span className="italic font-light">A code,</span> please.
        </h1>
        <p className="text-warm-200 text-lg leading-relaxed mb-2">
          {t.intro}
        </p>
        <p className="text-warm-300 text-sm leading-relaxed mb-10 max-w-sm">
          {t.note}
        </p>

        <form action={importFromCode} className="w-full space-y-4">
          <input
            type="text"
            name="code"
            required
            placeholder="ABCD-EFGH-JKLM"
            autoComplete="off"
            spellCheck={false}
            className="w-full h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors font-mono tracking-wide text-center uppercase"
          />
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

const COPY = {
  en: {
    intro:
      "Enter the share code someone gave you. We'll bring their archive — every answer, their texting style, their character — into your account.",
    note: "You're not joining their archive. You're getting your own copy. Edit it later if you'd like.",
    cta: "Import",
    back: "Back",
  },
  es: {
    intro:
      "Escribe el código que te compartieron. Traeremos su archivo — cada respuesta, su forma de escribir, su carácter — a tu cuenta.",
    note: "No te estás uniendo a su archivo. Estás recibiendo tu propia copia. Después la puedes editar si quieres.",
    cta: "Importar",
    back: "Atrás",
  },
};
