import Link from "next/link";
import { Footer } from "./Footer";

export function LegalPage({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            chapter3five
          </Link>
          <Link
            href="/"
            className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="rounded-lg border border-warm-400/30 bg-warm-700/20 px-4 py-3 mb-12 text-sm text-warm-200">
            <strong className="text-warm-100">Draft, not legal advice.</strong>{" "}
            This document is a placeholder. A reviewed, jurisdiction-specific
            version will be in place before chapter3five accepts paying users or
            stores production data.
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 mb-2">
            {title}
          </h1>
          <p className="text-sm text-warm-400 mb-12">
            Last updated: {lastUpdated}
          </p>

          <article className="prose-legal text-warm-100 space-y-6 leading-relaxed">
            {children}
          </article>
        </div>
      </main>

      <Footer />
    </>
  );
}
