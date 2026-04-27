import { ImageResponse } from "next/og";

// Next.js auto-generates the OG image at /opengraph-image and references
// it from the root metadata. Same image is used for Twitter cards.
//
// Kept intentionally minimal: a centered orb (the brand mark) + the
// wordmark. No custom fonts (system fallback only — guaranteed to
// render in edge runtime), no complex layout that could fail.

export const alt = "chapter3five";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0e0a07",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Orb — concentric warm gradient, the same visual identity as
            the in-app brand mark. */}
        <div
          style={{
            width: "360px",
            height: "360px",
            borderRadius: "100%",
            background:
              "radial-gradient(circle at 40% 35%, #f4e6c8 0%, #d4b787 30%, #8a6f47 65%, #2a1f15 100%)",
            boxShadow: "0 0 80px 20px rgba(244,230,200,0.18)",
            display: "flex",
          }}
        />

        <div
          style={{
            marginTop: "60px",
            fontSize: "64px",
            color: "#f4e6c8",
            letterSpacing: "1px",
            fontWeight: 400,
            display: "flex",
          }}
        >
          chapter3five
        </div>
      </div>
    ),
    { ...size },
  );
}
