import { ImageResponse } from "next/og";

// Next.js auto-generates the OG image at /opengraph-image and references
// it from the root metadata. Same image is used for Twitter cards.

export const alt = "chapter3five — 355 questions. Recorded together. Kept forever.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle at 50% 55%, #2a1f15 0%, #0e0a07 60%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Soft orb suggestion in the background */}
        <div
          style={{
            position: "absolute",
            top: "30%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "520px",
            height: "520px",
            borderRadius: "100%",
            background:
              "radial-gradient(circle, rgba(244,230,200,0.12) 0%, rgba(244,230,200,0) 70%)",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: "32px",
              color: "#c9b896",
              letterSpacing: "1px",
              marginBottom: "60px",
            }}
          >
            chapter3five
          </div>
          <div
            style={{
              fontSize: "76px",
              color: "#f4e6c8",
              fontStyle: "italic",
              fontWeight: 300,
              textAlign: "center",
              lineHeight: 1.1,
              maxWidth: "900px",
            }}
          >
            Some people deserve to be remembered.
          </div>
          <div
            style={{
              fontSize: "76px",
              color: "#c9b896",
              fontStyle: "italic",
              fontWeight: 300,
              marginTop: "8px",
            }}
          >
            Properly.
          </div>
          <div
            style={{
              marginTop: "60px",
              fontSize: "22px",
              color: "#8a7a5e",
              letterSpacing: "0.5px",
            }}
          >
            355 questions · Recorded together · Kept forever
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
