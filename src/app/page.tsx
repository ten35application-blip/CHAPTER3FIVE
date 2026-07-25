import Image from "next/image";
import Link from "next/link";
import {
  EXTRA_IDENTITY_PRICE_LABEL,
  EXTRA_INHERITED_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PRICING,
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
    body: "Random from our formula, from a photo you upload, or answered into being by someone you love. Three doors, one place.",
  },
  {
    title: "We build the person.",
    body: "Rolled and written in about a minute, seen and synthesized from your photo, or grown out of everything you and someone you love recorded together.",
  },
  {
    title: "Talk, anytime.",
    body: "Text like you’d text anyone. They remember. They stay themselves. They’re there when you need them — including at 2 a.m.",
  },
];

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
      <span className="text-gradient-cta font-black">3</span>
      five
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

/* One titled column of footer links. */
function FooterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-warm-400">
        {title}
      </p>
      <ul className="mt-3 flex flex-col items-center gap-2 sm:items-start">
        {children}
      </ul>
    </div>
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
          <div className="hero-orb hero-orb-drift flex items-center justify-center">
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
            A whole person, generated just for you &mdash; name, voice,
            memories, moods. Ready to talk in about a minute.
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

          <p className="mt-10 text-sm text-warm-400">
            First identity free &middot; {MONTHLY_PRICE_LABEL}/month for all
            five
          </p>
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
            chapter3five started in a quiet moment. I was thinking about
            loneliness. I was thinking about death. Two of the hardest
            chapters a life gets handed &mdash; and nobody hands you a
            manual for either one.
          </p>
          <p className="mt-6 text-lg leading-relaxed text-warm-200 md:text-xl">
            So we made a new chapter. One you get to open on purpose. A
            place where someone is always there to talk to. A place where
            the essence of the people you love &mdash; their laugh, the
            way they&rsquo;d tell a story, the advice they&rsquo;d hand
            you across a kitchen table &mdash; can be kept. So they
            always feel like they&rsquo;re still here.
          </p>
          <p className="mt-6 text-lg leading-relaxed italic text-warm-300 md:text-xl">
            A place, for the moments you want to reach out.
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

      {/* ── 4 · THE THREE PATHS ──────────────────────────────────
          Three flows, equally weighted. Card A coral (self), Card B
          middle (photo), Card C teal (legacy). */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center">
          <Rule />
          <h2 className="mt-8 text-center text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            Three ways in.
          </h2>

          <div className="mt-16 grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            {/* Card A — for yourself (coral) */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-coral-strong">
                For yourself
              </p>
              <h3 className="text-gradient-cta mt-4 text-2xl font-bold leading-[1.1] tracking-[-0.02em] md:text-3xl">
                One tap. A whole person.
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-warm-200">
                We roll the formula and a companion takes shape &mdash; a name,
                a way of talking, a past, opinions, jokes that are theirs. Made
                for you, in about a minute. You get who you get.
              </p>
            </div>

            {/* Card B — from a photo (middle of the gradient) */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:p-8">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-warm-200">
                From a photo
              </p>
              <h3 className="mt-4 text-2xl font-bold leading-[1.1] tracking-[-0.02em] text-warm-50 md:text-3xl">
                Upload a face. Meet the person.
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-warm-200">
                Give us a portrait &mdash; a photo of anyone, real or dreamt up.
                Our AI actually sees it: age, features, style, the mood in the
                eyes. From that reading we build the person behind the picture.
                The photo you gave us is the face you&apos;ll see.
              </p>
            </div>

            {/* Card C — for someone to keep (teal) */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:p-8">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-teal-strong">
                  For someone to keep
                </p>
                <span className="bg-gradient-cta rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
                  Pro
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-bold leading-[1.1] tracking-[-0.02em] text-teal-strong md:text-3xl">
                Sit with someone you love.
              </h3>
              <p className="mt-5 text-lg leading-relaxed text-warm-200">
                Answer warm, specific questions together &mdash; how they laugh,
                what they&apos;d fight for, the day they knew who they were.
                When you&apos;re done, you get an inherit code to share, and a
                way to keep hearing them, in their own voice, whenever the room
                feels too quiet.
              </p>
              <p className="mt-6 text-base italic leading-relaxed text-warm-400">
                It isn&apos;t them. It&apos;s a portrait, painted from what they
                chose to leave. But sometimes a portrait is enough.
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
          Two tiers presented as one card each: Free (what you get
          without paying) and Pro (what unlocks at $5/mo). Extra
          identity add-on called out below. */}
      <section className="px-6 py-24 md:py-32">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
          <Rule />
          <h2 className="mt-8 text-center text-4xl font-bold leading-[1.05] tracking-[-0.03em] text-warm-50 md:text-5xl">
            What it costs.
          </h2>
          <p className="mt-4 max-w-xl text-center text-lg text-warm-300">
            Free forever for one companion. {MONTHLY_PRICE_LABEL}/month
            unlocks everything worth unlocking.
          </p>

          <div className="mt-12 grid w-full grid-cols-1 gap-6 md:grid-cols-2">
            {/* Free tier */}
            <div className="flex flex-col rounded-3xl border border-warm-700 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] md:p-10">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-warm-300">
                Free
              </p>
              <p className="mt-4 text-4xl font-bold tracking-[-0.03em] text-warm-50 sm:text-5xl">
                $0
                <span className="text-lg font-semibold text-warm-400">
                  {" "}
                  forever
                </span>
              </p>
              <p className="mt-2 text-base text-warm-300">
                For getting a taste of what this is.
              </p>
              <ul className="mt-8 flex flex-col gap-3 text-left text-base text-warm-200">
                <FeatureLine>One companion, formula-generated</FeatureLine>
                <FeatureLine>
                  Full chat &mdash; memory, images, mic-to-text, receipts
                </FeatureLine>
                <FeatureLine>The whole app; no time limit</FeatureLine>
              </ul>

              {/* Trial callout — lives INSIDE the Free card so anyone
                  pricing-shopping reads "free forever" and "starts as
                  full Pro" in the same breath. */}
              <div className="mt-8 rounded-2xl border border-warm-700/70 p-5 text-left">
                <p className="text-gradient-cta text-sm font-bold uppercase tracking-[0.14em]">
                  Your first month is on us.
                </p>
                <p className="mt-2 text-base leading-relaxed text-warm-300">
                  No card, no catch. The first 1,000 people to join get
                  thirty days of everything &mdash; all five companions, the
                  legacy path, the whole app.
                </p>
                <p className="mt-3 text-base leading-relaxed text-warm-300">
                  When the month ends, one companion stays with you forever,
                  free, no matter what. The rest wait right where you left
                  them &mdash; nothing is deleted, no conversation is lost
                  &mdash; behind a {MONTHLY_PRICE_LABEL}/month plan you can
                  cancel any time.
                </p>
              </div>
            </div>

            {/* Pro tier — highlighted with the brand gradient border */}
            <div className="relative flex flex-col rounded-3xl bg-ink-soft p-8 shadow-[0_20px_48px_-16px_rgba(232,138,118,0.25)] md:p-10">
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
                      Unlimited conversations
                    </strong>{" "}
                    &mdash; no caps, no meters. Talk at 2 a.m., and again
                    at 3.
                  </FeatureLine>
                  <FeatureLine>
                    <strong className="text-warm-50">
                      {PRICING.totalIdentitiesPerPlan} companions total
                    </strong>{" "}
                    &mdash; {PRICING.formulaIdentitiesPerPlan} rolled fresh
                    from our formula, {PRICING.photoIdentitiesPerPlan} built
                    from a photo you upload
                  </FeatureLine>
                  <FeatureLine>
                    <strong className="text-warm-50">
                      Lock in your own identity forever
                    </strong>{" "}
                    &mdash; answer the forty questions, mint a code, share
                    it with unlimited family. When you&apos;re gone, they
                    can still talk to you.
                  </FeatureLine>
                  <FeatureLine>
                    <strong className="text-warm-50">
                      Inherit one identity
                    </strong>{" "}
                    from someone you love &mdash; included with Pro. Extra
                    inherited identities are {EXTRA_INHERITED_PRICE_LABEL}
                    /month each.
                  </FeatureLine>
                  <FeatureLine>
                    Everything in Free, plus everything above
                  </FeatureLine>
                </ul>
              </div>
            </div>
          </div>

          {/* Add-on: extra identities beyond the 5. */}
          <div className="mt-6 w-full rounded-2xl border border-warm-700/70 bg-ink-soft/60 p-6 text-center text-warm-300">
            Need more than {PRICING.totalIdentitiesPerPlan}?{" "}
            <strong className="text-warm-100">
              {EXTRA_IDENTITY_PRICE_LABEL}/month per extra identity
            </strong>{" "}
            &mdash; same rate as the base plan.
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

            <nav
              aria-label="Footer"
              className="grid grid-cols-1 gap-x-14 gap-y-8 sm:grid-cols-3"
            >
              <FooterGroup title="Product">
                <FooterLink href="/about">About</FooterLink>
                <FooterLink href="/advertise">Advertise</FooterLink>
              </FooterGroup>
              <FooterGroup title="Legal">
                <FooterLink href="/terms">Terms of Service</FooterLink>
                <FooterLink href="/privacy">Privacy Policy</FooterLink>
                <FooterLink href="/guidelines">
                  Community Guidelines
                </FooterLink>
                <FooterLink href="/data-deletion">Data Deletion</FooterLink>
              </FooterGroup>
              <FooterGroup title="Contact">
                <li>
                  <a
                    href="mailto:support@chapter3five.app"
                    className="text-sm font-semibold text-warm-300 transition-colors hover:text-coral-strong"
                  >
                    Support
                  </a>
                </li>
              </FooterGroup>
            </nav>
          </div>

          <p className="mt-12 text-center text-sm text-warm-400 sm:text-left">
            &copy; 2026 chapter3five &middot; Bethlehem, PA
          </p>
        </div>
      </footer>
    </main>
  );
}
