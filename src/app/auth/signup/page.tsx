import Link from "next/link";
import { Orb } from "@/components/Orb";
import { signUp } from "../actions";

export const metadata = {
  title: "Create account — chapter3five",
};

export default async function SignUpPage({
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
              We sent a confirmation link to{" "}
              <span className="text-warm-100">{sent}</span>. Click it from the
              same device, then sign in.
            </p>
            <p className="text-sm text-warm-400 leading-relaxed pt-4">
              Didn&rsquo;t see it? Check spam, or{" "}
              <Link
                href="/auth/signup"
                className="text-warm-200 underline underline-offset-2 hover:text-warm-100"
              >
                use a different email
              </Link>
              .
            </p>
            <p className="pt-6">
              <Link
                href="/auth/signin"
                className="text-sm text-warm-300 hover:text-warm-100 transition-colors"
              >
                Already confirmed? Sign in →
              </Link>
            </p>
          </div>
        ) : (
          <>
        <h1 className="font-serif text-3xl sm:text-4xl text-warm-50 mb-3">
          Begin a chapter.
        </h1>
        <p className="text-warm-300 mb-10 leading-relaxed">
          Create an account with an email and password.
        </p>

        <form action={signUp} className="w-full space-y-3">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            aria-label="Email"
            autoComplete="email"
            className="w-full h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors"
          />
          <input
            type="password"
            name="password"
            required
            minLength={8}
            placeholder="Password (8+ characters)"
            aria-label="Password"
            autoComplete="new-password"
            className="w-full h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors"
          />

          <label className="flex items-start gap-3 cursor-pointer text-warm-200 text-sm leading-relaxed pt-2 text-left">
            <input
              type="checkbox"
              name="age_confirmed"
              required
              className="mt-1 h-4 w-4 rounded border-warm-300/60 bg-warm-700/40 accent-warm-200"
            />
            <span>
              I am 18 or older. chapter3five is an adults-only product.
            </span>
          </label>

          <button
            type="submit"
            className="w-full h-12 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors"
          >
            Create account
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-300/80">{error}</p>}

        <p className="mt-10 text-sm text-warm-300">
          Already have an account?{" "}
          <Link
            href="/auth/signin"
            className="text-warm-100 underline underline-offset-2 hover:text-warm-50"
          >
            Sign in
          </Link>
          .
        </p>

        <p className="mt-4 text-xs text-warm-400 leading-relaxed">
          By creating an account, you agree to our{" "}
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
