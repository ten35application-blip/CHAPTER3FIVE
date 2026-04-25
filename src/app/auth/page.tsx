import Link from "next/link";
import { Orb } from "@/components/Orb";
import { signInWithMagicLink } from "./actions";

export const metadata = {
  title: "Sign in — chapter3five",
};

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;

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

        {sent ? (
          <div className="space-y-4">
            <h1 className="font-serif text-3xl text-warm-50">
              Check your email.
            </h1>
            <p className="text-warm-200 leading-relaxed">
              We sent a sign-in link to{" "}
              <span className="text-warm-100">{sent}</span>. Click it from
              the same device — and you&rsquo;re in.
            </p>
            <Link
              href="/auth"
              className="inline-block mt-6 text-sm text-warm-300 hover:text-warm-100 transition-colors"
            >
              Use a different email
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl text-warm-50 mb-3">
              Welcome.
            </h1>
            <p className="text-warm-300 mb-10 leading-relaxed">
              Sign in with your email. We&rsquo;ll send a one-time link.
            </p>

            <form action={signInWithMagicLink} className="w-full space-y-4">
              <input
                type="email"
                name="email"
                required
                placeholder="you@example.com"
                aria-label="Email"
                autoComplete="email"
                className="w-full h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors"
              />
              <button
                type="submit"
                className="w-full h-12 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors"
              >
                Send sign-in link
              </button>
            </form>

            {error && (
              <p className="mt-4 text-sm text-red-300/80">{error}</p>
            )}

            <p className="mt-10 text-xs text-warm-400 leading-relaxed">
              By continuing, you agree to our{" "}
              <Link
                href="/terms"
                className="text-warm-200 underline underline-offset-2 hover:text-warm-100"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-warm-200 underline underline-offset-2 hover:text-warm-100"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </>
        )}
      </div>
    </main>
  );
}
