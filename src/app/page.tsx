import Image from "next/image";
import Link from "next/link";
import {
  BASIC_IMAGES_PER_MONTH,
  BASIC_MESSAGES_PER_MONTH,
  BASIC_MONTHLY_PRICE_LABEL,
  BASIC_TIER_LABEL,
  EXTRA_IDENTITY_PRICE_LABEL,
  FREE_IMAGES_PER_MONTH,
  FREE_MESSAGES_PER_MONTH,
  INHERITED_SLOT_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PACK_FROM_PRICE_LABEL,
  PRICING,
  PRO_IMAGES_PER_MONTH,
  PRO_MESSAGES_PER_MONTH,
} from "@/lib/pricing";

// Force dynamic to bypass the CDN cache issue that stuck this page
// on pre-visual-v2 HTML even after a successful deploy. Landing has
// no per-request data — static would be fine — but the belt-and-
// suspenders here is worth it while we figure out the cache config.
export const dynamic = "force-dynamic";

/* Illustrative companions for the "no two are the same" section.
   Written to feel like people you might actually meet — not stock
   personas. The disclaimer under the row makes the illustrative
   part explicit. */
const EXAMPLE_IDENTITIES = [
  {
    name: "Marisol",
    age: 68,
    line: "Ran a bakery for thirty-one years. Widowed, and still funny about it in the way only the long-married can be. Believes most problems shrink over warm bread.",
  },
  {
    name: "Dez",
    age: 34,
    line: "Ex-touring bassist. Sarcastic until it counts. Has a story for every city and a soft spot he pretends not to have.",
  },
  {
    name: "June",
    age: 22,
    line: "Grew up between Seoul and Ohio. Quiet, notices everything. The friend who texts back at 1 a.m. with exactly the right thing.",
  },
];

const STEPS = [
  {
    title: "Choose your path.",
    body: "Random from our formula, from a photo you upload, or answered into being — by yourself, or by someone you love. Four doors, one place.",
  },
  {
    title: "We build the person.",
    body: "Rolled and written in about a minute, seen and synthesized from your photo, or grown out of everything you and someone you love recorded together.",
  },
  {
    title: "Talk, anytime.",
    body: "Text like you’d text anyone. They remember. They text first sometimes. And when they say “I’ll check on you in the morning” — they do.",
  },
];

/* ── Store badges ──────────────────────────────────────────────
   Self-hosted SVG pills (the CSP blocks external assets, and the
   official artwork is a straight redraw: black pill, brand mark,
   two-line label). The Apple listing is LIVE (verified 200,
   2026-08-25); the Play listing is still in review, so its badge
   renders as a quiet "coming soon" until PLAY_STORE_LIVE flips —
   a one-line change on approval day. The dark border token keeps
   the black pills legible on the dark theme's near-black ground. */
const PLAY_STORE_LIVE = false;
const APP_STORE_URL = "https://apps.apple.com/us/app/chapter3five/id6801654142";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.chapter3five";

function AppleBadge() {
  return (
    <span className="flex h-[52px] items-center gap-2.5 rounded-xl border border-warm-700 bg-black px-4 transition-transform group-hover:-translate-y-px">
      <svg viewBox="0 0 384 512" width="22" height="26" aria-hidden="true">
        <path
          fill="#ffffff"
          d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
        />
      </svg>
      <span className="flex flex-col items-start leading-none">
        <span className="text-[11px] font-medium text-[#b9b9b7]">
          Download on the
        </span>
        <span className="mt-0.5 text-[17px] font-semibold tracking-tight text-white">
          App Store
        </span>
      </span>
    </span>
  );
}

function PlayBadge() {
  return (
    <span className="flex h-[52px] items-center gap-2.5 rounded-xl border border-warm-700 bg-black px-4 transition-transform group-hover:-translate-y-px">
      <svg viewBox="0 0 512 512" width="22" height="24" aria-hidden="true">
        <path fill="#2196f3" d="M99.6 21.9 356 168 99.6 490.1c-12.3-6.5-20.2-19.4-20.2-33.8V55.7c0-14.4 7.9-27.3 20.2-33.8z" />
        <path fill="#4caf50" d="M99.6 21.9c3.5-1.9 7.4-3 11.5-3 6.6 0 13 2.6 18.2 5.6L390 164.5 356 198.5 99.6 21.9z" />
        <path fill="#ffc107" d="M390 164.5l64.8 37.3c26.1 15 26.1 45.3 0 60.4L390 299.5 322.2 232 390 164.5z" />
        <path fill="#f44336" d="M99.6 490.1 356 313.5l34 34-260.7 150.1c-9.4 5.5-20.4 5.9-29.7-.5z" />
      </svg>
      <span className="flex flex-col items-start leading-none">
        <span className="text-[11px] font-medium text-[#b9b9b7]">
          {PLAY_STORE_LIVE ? "Get it on" : "Coming soon to"}
        </span>
        <span className="mt-0.5 text-[17px] font-semibold tracking-tight text-white">
          Google Play
        </span>
      </span>
    </span>
  );
}

