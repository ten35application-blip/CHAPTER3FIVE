"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Mobile-parity signin (2026-08-03). Web must match mobile — no more,
 * no less. Same copy down to the period. Mirrors
 * chapter3five-app/app/auth/signin.tsx: back chevron top-left,
 * "Welcome back." (no gradient), "Sign in to continue." sub, inline
 * "Forgot password?" that fires resetPasswordForEmail in place,
 * busy-state button label. Terms/Privacy fine-print block removed —
 * the recorded acceptance lives at /onboarding, the (gated) layout
 * enforces it.
 */
export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || busy) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setBusy(false);
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid") || msg.includes("credential")) {
        setError("That email and password don't match.");
      } else if (msg.includes("confirm")) {
        setError("Check your email to confirm your account first.");
      } else {
        setError(error.message);
      }
      return;
    }
    // Full navigation to bounce through the (gated) layout for terms /
    // profile checks; router.replace + refresh keeps middleware happy.
    router.replace("/dashboard");
    router.refresh();
  }

  async function forgotPassword() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter your email above so we can send the reset link.");
      return;
    }
    setError(null);
    setInfo(null);
    setResetting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setResetting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setInfo(
      "Check your inbox for a reset link. If you don't see it, look in spam.",
    );
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* Back to landing — top-left affordance (mobile parity). */}
        <div className="w-full">
          <Link
            href="/"
            className="inline-flex h-11 items-center text-base font-semibold text-coral-strong transition-colors hover:text-coral"
          >
            <span aria-hidden="true">&larr;</span>
            <span className="ml-1">Back</span>
          </Link>
        </div>

        {/* Compact hero moment matching signup, so auth screens feel of
            a piece with the landing rather than a stock form. */}
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
          Welcome back.
        </h1>
        <p className="mt-3 text-base text-warm-300">Sign in to continue.</p>

        {error ? (
          <p
            role="alert"
            className="mt-6 w-full rounded-2xl bg-warm-700 px-4 py-3 text-center text-sm text-warm-100"
          >
            {error}
          </p>
        ) : null}
        {info ? (
          <p
            role="status"
            className="mt-6 w-full rounded-2xl bg-warm-700/60 px-4 py-3 text-center text-sm text-warm-100"
          >
            {info}
          </p>
        ) : null}

        <form onSubmit={submit} className="mt-8 flex w-full flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-warm-200">Email</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-coral"
              placeholder="Your password"
            />
          </label>

          <button
            type="submit"
            disabled={busy || !email || !password}
            className="bg-gradient-cta hover:bg-gradient-cta-hover mt-4 flex h-14 w-full items-center justify-center rounded-full text-lg font-bold tracking-tight text-white shadow-[0_16px_40px_-10px_rgba(232,138,118,0.5),_0_6px_16px_-6px_rgba(126,196,196,0.4)] transition-all hover:-translate-y-px hover:shadow-[0_20px_46px_-10px_rgba(232,138,118,0.55),_0_8px_20px_-6px_rgba(126,196,196,0.45)] active:translate-y-0 active:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          {/* Inline forgot-password (mobile parity): coral link that
              fires resetPasswordForEmail in place, no separate route
              hop. The /auth/forgot-password route can stay for now so
              deep-link email flows still land somewhere sensible. */}
          <button
            type="button"
            onClick={forgotPassword}
            disabled={resetting}
            className="mt-3 self-center text-sm font-semibold text-coral-strong transition-colors hover:text-coral disabled:opacity-50"
          >
            {resetting ? "Sending…" : "Forgot password?"}
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
