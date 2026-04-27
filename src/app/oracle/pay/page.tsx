import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";
import { startOracleCheckout } from "./actions";

export const metadata = {
  title: "New identity — chapter3five",
};

export default async function OraclePayPage({
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
    .select("preferred_language, extra_oracle_credits")
    .eq("id", user.id)
    .single();

  if ((profile?.extra_oracle_credits ?? 0) > 0) {
    redirect("/onboarding");
  }

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
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
          <span className="italic font-light">Another identity.</span>
        </h1>
        <p className="text-warm-200 text-lg leading-relaxed mb-2">
          {t.intro}
        </p>
        <p className="text-warm-300 text-sm leading-relaxed mb-10 max-w-sm">
          {t.note}
        </p>

        <form action={startOracleCheckout}>
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
            href="/dashboard"
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
    intro: "Your first identity was on us. Each new one is $5.",
    note: "Set it up however you like — for someone real, for someone you imagine, or randomize a stranger.",
    cta: "Pay $5 and create",
    back: "Back",
  },
  es: {
    intro: "Tu primer identity fue de regalo. Cada uno nuevo cuesta $5.",
    note: "Hazlo como quieras — para alguien real, para alguien que imaginas, o aleatorízalo.",
    cta: "Pagar $5 y crear",
    back: "Atrás",
  },
};
