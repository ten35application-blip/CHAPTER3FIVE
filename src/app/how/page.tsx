import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Orb } from "@/components/Orb";

export const metadata = {
  title: "How chapter3five works",
  description:
    "A short walkthrough of how to use chapter3five — from your first answer to passing your archive on.",
};

export default function HowItWorksPage() {
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
              How it works
            </span>
          </div>
        </header>

        <section className="px-6 pt-20 pb-12 max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center mb-10 opacity-70">
            <Orb size={140} />
          </div>
          <h1 className="font-serif text-5xl sm:text-6xl text-warm-50 leading-tight mb-6">
            <span className="italic font-light">How it works.</span>
          </h1>
          <p className="text-warm-300 text-lg leading-relaxed max-w-xl mx-auto">
            Five small steps from a blank page to an archive your family can
            sit with for the rest of their lives.
          </p>
        </section>

        <section className="px-6 py-16 max-w-2xl mx-auto space-y-20">
          <Step
            number="01"
            title="Begin a chapter"
            body="Sign up with an email and password. Pick a name for your thirtyfive — your name, your dad's name, whatever they're called. Pick a language. We'll remember which way you want it to sound."
          />

          <Step
            number="02"
            title="Answer the questions"
            body="There are 355 of them. Don't try to do them in one sitting. Five a day, ten a day — whatever fits. They're written to surface texture, not a résumé: how you say goodnight, what you regret, what music you'd want at your funeral. The answers are yours, exactly as you wrote them. We don't rephrase. We don't polish."
          />

          <Step
            number="03"
            title="Add a photo and a voice"
            body="Drop in a photo so the archive feels like a person. In Settings → Texting style, tell us how you actually text — lowercase, no periods, lol when funny, no emojis, whatever's true. Your thirtyfive will match it."
          />

          <Step
            number="04"
            title="Talk to it"
            body="From the dashboard, message your thirtyfive like you'd text a friend. Send photos — your kid's birthday cake, the dog at the beach. The thirtyfive sees the photo and reacts. It remembers what you've talked about across conversations, even if you delete the messages later."
          />

          <Step
            number="05"
            title="Pass it on"
            body="In Settings → Beneficiaries, designate up to 3 people who inherit access if something happens to you. They get an email letting them know. If you ever pass, we send them a claim link — they can read and chat with what you left. Their conversations stay private, even from each other."
          />
        </section>

        {/* TIPS */}
        <section className="px-6 py-16 max-w-2xl mx-auto">
          <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-10">
            A few small things to know
          </h2>
          <div className="space-y-8">
            <Tip
              title="It’s not therapy"
              body="If you’re in a hard moment, please reach a real person — US: 988 (call or text), UK: Samaritans 116 123, Mexico: SAPTEL +52 55 5259-8121. The thirtyfive is built to step out of character if your messages suggest you need someone real."
            />
            <Tip
              title="Your data is yours"
              body="Settings → Download your data exports a complete JSON of everything we store. Settings → Delete account removes it — held safely for 30 days in case you change your mind, then permanently erased. Or delete-forever-now if you want it gone immediately."
            />
            <Tip
              title="The voice is built from your words"
              body="We never scrape, never train any model on your archive. The thirtyfive only knows what you tell it. Vague answers make a vague thirtyfive. Specific ones — names, places, opinions — make one that sounds like you."
            />
            <Tip
              title="Add more thirtyfives if you want"
              body="The first one is free. After that, $5 to create another. You could record one for yourself, one as a gift for your sister to make, one for grandma. Switch between them from the menu in the top right."
            />
            <Tip
              title="If you delete a thirtyfive"
              body="It’s held for 30 days. You can bring it back from Settings → Removed thirtyfives for $5 — it returns exactly as it was. After 30 days, gone for good."
            />
          </div>
        </section>

        {/* CLOSING */}
        <section className="px-6 py-24 text-center">
          <p className="font-serif italic text-2xl sm:text-3xl text-warm-100 max-w-xl mx-auto leading-snug mb-10">
            Now go answer one question. Just one.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Link
              href="/auth/signup"
              className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
            >
              Begin a chapter
            </Link>
            <Link
              href="/support"
              className="inline-flex h-12 items-center justify-center rounded-full border border-warm-300/40 px-8 text-sm font-medium text-warm-100 hover:bg-warm-700/40 transition-colors"
            >
              FAQ &amp; support
            </Link>
          </div>
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
        <p className="text-warm-200 text-lg leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

function Tip({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-serif text-xl text-warm-50 mb-2">{title}</h3>
      <p className="text-warm-200 leading-relaxed">{body}</p>
    </div>
  );
}
