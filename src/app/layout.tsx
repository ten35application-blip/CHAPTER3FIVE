import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://chapter3five.app"),
  // Google Search Console ownership proof (2026-08-13) — required by
  // Play Console's organization website-verification step. Renders as
  // <meta name="google-site-verification" ...> on every page.
  verification: {
    google: "aWJAO0vCqFU5DnRFwPj76dylMaoNVN9Xqq1J6EWAnjc",
  },
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

/**
 * Text-size init, same pre-hydration contract as the theme script.
 * Settings → Appearance → Text size writes localStorage.textSize; the
 * root font-size is a PERCENTAGE so it multiplies the browser's own base
 * size rather than replacing it (a reader who already enlarged their
 * default keeps it, and this compounds). Tailwind's scale is in rem, so
 * this scales every piece of type proportionally and the existing
 * hierarchy is preserved. Runs before first paint so an enlarged page
 * never flashes at default size and jumps — which for the reader this
 * setting exists for is worse than not having it. Wrapped in try/catch:
 * localStorage throws in Private Mode and text size must never be able
 * to break the page.
 */
const TEXT_SIZE_INIT_SCRIPT = `(function(){try{var v=parseFloat(localStorage.getItem('textSize'));if(isFinite(v)&&v!==1){v=Math.min(1.4,Math.max(0.85,v));document.documentElement.style.fontSize=(v*100)+'%';}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_INIT_SCRIPT }} />
      </head>
      {/* overflow-x-hidden on body is a hard stop against horizontal
          scroll on iPad-width viewports. Something occasionally
          overflows -- a long unbroken word, a gradient card at full
          card width plus its shadow, a ring outline. Rather than chase
          each culprit, gate the whole page. Vertical scroll unaffected.
          If a page ever legitimately needs horizontal scrolling
          (a wide table, a code block), it wraps in its own
          overflow-x:auto container. */}
      <body className="min-h-full flex flex-col overflow-x-hidden bg-ink text-warm-50">
        {children}
      </body>
    </html>
  );
}
