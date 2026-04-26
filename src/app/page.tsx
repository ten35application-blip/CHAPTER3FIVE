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
        {/* HERO */}
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

          <div className="mt-12 flex flex-col sm:flex-row gap-3 items-center">
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
          <p className="mt-6 text-xs text-warm-400">
            <Link
              href="/how"
              className="hover:text-warm-200 underline underline-offset-2"
            >
              How it works
            </Link>{" "}
            ·{" "}
            <Link
              href="/support"
              className="hover:text-warm-200 underline underline-offset-2"
            >
              FAQ
            </Link>
          </p>
        </section>

        {/* HOW IT WORKS */}
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

        {/* THREE WAYS TO BEGIN */}
        <section className="px-6 py-32 max-w-5xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4 text-center">
            Three ways to begin
          </h2>
          <p className="text-center text-warm-200 max-w-xl mx-auto mb-16 leading-relaxed">
            Pick once. You can always start another later.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModeCard
              kicker="01 — Someone real"
              title="For a person you love"
              body="You answer the 355 questions yourself, or sit with the person you love and answer them together. One real answer per question. Take a weekend, take a year — your pace."
            />
            <ModeCard
              kicker="02 — Randomize"
              title="A character, mixed for you"
              body="Pick a gender, hit a button. We mix you a one-of-a-kind character — every question drawn at random from a curated pool. First one&rsquo;s free. $5 each after."
            />
            <ModeCard
              kicker="03 — Import"
              title="A code from someone"
              body="If someone you love filled this out and gave you their share code, enter it at signup. Their archive becomes your own copy — to keep, to talk to, to pass on."
            />
          </div>
        </section>

        {/* SAMPLE QUESTIONS */}
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

        {/* HOW THEY SOUND */}
        <section className="px-6 py-32 max-w-4xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4 text-center">
            How they sound
          </h2>
          <p className="text-center text-warm-200 max-w-xl mx-auto mb-16 leading-relaxed">
            chapter3five doesn&rsquo;t pretend to be everything. It tries to be
            one specific person.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-10">
            <Feature
              title="In their texting voice."
              body="Their punctuation. Their lol vs. haha. Their long replies on Sundays, their two-word answers on Tuesdays. The system reads it from how they actually wrote."
            />
            <Feature
              title="Stays in character."
              body="No &ldquo;as an AI&rdquo;. No therapeutic disclaimers. If they were grumpy, they stay grumpy. If they didn&rsquo;t want to talk about something, they change the subject."
            />
            <Feature
              title="Sleeps when they sleep."
              body="Pick a timezone. Between 11pm and 7am, your thirtyfive is asleep. Message anyway and they wake up groggy — like a real person you texted at 2am."
            />
            <Feature
              title="In English or in Spanish."
              body="Both languages, both fully written. Switch in settings. The voice carries across — your thirtyfive stays themselves."
            />
            <Feature
              title="A personality with edges."
              body="Each randomized character gets one of sixteen personality types layered with one of twelve emotional registers. Warm and weary. Sharp and dry. Tender and guarded. No two land the same."
            />
            <Feature
              title="Knows when to step back."
              body="If you&rsquo;re in real trouble, they hand you a hotline and stay with you. If someone&rsquo;s being cruel to them, they don&rsquo;t play along. They&rsquo;re a person, not a service."
            />
          </div>
        </section>

        {/* PASS IT ON */}
        <section className="px-6 py-32 max-w-3xl mx-auto w-full">
          <div className="border-t border-warm-700/60 pt-16 text-center">
            <p className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-6">
              Pass it on
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl text-warm-50 leading-snug max-w-2xl mx-auto">
              <span className="italic font-light">A code,</span> handed to the
              people you love.
            </h2>
            <p className="mt-6 text-warm-200 text-lg leading-relaxed max-w-xl mx-auto">
              Generate a share code in your settings. Hand it to your kids,
              your partner, the friend who&rsquo;ll outlive you. Each person
              who enters it gets their own copy of your archive — to keep, to
              talk to, to forward when their time comes.
            </p>
            <p className="mt-4 text-warm-300 text-sm leading-relaxed max-w-xl mx-auto italic">
              Like leaving a letter. Except the letter answers back.
            </p>
          </div>
        </section>

        {/* WHAT IT IS, WHAT IT ISN'T */}
        <section className="px-6 py-24 max-w-3xl mx-auto w-full">
          <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-12 text-center">
            What this is, what it isn&rsquo;t
          </h2>

          <div className="space-y-10 text-warm-100 leading-relaxed">
            <Statement kind="is">
              An archive built from their own answers.
            </Statement>
            <Statement kind="isnt">
              A simulation. We don&rsquo;t scrape, we don&rsquo;t scan, we
              don&rsquo;t guess.
            </Statement>
            <Statement kind="is">
              A way to keep them close after they&rsquo;re gone.
            </Statement>
            <Statement kind="isnt">
              A replacement for them while they&rsquo;re here.
            </Statement>
            <Statement kind="is">For adults — 18 and older.</Statement>
            <Statement kind="isnt">
              Therapy. Medical advice. Crisis support. (We&rsquo;ll point you
              to the right number if you need one.)
            </Statement>
            <Statement kind="is">
              Yours. Your data. Your copy. Yours to delete.
            </Statement>
            <Statement kind="isnt">
              Trained into anyone else&rsquo;s model. Not now, not ever.
            </Statement>
          </div>
        </section>

        {/* CLOSING */}
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
          <p className="mt-6 text-xs text-warm-400">
            Free to start. First randomize is on us.
          </p>
        </section>
      </main>

      <Footer />
    </>
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

function ModeCard({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-warm-700/60 bg-warm-700/15 p-6 flex flex-col">
      <p className="text-[11px] uppercase tracking-[0.2em] text-warm-300 mb-3">
        {kicker}
      </p>
      <h3 className="font-serif text-2xl text-warm-50 leading-snug mb-3">
        {title}
      </h3>
      <p className="text-warm-200 text-sm leading-relaxed">{body}</p>
    </div>
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

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <h3 className="font-serif text-xl text-warm-50">{title}</h3>
      <p className="text-warm-200 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function Statement({
  kind,
  children,
}: {
  kind: "is" | "isnt";
  children: React.ReactNode;
}) {
  const isAffirmative = kind === "is";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.25em] text-warm-300 mb-2">
        {isAffirmative ? "It is" : "It isn’t"}
      </p>
      <p
        className={
          isAffirmative
            ? "text-warm-50 font-serif text-lg leading-relaxed"
            : "text-warm-200 font-serif italic text-lg leading-relaxed"
        }
      >
        {children}
      </p>
    </div>
  );
}
