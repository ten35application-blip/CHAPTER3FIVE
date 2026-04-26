/**
 * Next.js instrumentation hook — Sentry initialization.
 *
 * Wires server-side + edge-side error reporting. Client-side is wired
 * by /instrumentation-client.ts.
 *
 * Set SENTRY_DSN in Vercel env to enable in production. Without the
 * DSN, Sentry is a no-op — safe to leave the import in place during
 * dev without spamming a project that doesn't exist yet.
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.VERCEL_ENV ?? "development",
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.VERCEL_ENV ?? "development",
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
