import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";

export const metadata = {
  title: "Meet your identity — chapter3five",
};

const COPY = {
  en: {
    kicker: "Meet your identity",
    bioFallback:
      "We didn't get a clean bio synthesis this time, but the persona is ready. Voice and texture come from the 355 random answers.",
    keepGoing: "Keep going",
    backToRandomize: "← Back",
  },
  es: {
    kicker: "Conoce tu identidad",
    bioFallback:
      "No logramos sintetizar una biografía limpia esta vez, pero la identidad está lista. La voz y la textura vienen de las 355 respuestas aleatorias.",
    keepGoing: "Continuar",
    backToRandomize: "← Atrás",
  },
};

export default async function MeetIdentityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "active_oracle_id, oracle_name, preferred_language, personality_type, emotional_flavor",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.active_oracle_id) redirect("/onboarding");

  const { data: oracle } = await supabase
    .from("oracles")
    .select("name, bio, avatar_url")
    .eq("id", profile.active_oracle_id)
    .maybeSingle();

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];
  const oracleName = oracle?.name ?? profile.oracle_name ?? "";
  const bio = oracle?.bio ?? null;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-lg flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <p className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-6">
          {t.kicker}
        </p>

        <h1 className="font-serif text-5xl sm:text-6xl text-warm-50 leading-tight mb-10">
          <span className="italic font-light">{oracleName}.</span>
        </h1>

        <p className="font-serif text-lg sm:text-xl text-warm-100 leading-relaxed max-w-md mb-12 italic">
          {bio ? `"${bio}"` : t.bioFallback}
        </p>

        <div className="flex gap-3 items-center">
          <Link
            href="/agreements"
            className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
          >
            {t.keepGoing}
          </Link>
        </div>
      </div>
    </main>
  );
}
