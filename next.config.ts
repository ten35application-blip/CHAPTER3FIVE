import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // sharp ships native .node binaries. Bundled into a serverless
  // function they don't resolve, and the module throws at IMPORT time —
  // which takes the whole route down before a single line of the
  // handler runs. /api/legacy/photo returned a 500 HTML error page to
  // every request, authenticated or not, so every photo picked during
  // the archive walk on mobile silently failed to upload (found
  // 2026-08-22, after the first real archive came out with no face).
  // Externalizing keeps it a plain Node require at runtime.
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      // Photo-to-identity uploads (identity/from-photo, 5 MB) and
      // profile-photo uploads (settings/profile, 8 MB) both send the
      // image through a server action; the default 1 MB body limit is
      // too small. 10 MB covers the 8 MB cap + multipart overhead.
      bodySizeLimit: "10mb",
    },
  },
  images: {
    // Supabase storage hosts our avatars + chat-photos + archive-photos.
    // Allow it via remotePatterns so bare <img> tags can be swapped for
    // <Image> and get free LCP / lazy-loading / format negotiation.
    // The bucket access (public vs RLS) is still enforced server side;
    // next/image just needs the host to be on its allow-list.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
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
