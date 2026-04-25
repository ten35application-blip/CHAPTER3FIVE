import Link from "next/link";
import { redirect } from "next/navigation";
import { Orb } from "@/components/Orb";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "../actions";

export const metadata = {
  title: "Choose a new password — chapter3five",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin?error=Reset%20link%20expired,%20try%20again");
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-2xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-3xl sm:text-4xl text-warm-50 mb-3">
          Choose a new password.
        </h1>
        <p className="text-warm-300 mb-10 leading-relaxed">
          At least 8 characters. Make it one only you would write.
        </p>

        <form action={updatePassword} className="w-full space-y-3">
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="New password"
            aria-label="New password"
            autoComplete="new-password"
            className="w-full h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors"
          />
          <button
            type="submit"
            className="w-full h-12 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors"
          >
            Update password
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-300/80">{error}</p>}
      </div>
    </main>
  );
}
