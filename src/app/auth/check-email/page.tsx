import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Check your email · chapter3five",
};

/**
 * Post-signup landing page. The signup action redirects here after
 * supabase.auth.signUp succeeds so the user knows exactly what to do
 * next -- confirm the email link, then sign in. Prior behavior dumped
 * the user at /onboarding, which bounced to /auth/signin because the
 * session was pending email confirmation; that reads as "the account
 * didn't work" rather than "check your inbox."
 *
 * The optional ?email= query param renders the address in the copy so
 * a user who typed their email wrong on the form can catch the miss
 * before waiting for a link that never arrives.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const shown =
    typeof email === "string" && email.trim().length > 0
      ? email.trim().toLowerCase()
      : null;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <Link
          href="/"
          aria-label="chapter3five home"
          className="hero-orb flex items-center justify-center"
        >
          <Image
            src="/logo-transparent.png"
            alt="chapter3five"
            width={80}
            height={80}
            priority
            className="h-20 w-20 drop-shadow-[0_16px_40px_rgba(232,138,118,0.3)]"
          />
        </Link>

        <h1 className="mt-8 text-4xl font-bold tracking-[-0.02em] text-warm-50">
          Check your <span className="text-gradient-cta">email.</span>
        </h1>

        <p className="mt-4 text-base leading-relaxed text-warm-300">
          {shown ? (
            <>
              We sent a confirmation link to{" "}
              <strong className="text-warm-100">{shown}</strong>. Tap the
              link to confirm your account, then come back and sign in.
            </>
          ) : (
            <>
              We sent a confirmation link to the email you signed up with.
              Tap the link to confirm your account, then come back and
              sign in.
            </>
          )}
        </p>

        <p className="mt-6 text-sm leading-relaxed text-warm-400">
          Nothing in your inbox after a minute or two? Check spam, or the
          promotions tab. Still nothing &mdash; write to{" "}
          <a
            href="mailto:hello@chapter3five.app"
            className="font-semibold text-coral-strong hover:underline"
          >
            hello@chapter3five.app
          </a>{" "}
          and a real human will help.
        </p>

        <Link
          href="/auth/signin"
          className="mt-10 flex h-12 items-center justify-center rounded-full bg-warm-700 px-8 text-base font-semibold text-warm-100 transition-colors hover:bg-warm-600"
        >
          Go to sign in
        </Link>

        <Link
          href="/"
          className="mt-4 text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
