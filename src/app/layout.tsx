import type { Metadata } from "next";
import { Geist, Cormorant_Garamond } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
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
  title: {
    default: "chapter3five — some people deserve to be remembered. Properly.",
    template: "%s · chapter3five",
  },
  description:
    "An archive built from their own answers — recorded while they're alive, kept close after. Not a simulation. Yours to delete.",
  metadataBase: new URL("https://chapter3five.app"),
  applicationName: "chapter3five",
  authors: [{ name: "chapter3five" }],
  keywords: [
    "digital legacy",
    "memorial",
    "archive",
    "remembrance",
    "chapter3five",
  ],
  openGraph: {
    title: "chapter3five",
    description:
      "Some people deserve to be remembered. Properly. 355 questions, recorded together, kept forever.",
    url: "https://chapter3five.app",
    siteName: "chapter3five",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "chapter3five",
    description:
      "Some people deserve to be remembered. Properly.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the signed-in user's theme preference so we can set
  // data-theme on <html> for CSS palette swap. Anonymous visitors
  // (landing, sign-in) just get the default "dusk".
  let theme = "dusk";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.theme === "daylight") theme = "daylight";
    }
  } catch {
    /* fall back to dusk on any error */
  }

  return (
    <html
      lang="en"
      data-theme={theme}
      className={`${geistSans.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-warm-50">
        {children}
      </body>
    </html>
  );
}
