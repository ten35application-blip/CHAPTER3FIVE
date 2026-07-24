import Image from "next/image";
import Link from "next/link";

/**
 * Shared chrome for the three legal pages (/terms, /privacy,
 * /guidelines). Server component — pure layout, no state.
 *
 * Visual contract (visual-v2):
 * - Page sits on the global peach `--color-ink` background; the logo's
 *   dark squircle gets a coral+teal `.hero-orb` aura BEHIND it plus
 *   generous whitespace, so the dark box floats in a warm halo instead
 *   of fighting a gradient fill.
 * - The orb appears ONLY in the hero. Everything below is a quiet
 *   ~65ch prose column — a wall of legal text doesn't need ambience.
 */

export type TocItem = {
  id: string;
  label: string;
};

export function LegalShell({
  kicker,
  title,
  tagline,
  toc,
  children,
  contactEmail,
  contactNote,
  currentPath,
}: {
  /** Small gradient lead-in above the title, e.g. "The legal stuff". */
  kicker: string;
  title: string;
  /** One warm sentence under the title telling you what this page is. */
  tagline: string;
  toc: TocItem[];
  children: React.ReactNode;
  contactEmail: string;
  contactNote: string;
  /** Route of the current page, so the footer links skip it. */
  currentPath: "/terms" | "/privacy" | "/guidelines";
}) {
  const otherPages = (
    [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/guidelines", label: "Community Guidelines" },
    ] as const
  ).filter((p) => p.href !== currentPath);

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-10 sm:py-14">
      {/* Back home — top-left, on its own row above the hero */}
      <div className="w-full max-w-2xl">
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-1.5 text-base font-semibold text-warm-300 transition-colors hover:text-coral-strong"
        >
          <span aria-hidden="true">&larr;</span> Back home
        </Link>
      </div>

      {/* Hero — logo in its warm halo, title, effective-date banner */}
      <header className="mt-8 flex w-full max-w-2xl flex-col items-center text-center">
        <div className="hero-orb flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="chapter3five"
            width={80}
            height={80}
            priority
            className="h-20 w-20 drop-shadow-[0_18px_44px_rgba(232,138,118,0.3)]"
          />
        </div>
        <p className="text-gradient-cta mt-7 text-sm font-bold uppercase tracking-[0.14em]">
          {kicker}
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-warm-50 sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-warm-200">
          {tagline}
        </p>
        <p className="mt-7 rounded-full border border-warm-700 bg-ink-soft px-5 py-2 text-sm font-semibold text-warm-300">
          Effective July 24, 2026 &middot; Last updated July 24, 2026
        </p>
      </header>

      {/* Table of contents */}
      <nav
        aria-label="Table of contents"
        className="mt-10 w-full max-w-2xl rounded-3xl border border-warm-700 bg-ink-soft px-7 py-6 sm:px-9"
      >
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-warm-400">
          On this page
        </p>
        <ol className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {toc.map((item, i) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="group inline-flex items-baseline gap-2.5 text-base font-medium text-warm-200 transition-colors hover:text-coral-strong"
              >
                <span className="text-sm font-bold tabular-nums text-warm-400 transition-colors group-hover:text-coral-strong">
                  {i + 1}
                </span>
                {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Prose column — quiet, readable, ~65ch */}
      <article className="mt-14 w-full max-w-[65ch] space-y-14">
        {children}
      </article>

      {/* Contact + cross-links footer */}
      <footer className="mt-20 w-full max-w-[65ch] border-t border-warm-700 pb-8 pt-10 text-center">
        <p className="text-lg leading-relaxed text-warm-200">{contactNote}</p>
        <a
          href={`mailto:${contactEmail}`}
          className="text-gradient-cta mt-2 inline-block text-lg font-bold"
        >
          {contactEmail}
        </a>
        <div className="mt-8 flex items-center justify-center gap-6 text-sm font-semibold text-warm-400">
          {otherPages.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="transition-colors hover:text-coral-strong"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </footer>
    </main>
  );
}

/**
 * One numbered legal section. Children are plain <p> / <ul> — the
 * wrapper supplies size, color, and rhythm so the copy stays clean.
 */
export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="flex items-baseline gap-3 text-2xl font-bold tracking-tight text-warm-50">
        <span className="text-lg font-bold tabular-nums text-warm-400">
          {number}.
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-lg leading-relaxed text-warm-200 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-warm-100 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </div>
    </section>
  );
}

/**
 * A softly elevated callout for the passages that matter most (crisis
 * numbers, the "this is not the person" acknowledgment). Peach card,
 * hairline border, no gradient — emphasis through calm, not color.
 */
export function LegalCallout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-warm-700 bg-ink-soft px-6 py-5 text-lg leading-relaxed text-warm-100">
      {children}
    </div>
  );
}
