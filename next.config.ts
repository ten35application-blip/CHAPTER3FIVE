import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
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
