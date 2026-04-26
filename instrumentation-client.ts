/**
 * Client-side Sentry init. Loaded by Next.js automatically when
 * NEXT_PUBLIC_SENTRY_DSN is set. Captures unhandled errors + network
 * issues from the browser. Sample rate kept low so we don't spam the
 * project on noisy clients.
 */
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
