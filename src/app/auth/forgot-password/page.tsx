import Link from "next/link";
import { Orb } from "@/components/Orb";
import { requestPasswordReset } from "../actions";

export const metadata = {
  title: "Reset password — chapter3five",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;

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
              We sent a password reset link to{" "}
              <span className="text-warm-100">{sent}</span>. The link works
              once and expires in an hour.
            </p>
            <p className="pt-6">
              <Link
                href="/auth/signin"
                className="text-sm text-warm-300 hover:text-warm-100 transition-colors"
              >
                ← Back to sign in
              </Link>
            </p>
          </div>
        ) : (
          <>
            <h1 className="font-serif text-3xl sm:text-4xl text-warm-50 mb-3">
              Reset your password.
            </h1>
            <p className="text-warm-300 mb-10 leading-relaxed">
              Enter your email and we&rsquo;ll send a link to choose a new one.
            </p>

            <form action={requestPasswordReset} className="w-full space-y-3">
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
                Send reset link
              </button>
            </form>

            {error && <p className="mt-4 text-sm text-red-300/80">{error}</p>}

            <p className="mt-10 text-sm text-warm-300">
              <Link
                href="/auth/signin"
                className="text-warm-100 underline underline-offset-2 hover:text-warm-50"
              >
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
