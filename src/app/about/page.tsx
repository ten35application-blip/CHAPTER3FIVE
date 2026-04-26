import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Orb } from "@/components/Orb";

export const metadata = {
  title: "About — chapter3five",
  description:
    "Why we built chapter3five — and the people who helped make it real.",
};

export default function AboutPage() {
  return (
    <>
      <main className="flex-1">
        <header className="border-b border-warm-700/40">
          <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link
              href="/"
              className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
            >
              chapter3five
            </Link>
            <span className="text-xs uppercase tracking-[0.25em] text-warm-300">
              About
            </span>
          </div>
        </header>

        <section className="px-6 pt-20 pb-12 max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center mb-10 opacity-70">
            <Orb size={140} />
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl text-warm-50 leading-tight mb-6">
            <span className="italic font-light">An archive,</span>
            <br />
            <span className="text-warm-200">while you’re here.</span>
          </h1>
          <p className="text-warm-300 text-lg leading-relaxed max-w-xl mx-auto">
            chapter3five is a quiet place where someone records who they are —
            their answers, their voice, the texture of how they speak — while
            they’re alive. The people they love can sit with the archive
            later.
          </p>
        </section>

        {/* FOUNDER */}
        <section className="px-6 py-16 max-w-2xl mx-auto">
          <div className="rounded-3xl border border-warm-700/60 bg-warm-700/15 px-8 py-10 sm:px-10 sm:py-12">
            <div className="flex items-center gap-5 mb-8">
              {/* Founder photo. Drop a square image at /public/founder.jpg
                  to replace the initial. ~256x256 recommended. */}
              <div className="w-20 h-20 rounded-full bg-warm-700 border border-warm-300/30 flex items-center justify-center font-serif text-3xl text-warm-100 overflow-hidden flex-shrink-0">
                W
              </div>
              <div>
                <p className="font-serif text-xl text-warm-50">Wilson Feliz</p>
                <p className="text-xs uppercase tracking-[0.2em] text-warm-300 mt-1">
                  Founder
                </p>
              </div>
            </div>

            <p className="font-serif italic text-warm-50 text-lg leading-relaxed mb-6">
              “I built chapter3five because grief teaches you that what you
              keep of someone is the small stuff — the way they texted, the
              jokes they reused, the things they said when nobody else was
              listening. That stuff disappears unless somebody records it.”
            </p>
            <p className="text-warm-200 leading-relaxed">
              I’m a solo builder. I also run{" "}
              <a
                href="https://patternmd.app"
                target="_blank"
                rel="noopener"
                className="text-warm-100 underline underline-offset-2 hover:text-warm-50"
              >
                PatternMD
              </a>{" "}
              (community-powered health pattern tracking) and{" "}
              <a
                href="https://pawpact.app"
                target="_blank"
                rel="noopener"
                className="text-warm-100 underline underline-offset-2 hover:text-warm-50"
              >
                PawPact
              </a>{" "}
              (the same idea, for pets). chapter3five is the most personal of
              the three. It’s the one I wish I’d had.
            </p>
          </div>
        </section>

        {/* MISSION */}
        <section className="px-6 py-16 max-w-2xl mx-auto">
          <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-6">
            Our mission
          </h2>
          <p className="font-serif text-2xl sm:text-3xl text-warm-50 leading-snug mb-6">
            <span className="italic">Some people deserve to be remembered.</span>{" "}
            <span className="text-warm-200">Properly.</span>
          </p>
          <p className="text-warm-200 leading-relaxed">
            Not a simulation. Not a hologram. Not a chatbot trained on
            scraped texts. A real archive — built from real answers — that
            sounds like the person who gave them, and stays close to the
            people who loved them.
          </p>
        </section>

        {/* VALUES */}
        <section className="px-6 py-16 max-w-2xl mx-auto">
          <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-10">
            What we hold to
          </h2>
          <div className="space-y-10">
            <Value
              title="Yours, by design"
              body="Your data. Your copy. Yours to delete, all of it, any time. We never sell, never share, never train anyone else’s model on it. Not now, not ever."
            />
            <Value
              title="Real, not simulated"
              body="We don’t scrape, we don’t scan, we don’t guess. Every word came from the person being preserved. The AI just helps you talk to what they already wrote."
            />
            <Value
              title="Bilingual from day one"
              body="English and Spanish, equally. Every question, every prompt, every email. Because not every grandmother dreams in English."
            />
            <Value
              title="For adults"
              body="chapter3five is 18+. We talk about loss, mortality, the people we miss. That conversation belongs to grown-ups. We’ll point you to a hotline if you need one — we’re not therapy."
            />
          </div>
        </section>

        {/* SPECIAL THANKS */}
        <section className="px-6 py-16 max-w-2xl mx-auto">
          <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-6">
            Special thanks
          </h2>
          <p className="text-warm-200 leading-relaxed mb-6">
            None of this exists without the people behind it.
          </p>
          <ul className="font-serif text-warm-50 text-lg space-y-2">
            <li>Wilson F.</li>
            <li>Danisel F.</li>
            <li>Jamal P.</li>
            <li>Sigfredo V.</li>
          </ul>
          <p className="text-warm-300 text-sm mt-8 leading-relaxed italic">
            And every early reader who told us this idea didn’t feel
            ridiculous. You made the difference.
          </p>
        </section>

        {/* CLOSING CTA */}
        <section className="px-6 py-24 text-center">
          <p className="font-serif italic text-2xl sm:text-3xl text-warm-100 max-w-xl mx-auto leading-snug mb-10">
            Begin a chapter while you can.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
            >
              Begin a chapter
            </Link>
            <Link
              href="/sample"
              className="inline-flex h-12 items-center justify-center rounded-full border border-warm-300/40 px-8 text-sm font-medium text-warm-100 hover:bg-warm-700/40 transition-colors"
            >
              Try a sample first
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}

function Value({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-serif text-xl text-warm-50 mb-2">{title}</h3>
      <p className="text-warm-200 leading-relaxed">{body}</p>
    </div>
  );
}
