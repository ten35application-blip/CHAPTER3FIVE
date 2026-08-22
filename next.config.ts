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
  // Externalizing sharp stops Next from bundling it — but it also stops
  // the file tracer from pulling its native packages into the function,
  // so the require resolves to nothing:
  //   ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared
  //   object file
  // The lockfile HAS @img/sharp-linux-x64 + @img/sharp-libvips-linux-x64
  // correctly gated to linux; they simply weren't landing in the
  // deployed function. Every surface that touches sharp names itself
  // here: the mobile archive-photo endpoint, the web archive walk, and
  // the profile-photo upload in settings.
  outputFileTracingIncludes: {
    "/api/legacy/photo": ["./node_modules/@img/**/*"],
    "/identity/legacy/new": ["./node_modules/@img/**/*"],
    "/settings": ["./node_modules/@img/**/*"],
  },
  experimental: {
    serverActions: {
      // Photo-to-identity uploads (identity/from-photo, 5 MB) and
      // profile-photo uploads (settings/profile, 8 MB) both send the
      // image through a server action; the default 1 MB body limit is
      // too small. 10 MB covers the 8 MB cap + multipart overhead.
      bodySizeLimit: "10mb",
    },
  },
  // Apple fetches /.well-known/apple-app-site-association and REJECTS it
  // unless it is served as application/json. The file has no extension,
  // so Next would hand it back as octet-stream and the association —
  // and with it iCloud Keychain sharing between the site and the app —
  // silently never activates.
  async headers() {
    return [
      {
        source: "/.well-known/apple-app-site-association",
        headers: [{ key: "Content-Type", value: "application/json" }],
      },
    ];
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
