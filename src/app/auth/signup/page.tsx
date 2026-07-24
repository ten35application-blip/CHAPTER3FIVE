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

  redirect("/dashboard");
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
        <Link href="/" aria-label="chapter3five home">
          <Image
            src="/logo.png"
            alt="chapter3five"
            width={64}
            height={64}
            priority
            className="h-16 w-16"
          />
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Make an account.
        </h1>
        <p className="mt-2 text-sm text-warm-300">
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

        <form action={signUp} className="mt-6 flex w-full flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-warm-200">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-amber"
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
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-amber"
              placeholder="At least 8 characters"
            />
          </label>

          <label className="mt-2 flex cursor-pointer items-start gap-3 text-sm text-warm-200">
            <input
              type="checkbox"
              name="eighteen"
              required
              className="mt-0.5 h-5 w-5 accent-amber"
            />
            <span>I&apos;m 18 or older.</span>
          </label>

          <button
            type="submit"
            className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-amber text-lg font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            Create account
          </button>
        </form>

        <p className="mt-6 text-sm text-warm-300">
          Already have an account?{" "}
          <Link href="/auth/signin" className="font-medium text-amber">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
