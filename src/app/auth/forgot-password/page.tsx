"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Forgot password — its own screen (Wilson 2026-08-21, twice: "you
 * press forgot password you should go to another screen to put your
 * email in, just like instagram or reddit").
 *
 * It used to fire in place on the sign-in form, reading whatever was
 * in the email box. Two failures in that: someone who taps it before
 * typing gets scolded ("enter your email above") for skipping a step
 * they were never shown, and the tap reads as broken because nothing
 * visibly happens. A person who taps "forgot password" has switched
 * tasks — the screen should switch with them.
 *
 * The sent state deliberately does NOT reveal whether the address has
 * an account: same message either way, so this page can't be used to
 * discover who is registered.
 */
function ForgotPasswordInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError("Enter the email you signed up with.");
      return;
    }
    setError(null);
    setSending(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    setSending(false);
    // Errors that describe the ACCOUNT are swallowed on purpose — see
    // the note above. Only transport failures surface.
    if (err && !/user|email/i.test(err.message)) {
      setError("Couldn't send that just now. Try again in a moment.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
        <div className="w-full">
          <Link
            href="/auth/signin"
            className="inline-flex h-11 items-center text-base font-semibold text-coral-strong transition-colors hover:text-coral"
          >
            <span aria-hidden="true">&larr;</span>
            <span className="ml-1">Back to sign in</span>
          </Link>
        </div>

        <Link
          href="/"
          aria-label="chapter3five home"
          className="hero-orb flex items-center justify-center"
        >
          <Image
            src="/logo-transparent.png"
            alt="chapter3five"
            width={72}
            height={72}
            priority
            className="h-18 w-18 drop-shadow-[0_16px_40px_rgba(232,138,118,0.3)]"
          />
        </Link>

        {sent ? (
          <>
            <h1 className="mt-8 text-center text-3xl font-semibold tracking-tight text-warm-50">
              Check your inbox.
            </h1>
            <p className="mt-3 text-center text-base leading-relaxed text-warm-300">
              If <span className="text-warm-100">{email.trim()}</span> has an
              account, a reset link is on its way. Open it on this device and
              you&rsquo;ll go straight to setting a new password.
            </p>
            <div className="mt-8 w-full rounded-2xl bg-ink-soft p-5 text-left ring-1 ring-warm-700/70">
              <p className="text-sm leading-relaxed text-warm-200">
                Nothing after a minute or two? Check spam, and make sure the
                address is the one you signed up with.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-6 text-sm font-semibold text-coral-strong transition-colors hover:text-coral"
            >
              Use a different email
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-8 text-center text-3xl font-semibold tracking-tight text-warm-50">
              Reset your password.
            </h1>
            <p className="mt-3 text-center text-base leading-relaxed text-warm-300">
              Enter your email and we&rsquo;ll send you a link to set a new one.
            </p>

            {error ? (
              <p
                role="alert"
                className="mt-6 w-full rounded-2xl bg-coral/10 px-4 py-3 text-center text-sm font-medium text-coral-strong ring-1 ring-coral/25"
              >
                {error}
              </p>
            ) : null}

            <form onSubmit={submit} className="mt-8 flex w-full flex-col gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-warm-100">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-13 rounded-2xl bg-ink-soft px-4 py-3.5 text-base text-warm-50 ring-1 ring-warm-700 outline-none transition-shadow placeholder:text-warm-500 focus:ring-2 focus:ring-coral/50"
                />
              </label>
              <button
                type="submit"
                disabled={sending}
                className="bg-gradient-cta flex h-14 w-full items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5)] transition-all hover:-translate-y-px active:translate-y-0 disabled:opacity-50"
              >
                {sending ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-warm-400">
              Remembered it?{" "}
              <Link
                href="/auth/signin"
                className="font-semibold text-coral-strong hover:text-coral"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
