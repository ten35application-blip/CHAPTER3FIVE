import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://chapter3five.app"),
  title: "chapter3five — someone to talk to. someone to keep.",
  description:
    "For the moments you want to reach out. And the people worth keeping. Talk to someone made just for you — or leave someone you love a way to still be talked to.",
  openGraph: {
    title: "chapter3five — someone to talk to. someone to keep.",
    description:
      "For the moments you want to reach out. And the people worth keeping. Talk to someone made just for you — or leave someone you love a way to still be talked to.",
    url: "https://chapter3five.app",
    siteName: "chapter3five",
    type: "website",
    // opengraph-image.png in src/app is picked up automatically
  },
  twitter: {
    card: "summary_large_image",
    title: "chapter3five — someone to talk to. someone to keep.",
    description:
      "For the moments you want to reach out. And the people worth keeping. 18+.",
    // twitter-image.png in src/app is picked up automatically
  },
  robots: { index: true, follow: true },
  // Note: no title.template — every page already hard-codes its
  // "· chapter3five" suffix; a template would double it.
  // Favicons come from the file conventions src/app/icon.png and
  // src/app/apple-icon.png (Two-dots), which take precedence over
  // a metadata.icons entry.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-ink text-warm-50">
        {children}
      </body>
    </html>
  );
}
