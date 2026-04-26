import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Block authenticated/personal/admin/system surfaces from being
        // crawled, even though they redirect — keeps the search index
        // clean and prevents leakage of route names.
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/auth/callback",
          "/auth/reset-password",
          "/auth/confirmed",
          "/dashboard",
          "/dashboard/",
          "/onboarding",
          "/onboarding/",
          "/settings",
          "/settings/",
          "/answers",
          "/agreements",
          "/account-deleted",
          "/shared/",
          "/legacy/",
          "/invite/",
          "/oracle/",
          "/randomize/",
        ],
      },
    ],
    sitemap: "https://chapter3five.app/sitemap.xml",
  };
}
