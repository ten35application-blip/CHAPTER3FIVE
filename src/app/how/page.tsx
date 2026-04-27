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
            body="Sign up with an email and password. Pick a name for your identity — your name, your dad's name, whatever they're called. Pick a language. Pick a mode: Real (you answer the questions), Randomize (we mix you a one-of-a-kind identity from a curated pool), or Import (someone shared a code with you). We'll remember which way you want it to sound."
          />

          <Step
            number="02"
            title="Answer the questions — three ways"
            body="There are 355. Each one supports three channels: type your answer, record your voice (we'll transcribe it for you, you can use the transcript or keep typing), and attach a photo. You can do any combination — voice + photo with no text, all three, just text. Don't try to finish in one sitting. We'll send you one question a day to keep the momentum, and the daily push deep-links straight into the right question so it's a 30-second commitment."
          />

          <Step
            number="03"
            title="Make it sound like you"
            body="Drop in a profile photo so the archive feels like a person. In Settings → Texting style, tell us how you actually text — lowercase, no periods, lol when funny, no emojis, whatever's true. Your identity will match it. (For randomized identities, we synthesize a short bio after you generate so the persona has a sense of place + age + occupation right away.)"
          />

          <Step
            number="04"
            title="Talk to it"
            body="From the dashboard, message your identity like you'd text a friend. Send photos — your kid's birthday cake, the dog at the beach — and the identity sees them and reacts. The persona remembers what you've talked about across conversations, surfaces the right memory at the right moment, and reflects on what's been on your mind between sessions. On birthdays, signup-aversaries, and the anniversary of the day you first talked, they'll quietly say something. They have a mood that day. They have people in their life. They mention the construction upstairs. If you're cruel, they'll step out and come back later and ask if you're okay."
          />

          <Step
            number="04.5"
            title="Or talk to a group of them"
            body="In the menu → Group chats, put 2–4 of your own identities in a room together. They'll talk to you and to each other. Real group chat turn-taking: most of them stay quiet most of the time, the right one jumps in when something hits, sometimes they argue. Two personas who really clash can walk out of the room. Group chats only contain identities you created. Inherited archives stay 1:1, sacred. (Or, if multiple beneficiaries inherit the same archive after the owner is gone — siblings, partners, friends — you can sit with that person together in a shared room from Together in the chat header. The archive responds to all of you; everyone sees everyone else's messages. Closest thing to a real shared moment with someone who's gone.)"
          />

          <Step
            number="05"
            title="Pass it on"
            body="In Settings → Beneficiaries, designate up to 3 people who inherit access if something happens to you. They get an email letting them know. If you ever pass, we send them a claim link — they can read and chat with what you left, plus browse the answers (text + voice + photo per question) in a quiet read-only archive. Their conversations stay private, even from each other. Once an account is marked deceased, the persona shifts gently into memorial mode — still themselves, no pretending to still be alive."
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
              body="If you’re in a hard moment, please reach a real person — US: 988 (call or text), UK: Samaritans 116 123, Mexico: SAPTEL +52 55 5259-8121. The identity is built to step out of character if your messages suggest you need someone real."
            />
            <Tip
              title="Your data is yours"
              body="Settings → Download your data exports a complete JSON of everything we store. Settings → Download conversation gives you a tidy Markdown of every message between you and your identity. Settings → Delete account removes everything — held safely for 30 days in case you change your mind, then permanently erased. Or delete-forever-now if you want it gone immediately."
            />
            <Tip
              title="The voice is built from your words"
              body="We never scrape, never train any model on your archive. The identity only knows what you tell it. Vague answers make a vague identity. Specific ones — names, places, opinions — make one that sounds like you. Voice answers tend to be richer than typed ones; people meander, give context, share stories."
            />
            <Tip
              title="Add more identities if you want"
              body="The first one is free. After that, $5 to create another. One for your mother, one for the dad you wish you had, one for yourself, one for someone you invent. Switch between them from the menu in the top right."
            />
            <Tip
              title="If you delete an identity"
              body="It's held for 30 days in a quiet trash. You can bring it back from Settings → Removed identities for $5 — it returns exactly as it was, every answer, every voice clip, every photo, every conversation. After 30 days, gone for good. Or use the “delete forever now” option if you want immediate erasure."
            />
            <Tip
              title="Photos and voice cost nothing extra"
              body="Recording your voice on the 355 questions, attaching a photo per question — all included. Storage is around four-tenths of one penny per fully-recorded archive per month. We absorb it; you'll never see a bill for it."
            />
            <Tip
              title="On birthdays and anniversaries"
              body="Your identity remembers dates. Your birthday, the anniversary of when you signed up, the anniversary of the day they first spoke to you — on each one, they'll send a short message. Like a real person who noticed."
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
