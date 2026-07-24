import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign in · chapter3five",
};

async function signIn(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirectWithError("/auth/signin", "Enter your email and password.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid") || msg.includes("credential")) {
      redirectWithError(
        "/auth/signin",
        "That email and password don't match.",
        error,
      );
    }
    if (msg.includes("confirm")) {
      redirectWithError(
        "/auth/signin",
        "Check your email to confirm your account first.",
        error,
      );
    }
    redirectWithError(
      "/auth/signin",
      "Something went wrong. Try again in a moment.",
      error,
    );
  }

  redirect("/dashboard");
}

export default async function SigninPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* Compact hero moment matching signup, so auth screens feel of
            a piece with the landing rather than a stock form. */}
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
          Welcome <span className="text-gradient-cta">back.</span>
        </h1>
        <p className="mt-3 text-base text-warm-300">
          Pick up where you left off.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-6 w-full rounded-2xl bg-warm-700 px-4 py-3 text-center text-sm text-warm-100"
          >
            {error}
          </p>
        ) : null}

        <form action={signIn} className="mt-8 flex w-full flex-col gap-3">
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
              autoComplete="current-password"
              required
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-coral"
              placeholder="Your password"
            />
          </label>

          <div className="mt-1 flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-warm-300 transition-colors hover:text-coral-strong"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="bg-gradient-cta hover:bg-gradient-cta-hover mt-4 flex h-14 w-full items-center justify-center rounded-full text-lg font-bold tracking-tight text-white shadow-[0_16px_40px_-10px_rgba(232,138,118,0.5),_0_6px_16px_-6px_rgba(126,196,196,0.4)] transition-all hover:-translate-y-px hover:shadow-[0_20px_46px_-10px_rgba(232,138,118,0.55),_0_8px_20px_-6px_rgba(126,196,196,0.45)] active:translate-y-0 active:opacity-95"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-sm text-warm-300">
          New here?{" "}
          <Link
            href="/auth/signup"
            className="font-semibold text-coral-strong transition-colors hover:text-coral"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
