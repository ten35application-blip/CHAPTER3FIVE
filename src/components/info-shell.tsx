import Image from "next/image";
import Link from "next/link";

/**
 * Shared chrome for the light informational pages (/about, /advertise,
 * /data-deletion). Same visual language as LegalShell — logo in its
 * warm halo, gradient kicker, quiet prose column — minus the parts a
 * story page doesn't need (TOC, effective-date banner, numbered
 * sections). Server component, pure layout.
 */
export function InfoShell({
  kicker,
  title,
  tagline,
  children,
  contactEmail,
  contactNote,
}: {
  /** Small gradient lead-in above the title, e.g. "Our story". */
  kicker: string;
  title: string;
  /** One warm sentence under the title telling you what this page is.
   *  Optional as of 2026-08-03 (mobile parity — LegalScreen renders
   *  only kicker + title + content, and web now matches). */
  tagline?: string;
  children: React.ReactNode;
  /** Optional footer contact. Omit both to skip the contact block. */
  contactEmail?: string;
  contactNote?: string;
}) {
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

      {/* Hero — logo in its warm halo, kicker, title, tagline */}
      <header className="mt-8 flex w-full max-w-2xl flex-col items-center text-center">
        <div className="hero-orb flex items-center justify-center">
          <Image
            src="/logo-transparent.png"
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
        {tagline ? (
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-warm-200">
            {tagline}
          </p>
        ) : null}
      </header>

      {/* Prose column — quiet, readable, ~65ch. Headings and emphasis
          get their rhythm from the selectors here so page copy stays
          plain <h2> / <p> / <ul>. */}
      <article className="mt-14 w-full max-w-[65ch] space-y-6 text-lg leading-relaxed text-warm-200 [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-warm-50 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-warm-100 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6">
        {children}
      </article>

      {/* Contact footer */}
      {contactEmail && contactNote ? (
        <footer className="mt-20 w-full max-w-[65ch] border-t border-warm-700 pb-8 pt-10 text-center">
          <p className="text-lg leading-relaxed text-warm-200">
            {contactNote}
          </p>
          <a
            href={`mailto:${contactEmail}`}
            className="text-gradient-cta mt-2 inline-block text-lg font-bold"
          >
            {contactEmail}
          </a>
        </footer>
      ) : (
        <div className="pb-8 pt-10" />
      )}
    </main>
  );
}
