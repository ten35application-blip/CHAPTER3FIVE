import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";
import { Chat } from "@/components/Chat";
import { signOut } from "@/app/auth/actions";

export const metadata = {
  title: "Dashboard — chapter3five",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, preferred_language, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const oracleName = profile.oracle_name ?? "your chapter";
  const language = (profile.preferred_language ?? "en") as "en" | "es";

  return (
    <main className="flex-1 flex flex-col px-6 py-6 relative overflow-hidden">
      <header className="max-w-2xl w-full mx-auto flex items-center justify-between mb-4">
        <Link
          href="/"
          className="font-serif text-lg tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
        >
          chapter3five
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-warm-400 hover:text-warm-200 transition-colors"
          >
            {language === "es" ? "Cerrar sesión" : "Sign out"}
          </button>
        </form>
      </header>

      <div className="absolute inset-x-0 top-32 flex justify-center pointer-events-none opacity-25 -z-10">
        <Orb size={520} />
      </div>

      <div className="max-w-2xl w-full mx-auto text-center mb-2">
        <h1 className="font-serif text-3xl text-warm-50 leading-tight">
          {oracleName}
        </h1>
      </div>

      <div className="flex-1 flex justify-center">
        <Chat oracleName={oracleName} language={language} />
      </div>
    </main>
  );
}
