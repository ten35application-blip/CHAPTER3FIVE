import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";
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
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const oracleName = profile?.oracle_name ?? "your chapter";

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-12">
        <Orb size={300} />
      </div>
      <h1 className="font-serif text-4xl text-warm-50 mb-3">
        {oracleName}
      </h1>
      <p className="text-warm-300 mb-12 max-w-md">
        Dashboard coming soon. Chat surface in the next build.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="text-sm text-warm-400 hover:text-warm-200 transition-colors"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
