import type { Metadata } from "next";
import { Geist, Cormorant_Garamond } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { NavFab } from "@/components/NavFab";
import { HomeChrome } from "@/components/HomeChrome";
import { NotificationToast } from "@/components/NotificationToast";
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
    default: "chapter3five — stay close to the people you love.",
    template: "%s · chapter3five",
  },
  description:
    "A shared archive built from your own answers — somewhere you and the people you love can stay close, across distance and across time. Not a simulation. Yours to keep, yours to delete.",
  metadataBase: new URL("https://chapter3five.app"),
  applicationName: "chapter3five",
  authors: [{ name: "chapter3five" }],
  keywords: [
    "shared archive",
    "family connection",
    "stay in touch",
    "personal archive",
    "chapter3five",
  ],
  openGraph: {
    title: "chapter3five",
    description:
      "Stay close to the people you love. 355 questions, answered together, yours to keep.",
    url: "https://chapter3five.app",
    siteName: "chapter3five",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "chapter3five",
    description: "Stay close to the people you love.",
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
  // Favicon + apple-touch-icon are picked up automatically from
  // src/app/icon.png + src/app/apple-icon.png (Next 15 convention).
  // No explicit `icons` field needed.
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read the signed-in user's theme + language so we can set
  // data-theme on <html> for CSS palette swap and pass language to
  // the nav FAB. Anonymous visitors (landing, sign-in) get defaults.
  let theme = "dusk";
  let language: "en" | "es" = "en";
  let userIsAdmin = false;
  let signedIn = false;
  let accessibility = false;
  let signedInUserId: string | null = null;
  let userEmail: string | null = null;
  let trashedCount = 0;
  let ownedOracles: { id: string; name: string; avatarUrl: string | null }[] =
    [];
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      signedIn = true;
      signedInUserId = user.id;
      userEmail = user.email ?? null;
      userIsAdmin = isAdmin(user.email);
      const { data: profile } = await supabase
        .from("profiles")
        .select("theme, preferred_language")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.theme === "daylight") theme = "daylight";
      if (profile?.preferred_language === "es") language = "es";
      // accessibility_mode read separately because the column may
      // not exist on older deploys; degrade silently if so.
      try {
        const { data: accRow } = await supabase
          .from("profiles")
          .select("accessibility_mode")
          .eq("id", user.id)
          .maybeSingle();
        if ((accRow as { accessibility_mode?: boolean } | null)?.accessibility_mode) {
          accessibility = true;
        }
      } catch {
        accessibility = false;
      }

      // Owned identities — used by HomeChrome's + sheet for the
      // group-create picker. Single light query; the rest of the
      // sheet is no-data.
      const { data: oracleRows } = await supabase
        .from("oracles")
        .select("id, name, avatar_url")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(12);
      if (oracleRows) {
        ownedOracles = oracleRows.map((o) => ({
          id: o.id as string,
          name: (o.name as string) ?? "untitled",
          avatarUrl: (o.avatar_url as string | null) ?? null,
        }));
      }

      // Trashed count for the drawer's "Trash · N" badge.
      const { count: tc } = await supabase
        .from("oracles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("deleted_at", "is", null);
      trashedCount = tc ?? 0;
    }
  } catch {
    /* fall back to defaults on any error */
  }

  return (
    <html
      lang={language}
      data-theme={theme}
      data-accessibility={accessibility ? "on" : "off"}
      className={`${geistSans.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-warm-50">
        {children}
        {signedIn && (
          <>
            {signedInUserId && (
              <NotificationToast userId={signedInUserId} />
            )}
            {/* Mobile: top-left avatar opens a left-side drawer (Google
                Messages model); top-right pill composes (iMessage).
                Drawer holds Contacts / Trash / Share & inherit / Settings
                / How it works / Sign out. Desktop (md+) keeps NavFab. */}
            <HomeChrome
              language={language}
              ownedOracles={ownedOracles}
              userEmail={userEmail}
              isAdmin={userIsAdmin}
              trashedCount={trashedCount}
            />
            <div className="hidden md:block">
              <NavFab language={language} isAdmin={userIsAdmin} />
            </div>
          </>
        )}
      </body>
    </html>
  );
}