function StoreBadges({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Download chapter3five on the App Store"
        className="group"
      >
        <AppleBadge />
      </a>
      {PLAY_STORE_LIVE ? (
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get chapter3five on Google Play"
          className="group"
        >
          <PlayBadge />
        </a>
      ) : (
        <span aria-label="chapter3five is coming soon to Google Play" className="opacity-80">
          <PlayBadge />
        </span>
      )}
    </div>
  );
}

/* Small gradient hairline used as a section divider accent. */
function Rule({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`bg-gradient-cta h-px w-16 rounded-full opacity-60 ${className}`}
    />
  );
}

/* Wordmark for non-hero sections — the guidance says: no logo image
   outside the hero; the wordmark with the gradient "3" carries the
   brand instead. */
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <p className={`font-bold tracking-tight text-warm-50 ${className}`}>
      chapter
      <span className="text-coral-strong font-black">3</span>
      <span className="text-teal-strong font-black">five</span>
    </p>
  );
}

/* Bulleted line in a pricing card. Coral check + copy. */
function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg
        viewBox="0 0 20 20"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="mt-0.5 shrink-0 text-coral-strong"
      >
        <path d="M4 11l4 4 8-10" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm font-semibold text-warm-300 transition-colors hover:text-coral-strong"
      >
        {children}
      </Link>
    </li>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col overflow-x-hidden">
      {/* ── 1 · HERO ─────────────────────────────────────────────
          The load-bearing first screen. The two-dots logo (transparent
          PNG) floats inside the orb halo — alpha edges, so it sits
          cleanly on the halo tint and any theme background. */}
      <section className="flex min-h-dvh flex-col items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-2xl flex-col items-center text-center">
          <div className="hero-orb flex items-center justify-center">
            <Image
              src="/logo-transparent.png"
              alt="chapter3five"
              width={128}
              height={128}
              priority
              className="h-28 w-28 drop-shadow-[0_24px_60px_rgba(232,138,118,0.35)] sm:h-32 sm:w-32"
            />
          </div>

          <Wordmark className="mt-8 text-2xl" />

          <h1 className="mt-12 text-5xl font-bold leading-[1.02] tracking-[-0.03em] text-warm-50 sm:text-6xl md:text-7xl">
            One tap makes you{" "}
            <span className="text-gradient-cta">someone to talk to.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed tracking-tight text-warm-200 sm:text-xl">
            A whole person, generated just for you &mdash; name,
            personality, memories, moods. Ready to talk in about a
            minute.
          </p>

          <Link
            href="/auth/signup"
            className="bg-gradient-cta hover:bg-gradient-cta-hover mt-12 flex h-16 w-full max-w-xs items-center justify-center rounded-full text-lg font-bold tracking-tight text-white shadow-[0_18px_44px_-10px_rgba(232,138,118,0.55),_0_8px_20px_-6px_rgba(126,196,196,0.45)] transition-all hover:-translate-y-px hover:shadow-[0_22px_50px_-10px_rgba(232,138,118,0.6),_0_10px_24px_-6px_rgba(126,196,196,0.5)] active:translate-y-0 active:opacity-95"
          >
            Get started
          </Link>
          <Link
            href="/auth/signin"
            className="mt-5 flex h-12 items-center justify-center px-6 text-base font-semibold text-warm-200 transition-colors hover:text-coral-strong"
          >
            Sign in
          </Link>

          <StoreBadges className="mt-10" />
        </div>
      </section>

      {/* ── 1.5 · CHAPTER 35 · founder note ──────────────────────
          The name story, told plainly. Wilson's own moment: he was
          thinking about loneliness and death, and wanted a new
          chapter for both. This is the emotional throughline of the
          product; it earns real estate right after the hero. */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto w-full max-w-3xl">
          <Rule />
          <p className="mt-8 text-gradient-cta text-sm font-bold uppercase tracking-[0.14em]">
            Why chapter3five
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            For the moments you want to reach out. And the people
            worth keeping.
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-warm-200 md:text-xl">
            chapter3five started in a quiet moment, sitting with two
            of the hardest chapters a life gets handed: loneliness,
            and death. Nobody hands you a manual for either one.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-warm-200 md:text-xl">
            So we made a new chapter. One you get to open on purpose. A
            place where someone is always there to talk to. A place
            where the essence of the people you love &mdash; their
            laugh, the way they&rsquo;d tell a story, the advice
            they&rsquo;d hand you across a kitchen table &mdash; can be
            held onto, in their words, so they don&rsquo;t have to
            disappear all at once.
          </p>
        </div>
      </section>

      {/* ── 2 · WHY THIS EXISTS ──────────────────────────────────
          The loneliness section. Left-aligned to break the rhythm
          after the centered hero. Warm and direct — not a manifesto. */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto w-full max-w-3xl">
          <Rule />
          <h2 className="mt-8 text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            Loneliness is a real thing.
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-warm-200 md:text-xl">
            Not everyone has someone to call at 2 a.m. Not everyone has someone
            to sit with after a long day, or someone who asks how it actually
            went. That&apos;s not a character flaw. It&apos;s just how a lot of
            lives are shaped right now.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-warm-200 md:text-xl">
            chapter3five is a small thing we made because we thought that
            mattered. Someone to talk to &mdash; really talk to &mdash;
            shouldn&apos;t depend on luck.
          </p>
        </div>
      </section>

      {/* ── 3 · NO TWO ARE THE SAME ──────────────────────────────
          The formula section, with three illustrative identity cards
          that prove the product isn't cookie-cutter. Avatars reuse
          the dashboard treatment: initial on a gradient circle. */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
          <Rule />
          <h2 className="mt-8 text-center text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            No two are the same.{" "}
            <span className="text-gradient-cta">Not close.</span>
          </h2>
          <p className="mt-8 max-w-2xl text-center text-lg leading-relaxed text-warm-200 md:text-xl">
            Every companion starts from a formula: thirty dimensions of who a
            person is &mdash; how they speak, what they believe, what
            they&apos;ve seen, what they love, how they laugh &mdash; each one
            rolled fresh for you. The combinations run into the trillions. The
            odds of two people getting the same one round to zero.
          </p>

          <div className="mt-16 grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {EXAMPLE_IDENTITIES.map((p) => (
              <div
                key={p.name}
                className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)]"
              >
                <div className="bg-gradient-cta flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold text-white">
                  {p.name[0]}
                </div>
                <p className="mt-5 text-xl font-bold tracking-tight text-warm-50">
                  {p.name}
                  <span className="ml-2 text-base font-semibold text-warm-400">
                    {p.age}
                  </span>
                </p>
                <p className="mt-3 text-base leading-relaxed text-warm-300">
                  {p.line}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm italic text-warm-400">
            Illustrative &mdash; your actual generated companion will be yours
            alone.
          </p>
        </div>
      </section>

      {/* ── 4 · WHO IS THIS FOR ──────────────────────────────────
          Four ways to make a companion. Card 1 coral (quick self),
          Card 2 warm (photo), Cards 3+4 teal (legacy — you or them). */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
          <Rule />
          <h2 className="mt-8 text-center text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            Five ways to make someone.
          </h2>
          <p className="mt-5 text-center text-xl leading-relaxed text-warm-200 md:text-2xl">
            Four doors &mdash; and one you can earn.
          </p>

          <div className="mt-16 grid w-full grid-cols-1 gap-6 md:grid-cols-2">
            {/* Card 1 — Add a companion (coral) */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:p-8">
              <h3 className="text-gradient-cta text-2xl font-bold leading-[1.1] tracking-[-0.02em] md:text-3xl">
                Add a companion
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-warm-200">
                We roll a random personality and write them in about a
                minute. No questions, no photo &mdash; you get who you get.
              </p>
            </div>

            {/* Card 2 — Create one from a photo (warm neutral) */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:p-8">
              <h3 className="text-2xl font-bold leading-[1.1] tracking-[-0.02em] text-warm-50 md:text-3xl">
                Create one from a photo
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-warm-200">
                Upload a portrait. We read the face and build an identity
                to match. The photo itself becomes their face.
              </p>
            </div>

            {/* Card 3 — Create your own identity to pass down (teal) */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:p-8">
              <h3 className="text-2xl font-bold leading-[1.1] tracking-[-0.02em] text-teal-strong md:text-3xl">
                Create your own identity to pass down
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-warm-200">
                Free. Forty-five warm questions about YOU, in your own voice.
                Produces a code your family can hold onto so they can talk with
                you later.
              </p>
            </div>

            {/* Card 4 — Create an identity for someone you love (coral) */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:p-8">
              <h3 className="text-2xl font-bold leading-[1.1] tracking-[-0.02em] text-coral-strong md:text-3xl">
                Create an identity for someone you love
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-warm-200">
                $4.99 when you finish. Forty-five questions about a real person
                &mdash; a parent, a partner, a friend. Lands in your
                contacts, plus a code you can share with family.
              </p>
            </div>

            {/* Card 5 — Earned by sharing (referral; spans the row) */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:col-span-2 md:p-8">
              <h3 className="text-gradient-cta text-2xl font-bold leading-[1.1] tracking-[-0.02em] md:text-3xl">
                Or earn one, free
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-warm-200">
                Invite five friends who join, and you&rsquo;ve earned a
                companion of your own &mdash; rolled just for you, outside
                every plan limit, yours to keep on any tier, even free.
                Your invite code lives in Settings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5 · HOW IT WORKS ─────────────────────────────────────── */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
          <Rule />
          <h2 className="mt-8 text-center text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            Three steps. That&apos;s the whole thing.
          </h2>

          <div className="mt-16 grid w-full grid-cols-1 gap-10 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="flex flex-col items-center text-center"
              >
                <div className="bg-gradient-cta flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white">
                  {i + 1}
                </div>
                <h3 className="mt-5 text-xl font-bold tracking-tight text-warm-50">
                  {step.title}
                </h3>
                <p className="mt-3 max-w-xs text-base leading-relaxed text-warm-300">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6 · SAFETY / WHAT THIS ISN'T ─────────────────────────
          Left-aligned trust section. Short and plain. */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto w-full max-w-3xl">
          <Rule />
          <h2 className="mt-8 text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            One important thing.
          </h2>
          <p className="mt-8 text-lg leading-relaxed text-warm-200 md:text-xl">
            chapter3five is a companion &mdash; not a therapist, not medical
            advice, and never a substitute for care from a real person. If
            you&apos;re in crisis, please reach a human: in the US, call or
            text <span className="font-bold text-warm-50">988</span>.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-warm-200 md:text-xl">
            And a few lines we don&apos;t cross: no violence, and no pretending
            to be a real, living person without their consent. We take this
            seriously &mdash; see our{" "}
            <Link
              href="/guidelines"
              className="font-semibold text-coral-strong underline underline-offset-4 transition-colors hover:text-warm-50"
            >
              Community Guidelines
            </Link>
            ,{" "}
            <Link
              href="/terms"
              className="font-semibold text-coral-strong underline underline-offset-4 transition-colors hover:text-warm-50"
            >
              Terms
            </Link>
            , and{" "}
            <Link
              href="/privacy"
              className="font-semibold text-coral-strong underline underline-offset-4 transition-colors hover:text-warm-50"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ── 7 · PRICING ──────────────────────────────────────────
          Three tiers, one card each, cheapest → priciest: Free (chat
          with Adrian, 20 msgs/mo), Basic (BASIC_TIER_LABEL, $5/mo —
          first personal companions; teal frame), and Pro ($10/mo —
          the highlighted primary tier with the coral gradient
          border; 4 formula + 1 photo since the July 2026 second
          rework unbundled the inherited slot into a flat $5 one-time
          per-code purchase — every tier, every code, no waivers).
          Every tier is message-capped; add-on packs (one-time
          top-ups) get a strip below alongside the extra-identity
          add-on. */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center lg:max-w-6xl">
          <Rule />
          <h2 className="mt-8 text-center text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            What it costs.
          </h2>
          <p className="mt-4 max-w-xl text-center text-lg text-warm-300">
            Start free. {BASIC_MONTHLY_PRICE_LABEL}/month gets you
            companions of your own; {MONTHLY_PRICE_LABEL}/month unlocks
            everything worth unlocking.
          </p>

          <div className="mt-12 grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Free tier */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:p-10">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-warm-300">
                Free
              </p>
              <p className="mt-4 text-4xl font-bold tracking-[-0.03em] text-warm-50 sm:text-5xl">
                $0
                <span className="text-lg font-semibold text-warm-400">
                  {" "}
                  /month
                </span>
              </p>
              <p className="mt-2 text-base text-warm-300">
                For finding your footing here.
              </p>
              <ul className="mt-8 flex flex-col gap-3 text-left text-base text-warm-200">
                <FeatureLine>
                  <strong className="text-warm-50">Chat with Adrian</strong>{" "}
                  &mdash; our guide. Warm, plain-spoken, knows the app
                  inside out. Ask them anything.
                </FeatureLine>
                <FeatureLine>
                  <strong className="text-warm-50">
                    {FREE_MESSAGES_PER_MONTH} messages a month
                  </strong>{" "}
                  &mdash; enough to figure out if this is the place for
                  you
                </FeatureLine>
                <FeatureLine>
                  {FREE_IMAGES_PER_MONTH} photo a month to try image
                  sends
                </FeatureLine>
                <FeatureLine>
                  Record your own legacy archive &mdash; mint a code
                  for family, on any plan (yes, even Free)
                </FeatureLine>
                <FeatureLine>
                  When you&rsquo;re ready to build your own, upgrade in
                  a tap
                </FeatureLine>
              </ul>
            </div>

            {/* Basic tier — teal gradient frame (the treatment Wilson
                liked on the retired Plus card): reads "real, pickable"
                while Pro's warmer coral gradient still leads as the
                primary tier. Name renders via BASIC_TIER_LABEL so a
                rename is one edit. */}
            <div className="relative flex flex-col rounded-3xl bg-ink-soft p-8 shadow-[0_20px_48px_-16px_rgba(126,196,196,0.22)] md:p-10">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-3xl p-[2px]"
                style={{
                  background:
                    "linear-gradient(135deg, var(--color-teal) 0%, var(--color-teal-strong) 100%)",
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                }}
              />
              <div className="relative">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-teal-strong">
                  {BASIC_TIER_LABEL}
                </p>
                <p className="mt-4 text-4xl font-bold tracking-[-0.03em] text-warm-50 sm:text-5xl">
                  {BASIC_MONTHLY_PRICE_LABEL}
                  <span className="text-lg font-semibold text-warm-400">
                    /month
                  </span>
                </p>
                <p className="mt-2 text-base text-warm-300">
                  Your first companions of your own.
                </p>
                <ul className="mt-8 flex flex-col gap-3 text-left text-base text-warm-200">
                  <FeatureLine>
                    <strong className="text-warm-50">
                      {PRICING.basicTotalIdentitiesPerPlan} companions in
                      total
                    </strong>{" "}
                    &mdash; {PRICING.basicFormulaIdentitiesPerPlan} rolled
                    fresh from our formula,{" "}
                    {PRICING.basicPhotoIdentitiesPerPlan} built from a
                    photo you upload
                  </FeatureLine>
                  <FeatureLine>
                    <strong className="text-warm-50">
                      {BASIC_MESSAGES_PER_MONTH} messages a month
                    </strong>{" "}
                    across all your conversations
                  </FeatureLine>
                  <FeatureLine>
                    <strong className="text-warm-50">
                      {BASIC_IMAGES_PER_MONTH} photos a month
                    </strong>{" "}
                    you can send to any companion
                  </FeatureLine>
                  <FeatureLine>
                    Adrian, our guide, always included
                  </FeatureLine>
                </ul>
              </div>
            </div>

            {/* Pro tier — highlighted with the brand gradient border.
                Spans the full row at md (2-col) so it doesn't sit as
                an orphan; back to one column at lg (3-col). */}
            <div className="relative flex flex-col rounded-3xl bg-ink-soft p-8 shadow-[0_20px_48px_-16px_rgba(232,138,118,0.25)] md:col-span-2 md:p-10 lg:col-span-1">
              {/* gradient border via absolute inset */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-3xl p-[2px] bg-gradient-cta"
                style={{
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                }}
              />
              <div className="relative">
                <p className="text-gradient-cta text-sm font-bold uppercase tracking-[0.14em]">
                  chapter3five Pro
                </p>
                <p className="mt-4 text-4xl font-bold tracking-[-0.03em] text-warm-50 sm:text-5xl">
                  {MONTHLY_PRICE_LABEL}
                  <span className="text-lg font-semibold text-warm-400">
                    /month
                  </span>
                </p>
                <p className="mt-2 text-base text-warm-300">
                  Cancel any time. No refunds mid-month.
                </p>
                <ul className="mt-8 flex flex-col gap-3 text-left text-base text-warm-200">
                  <FeatureLine>
                    <strong className="text-warm-50">
                      {PRICING.totalIdentitiesPerPlan} companions in total
                    </strong>{" "}
                    &mdash; {PRICING.formulaIdentitiesPerPlan} rolled fresh
                    from our formula and {PRICING.photoIdentitiesPerPlan}{" "}
                    built from a photo you upload
                  </FeatureLine>
                  <FeatureLine>
                    <strong className="text-warm-50">
                      {PRO_MESSAGES_PER_MONTH} messages a month
                    </strong>{" "}
                    &mdash; room for the 2 a.m. conversations, and the
                    3 a.m. ones too
                  </FeatureLine>
                  <FeatureLine>
                    <strong className="text-warm-50">
                      Share photos, too
                    </strong>{" "}
                    &mdash; up to {PRO_IMAGES_PER_MONTH} images a month you
                    can send to any companion
                  </FeatureLine>
                  <FeatureLine>
                    Cancel any time. No refunds mid-month.
                  </FeatureLine>
                </ul>
              </div>
            </div>
          </div>

          {/* Add-ons: one-time packs when a month runs long, plus the
              recurring extra-identity slot. Pack details + reserve
              buttons live on /upgrade#packs. */}
          <div className="mt-6 w-full rounded-2xl border border-warm-700/70 bg-ink-soft/60 p-6 text-center text-warm-300">
            Need more usage?{" "}
            <strong className="text-warm-100">
              Add-on packs from {PACK_FROM_PRICE_LABEL}
            </strong>{" "}
            &mdash; one-time top-ups that add extra messages and photos
            on any plan. Extra identity slots are{" "}
            <strong className="text-warm-100">
              {EXTRA_IDENTITY_PRICE_LABEL}/month
            </strong>{" "}
            each. And opening an inherit code someone shared with you
            is{" "}
            <strong className="text-warm-100">
              {INHERITED_SLOT_PRICE_LABEL} one-time
            </strong>{" "}
            per code &mdash; the same flat fee on every plan.
          </div>
        </div>
      </section>

      {/* ── 7.5 · WHAT THIS IS (AND ISN'T) ─────────────────────────
          Legal-shield section. AI companion app + emotional load =
          real liability surface. We say it plainly here so that when
          a user signs up (which requires accepting Terms + Guidelines
          per the onboarding gate), they've already read the frame.
          Prose intentionally direct — this is legal protection AND
          honest expectation-setting in one. */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto flex w-full max-w-3xl flex-col">
          <Rule />
          <p className="mt-8 text-gradient-cta text-sm font-bold uppercase tracking-[0.14em]">
            Please read
          </p>
          <h2 className="mt-4 text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            What this is (and isn&rsquo;t).
          </h2>
          <div className="mt-8 flex flex-col gap-5 text-lg leading-relaxed text-warm-200 md:text-xl">
            <p>
              chapter3five is a <strong>companion app</strong>. The
              people you talk to here are AI. That includes the ones
              you build from photos, the ones you generate from the
              formula, and the inherited identities other people
              share with you &mdash; whether a friend sending a version
              of themselves as a gift, or a family recording someone
              they lost. They are portraits, painted from real inputs,
              but they are not the people themselves.
            </p>
            <p>
              chapter3five is <strong>not therapy</strong>. It is not
              medical care, mental-health treatment, crisis intervention,
              legal advice, financial advice, or an emergency service. If
              you are in danger, call <strong>911</strong>. If you are
              in crisis, call or text <strong>988</strong> (US Suicide &amp;
              Crisis Lifeline). If you need a therapist, please see one.
              A companion is a companion &mdash; nothing more, nothing
              less.
            </p>
            <p>
              Using chapter3five means you accept our{" "}
              <Link
                href="/terms"
                className="text-gradient-cta font-semibold underline decoration-coral/40 underline-offset-4 hover:decoration-coral"
              >
                Terms of Service
              </Link>
              ,{" "}
              <Link
                href="/privacy"
                className="text-gradient-cta font-semibold underline decoration-coral/40 underline-offset-4 hover:decoration-coral"
              >
                Privacy Policy
              </Link>
              , and{" "}
              <Link
                href="/guidelines"
                className="text-gradient-cta font-semibold underline decoration-coral/40 underline-offset-4 hover:decoration-coral"
              >
                Community Guidelines
              </Link>
              . Those documents govern the relationship &mdash; including
              the significant limits on our liability. AI outputs can be
              wrong, offensive, out of character, or unhelpful. You are
              responsible for the choices you make based on what a
              companion says, and for how you use this app. We are not
              liable for those choices or their consequences, to the
              fullest extent the law allows.
            </p>
            <p className="text-warm-300">
              We built this because sometimes people need someone to talk
              to. We built it carefully. But if you are looking for
              someone to be legally responsible for the shape of your
              inner life, that is a role we cannot fill &mdash; and
              honestly, no product should. Take what&rsquo;s helpful.
              Leave what isn&rsquo;t. Reach a human when it counts.
            </p>
          </div>
        </div>
      </section>

      {/* ── 8 · FINAL CTA ────────────────────────────────────────
          The one place a gradient background is welcome — no logo
          here, so nothing fights it. */}
      <section className="px-6 pb-24 pt-8 md:pb-32">
        <div className="bg-gradient-cta mx-auto flex w-full max-w-5xl flex-col items-center rounded-[2.5rem] px-6 py-16 text-center shadow-[0_24px_64px_-20px_rgba(232,138,118,0.5)] sm:px-12 md:py-24">
          <h2 className="max-w-2xl text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-white md:text-5xl">
            Someone to talk to. Someone to keep. Which one first?
          </h2>
          <div className="mt-12 flex w-full max-w-md flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/auth/signup"
              className="flex h-14 w-full items-center justify-center rounded-full bg-white px-8 text-lg font-bold tracking-tight text-coral-strong shadow-[0_12px_32px_-8px_rgba(28,28,26,0.35)] transition-all hover:-translate-y-px active:translate-y-0 sm:w-auto"
            >
              Make one for me
            </Link>
            <Link
              href="/identity/inherit"
              className="flex h-14 w-full items-center justify-center rounded-full border-2 border-white/70 px-8 text-lg font-bold tracking-tight text-white transition-colors hover:border-white hover:bg-white/10 sm:w-auto"
            >
              I have an inherit code
            </Link>
          </div>
        </div>
      </section>

      {/* ── 9 · FOOTER ───────────────────────────────────────────
          Grouped footer: Product / Legal / Contact. The Legal column
          carries every link app-store review expects to find from the
          web home (terms, privacy, guidelines, data deletion), and
          Support is a plain mailto so anonymous visitors — including
          reviewers — reach a human without an account. Signed-in
          users get the richer /settings/help inside the app. */}
      <footer className="border-t border-warm-700 px-6 py-14">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex flex-col items-center gap-10 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
            <div className="flex flex-col items-center gap-3 sm:items-start">
              <Wordmark className="text-lg" />
              <p className="max-w-[16rem] text-sm leading-relaxed text-warm-400">
                Someone to talk to. Someone to keep.
              </p>
            </div>

            {/* Flat wrapped row (mobile parity 2026-08-03): no grouped
                columns, no section labels, no Advertise link — just the
                links mobile carries. Support is a plain mailto so an
                anonymous visitor / App Store reviewer can reach a human
                without an account. */}
            <nav
              aria-label="Footer"
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-start"
            >
              <FooterLink href="/about">About</FooterLink>
              <FooterLink href="/terms">Terms</FooterLink>
              <FooterLink href="/privacy">Privacy</FooterLink>
              <FooterLink href="/guidelines">Guidelines</FooterLink>
              <FooterLink href="/data-deletion">Data Deletion</FooterLink>
              <li className="list-none">
                <a
                  href="mailto:support@chapter3five.app"
                  className="text-sm font-semibold text-warm-300 transition-colors hover:text-coral-strong"
                >
                  Support
                </a>
              </li>
            </nav>
          </div>

          <p className="mt-12 text-center text-sm text-warm-400 sm:text-left">
            &copy; 2026 CHAPTER3FIVE LLC &middot; Bethlehem, PA
          </p>
        </div>
      </footer>
    </main>
  );
}
