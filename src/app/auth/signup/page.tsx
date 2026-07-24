import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Make an account · chapter3five",
};

async function signUp(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const eighteen = formData.get("eighteen");

  if (!email || !password) {
    redirectWithError("/auth/signup", "Enter your email and password.");
  }
  if (password.length < 8) {
    redirectWithError("/auth/signup", "Password needs at least 8 characters.");
  }
  if (!eighteen) {
    redirectWithError("/auth/signup", "You have to be 18 or older.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("registered") || msg.includes("already")) {
      redirectWithError(
        "/auth/signup",
        "That email is already in use. Try signing in.",
        error,
      );
    }
    if (msg.includes("valid") && msg.includes("email")) {
      redirectWithError(
        "/auth/signup",
        "That email doesn't look right.",
        error,
      );
    }
    redirectWithError(
      "/auth/signup",
      "Something went wrong. Try again in a moment.",
      error,
    );
  }

  // Straight to the acceptance gate — the (gated) layout would bounce
  // them there from /dashboard anyway, but going direct skips a hop.
  redirect("/onboarding");
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* Small hero moment — logo inside a compact aura echoing the
            landing, so the auth page feels like it belongs to the same
            product rather than a stock signup form. */}
        <Link
          href="/"
          aria-label="chapter3five home"
          className="hero-orb flex items-center justify-center"
        >
          <Image
            src="/logo.png"
            alt="chapter3five"
            width={80}
            height={80}
            priority
            className="h-20 w-20 drop-shadow-[0_16px_40px_rgba(232,138,118,0.3)]"
          />
        </Link>

        <h1 className="mt-8 text-4xl font-bold tracking-[-0.02em] text-warm-50">
          Make an <span className="text-gradient-cta">account.</span>
        </h1>
        <p className="mt-3 text-base text-warm-300">
          It only takes a minute.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-6 w-full rounded-2xl bg-warm-700 px-4 py-3 text-center text-sm text-warm-100"
          >
            {error}
          </p>
        ) : null}

        <form action={signUp} className="mt-8 flex w-full flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-warm-200">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-coral"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-warm-200">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-coral"
              placeholder="At least 8 characters"
            />
          </label>

          <label className="mt-2 flex cursor-pointer items-start gap-3 text-sm text-warm-200">
            <input
              type="checkbox"
              name="eighteen"
              required
              className="mt-0.5 h-5 w-5 accent-coral"
            />
            <span>I&apos;m 18 or older.</span>
          </label>

          <button
            type="submit"
            className="bg-gradient-cta hover:bg-gradient-cta-hover mt-4 flex h-14 w-full items-center justify-center rounded-full text-lg font-bold tracking-tight text-white shadow-[0_16px_40px_-10px_rgba(232,138,118,0.5),_0_6px_16px_-6px_rgba(126,196,196,0.4)] transition-all hover:-translate-y-px hover:shadow-[0_20px_46px_-10px_rgba(232,138,118,0.55),_0_8px_20px_-6px_rgba(126,196,196,0.45)] active:translate-y-0 active:opacity-95"
          >
            Create account
          </button>

          {/* Standard cover — the real, recorded acceptance happens at
              /onboarding after signup. */}
          <p className="mt-3 text-center text-xs leading-relaxed text-warm-400">
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="font-semibold text-warm-300 underline-offset-2 transition-colors hover:text-coral-strong hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-semibold text-warm-300 underline-offset-2 transition-colors hover:text-coral-strong hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <p className="mt-6 text-sm text-warm-300">
          Already have an account?{" "}
          <Link
            href="/auth/signin"
            className="font-semibold text-coral-strong transition-colors hover:text-coral"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
