import type { Metadata } from "next";
import { Geist, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "chapter3five — sit with them, while they're still here.",
  description:
    "355 questions. Recorded together. Kept forever. A new chapter for the people who matter most.",
  metadataBase: new URL("https://chapter3five.app"),
  openGraph: {
    title: "chapter3five",
    description:
      "355 questions. Recorded together. Kept forever.",
    url: "https://chapter3five.app",
    siteName: "chapter3five",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "chapter3five",
    description:
      "355 questions. Recorded together. Kept forever.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-warm-50">
        {children}
      </body>
    </html>
  );
}
