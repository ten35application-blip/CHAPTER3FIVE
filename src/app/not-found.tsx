import Link from "next/link";

/**
 * Root not-found. Fires when notFound() is called from a server
 * component or when a URL doesn't match any route. Warmer than
 * Next's bare 404 page.
 */
export default function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="hero-orb flex h-24 w-24 items-center justify-center opacity-70">
          <span aria-hidden className="text-4xl">
            &middot;&middot;
          </span>
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-warm-50">
          We couldn&rsquo;t find that.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-warm-300">
          The link may have been moved, revoked, or never existed.
          Head home and try again from there.
        </p>
        <Link
          href="/"
          className="bg-gradient-cta hover:bg-gradient-cta-hover mt-8 flex h-12 items-center justify-center rounded-full px-8 text-sm font-bold text-white transition-all hover:-translate-y-px active:translate-y-0"
        >
          Back to chapter3five
        </Link>
      </div>
    </main>
  );
}
