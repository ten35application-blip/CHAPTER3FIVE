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
          Welcome back.
        </h1>
        <p className="mt-2 text-sm text-warm-300">
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

        <form action={signIn} className="mt-6 flex w-full flex-col gap-3">
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
              autoComplete="current-password"
              required
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-amber"
              placeholder="Your password"
            />
          </label>

          <div className="mt-1 flex justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-warm-300"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            className="mt-4 flex h-14 w-full items-center justify-center rounded-full bg-amber text-lg font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-sm text-warm-300">
          New here?{" "}
          <Link href="/auth/signup" className="font-medium text-amber">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
