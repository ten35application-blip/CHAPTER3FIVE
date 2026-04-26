import Link from "next/link";
import { Orb } from "@/components/Orb";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="font-serif text-xl tracking-tight text-warm-100">
            chapter3five
          </span>
          <Link
            href="/auth/signin"
            className="text-sm text-warm-200 hover:text-warm-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        <section className="relative flex flex-col items-center justify-center min-h-[100svh] px-6 pt-32 pb-24 text-center overflow-hidden">
          <div className="relative flex items-center justify-center mb-12">
            <Orb size={360} />
          </div>

          <h1 className="font-serif text-5xl sm:text-6xl md:text-7xl leading-[1.05] tracking-tight text-warm-50 max-w-3xl">
            <span className="italic font-light">Sit with them.</span>
            <br />
            While they&rsquo;re still here.
          </h1>

          <p className="mt-8 text-lg sm:text-xl text-warm-200 max-w-xl leading-relaxed font-light">
            355 questions. Recorded together. Kept forever.
            <br />
            <span className="text-warm-300">A new chapter for the people who matter most.</span>
          </p>

          <div className="mt-12">
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
            >
              Begin a chapter
            </Link>
          </div>
        </section>

        <section className="px-6 py-32 max-w-4xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-16 text-center">
            How it works
          </h2>

          <div className="space-y-24">
            <Step
              number="01"
              title="Sit together."
              body="One weekend. A grandparent and their grandkids. A daughter and her dad. A couple before a baby. Made to be answered side by side, not alone — that&rsquo;s the point."
            />
            <Step
              number="02"
              title="Answer the questions."
              body="Slow ones, surprising ones, ones you&rsquo;ve never thought to ask. Their stories, their advice, their texting style — captured the way only they tell it."
            />
            <Step
              number="03"
              title="They&rsquo;re always there."
              body="Open chapter3five anytime. To laugh at an old story. To ask for advice in their voice. To feel them close. A farewell that isn&rsquo;t goodbye."
            />
          </div>
        </section>

        <section className="px-6 py-24 max-w-4xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-12 text-center">
            A few of the questions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SampleCard text="What did your childhood home smell like? Specifically." />
            <SampleCard text="What advice would you give your 25-year-old self, and would they have listened?" />
            <SampleCard text="If you could send one text to someone you&rsquo;ve lost, what would it say?" />
          </div>
          <p className="mt-12 text-center text-sm text-warm-400 italic">
            Three of three hundred fifty-five.
          </p>
        </section>

        <section className="px-6 py-24 max-w-3xl mx-auto w-full">
          <div className="border-t border-warm-700/60 pt-16 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-6">
              Or
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-warm-50 leading-snug max-w-2xl mx-auto">
              <span className="italic font-light">No one in mind?</span>{" "}
              Randomize a persona instead.
            </h2>
            <p className="mt-6 text-warm-200 text-lg leading-relaxed max-w-xl mx-auto">
              Pick a gender, hit a button, and we mix you a character no one
              else will ever land on. Same archive, generated. First one&rsquo;s
              free.
            </p>
          </div>
        </section>

        <section className="px-6 py-24 text-center">
          <p className="font-serif italic text-2xl sm:text-3xl text-warm-100 max-w-2xl mx-auto leading-snug">
            Some people deserve to be remembered. <br />
            <span className="text-warm-200">Properly.</span>
          </p>
          <Link
            href="/auth/signup"
            className="mt-10 inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
          >
            Begin
          </Link>
        </section>
      </main>

      <Footer />
    </>
  );
}

function SampleCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-warm-700/60 bg-warm-700/10 p-6">
      <p className="font-serif text-warm-50 leading-snug text-lg italic">
        &ldquo;{text}&rdquo;
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 sm:gap-12 items-start">
      <div className="font-serif text-3xl text-warm-300 tabular-nums">
        {number}
      </div>
      <div className="space-y-3">
        <h3 className="font-serif text-3xl sm:text-4xl text-warm-50 leading-tight">
          {title}
        </h3>
        <p className="text-warm-200 text-lg leading-relaxed max-w-xl">
          {body}
        </p>
      </div>
    </div>
  );
}
