import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";

export const metadata = {
  title: "Payment cancelled — chapter3five",
};

export default async function RandomizeCancelPage() {
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

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-4xl text-warm-50 mb-4">
          <span className="italic font-light">No charge.</span>
        </h1>
        <p className="text-warm-200 leading-relaxed mb-10 max-w-sm">
          {t.note}
        </p>

        <Link
          href="/dashboard"
          className="inline-flex h-12 items-center justify-center rounded-full border border-warm-300/40 px-10 text-sm font-medium text-warm-100 hover:bg-warm-700/40 transition-colors"
        >
          {t.cta}
        </Link>
      </div>
    </main>
  );
}

const COPY = {
  en: {
    note: "Payment was cancelled. Your card wasn't charged. You can try again whenever.",
    cta: "Back to dashboard",
  },
  es: {
    note: "El pago se canceló. No se cobró nada. Puedes volver a intentarlo cuando quieras.",
    cta: "Volver al dashboard",
  },
};
