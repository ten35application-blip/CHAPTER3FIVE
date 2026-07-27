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
  manifest: "/manifest.json",
  // Note: no title.template — every page already hard-codes its
  // "· chapter3five" suffix; a template would double it.
  // Favicons come from the file conventions src/app/icon.png and
  // src/app/apple-icon.png (Two-dots), which take precedence over
  // a metadata.icons entry.
};

/**
 * Inline pre-hydration theme script. Reads the user's saved preference
 * from localStorage ('light' | 'dark' | 'system', default 'system') and
 * writes data-theme on <html> BEFORE first paint so users on dark
 * never flash a white page. 'system' resolves via prefers-color-scheme.
 * 'light' clears the attribute so the default @theme (warm peach) wins.
 * Wrapped in try/catch — localStorage can throw in Private Mode / SSR
 * hydration edge cases and we never want the theme to break the page.
 * dangerouslySetInnerHTML is the only way to inline a script that runs
 * before React hydrates; a normal <Script strategy="beforeInteractive">
 * would still be deferred past first paint on the app router.
 */
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark')t='system';var a=t==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;if(a==='dark')document.documentElement.setAttribute('data-theme','dark');else document.documentElement.removeAttribute('data-theme');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-ink text-warm-50">
        {children}
      </body>
    </html>
  );
}
