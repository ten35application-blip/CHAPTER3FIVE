"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Next 16 App Router route-level error boundary. Catches unhandled
 * exceptions thrown by server components / server actions inside
 * any route that doesn't provide its own error.tsx. Warmer than a
 * bare stack trace.
 *
 * Fable audit: prior state was "no error.tsx / not-found.tsx /
 * loading.tsx anywhere" — a broken data fetch on any page showed
 * the raw Next error screen.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the browser console so a developer opening DevTools sees
    // the actual error. Sentry's onRequestError instrumentation on the
    // server side already captured it.
    console.error("[app/error]", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="hero-orb flex h-24 w-24 items-center justify-center opacity-70">
          <span aria-hidden className="text-4xl">
            &middot;&middot;
          </span>
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-warm-50">
          Something didn&rsquo;t go right.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-warm-300">
          It&rsquo;s on us. Try again, and if it keeps happening,
          write to{" "}
          <a
            href="mailto:help@chapter3five.app"
            className="text-coral-strong hover:underline"
          >
            help@chapter3five.app
          </a>{" "}
          and we&rsquo;ll dig in.
        </p>
        {error?.digest ? (
          <p className="mt-3 font-mono text-xs text-warm-400">
            ref {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex w-full flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-12 items-center justify-center rounded-full px-8 text-sm font-bold text-white transition-all hover:-translate-y-px active:translate-y-0"
          >
            Try again
          </button>
          <Link
            href="/"
            className="flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium text-warm-300 ring-1 ring-warm-700 transition-colors hover:text-warm-100 hover:ring-warm-500"
          >
            Back to chapter3five
          </Link>
        </div>
      </div>
    </main>
  );
}
