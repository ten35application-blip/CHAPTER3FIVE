import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Suppress source-map upload warnings during dev — they only run if
  // SENTRY_AUTH_TOKEN is set in CI/Vercel.
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Source maps uploaded only when an auth token is provided. Skipping
  // is the safe default in dev / on PR previews.
  widenClientFileUpload: true,
  disableLogger: true,
});
