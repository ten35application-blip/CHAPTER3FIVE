"use client";

import Link from "next/link";

/**
 * Visible error boundary for the dashboard. Surfaces the digest
 * (the only stable identifier Next.js gives client-side in
 * production) so we can grep Vercel logs for it without guessing.
 *
 * Temporary diagnostic aid — feel free to delete once the prod
 * issue is resolved.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 px-6 py-12 max-w-2xl mx-auto">
      <h1 className="font-serif text-3xl text-warm-50 mb-4">
        Something broke loading your dashboard.
      </h1>
      <p className="text-warm-200 mb-8 leading-relaxed">
        We&rsquo;re looking at it. This panel exists so we can debug
        without guessing.
      </p>

      <div className="rounded-2xl bg-warm-700/30 border border-warm-700/60 p-5 mb-6 space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-warm-400">
          Diagnostic
        </p>
        <p className="text-sm text-warm-100">
          <span className="text-warm-300">Digest:</span>{" "}
          <code className="font-mono text-warm-50 break-all">
            {error.digest ?? "(no digest)"}
          </code>
        </p>
        {error.message && error.message !== "" && (
          <p className="text-sm text-warm-100">
            <span className="text-warm-300">Message:</span>{" "}
            <code className="font-mono text-warm-50 break-all">
              {error.message}
            </code>
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
        >
          Try again
        </button>
        <Link
          href="/account"
          className="h-11 px-5 rounded-full border border-warm-300/40 text-warm-100 hover:bg-warm-700/40 transition-colors text-sm flex items-center"
        >
          Account
        </Link>
      </div>
    </main>
  );
}
