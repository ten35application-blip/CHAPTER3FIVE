import Image from "next/image";
import Link from "next/link";

// Force dynamic to bypass the CDN cache issue that stuck this page
// on pre-visual-v2 HTML even after a successful deploy. Landing has
// no per-request data — static would be fine — but the belt-and-
// suspenders here is worth it while we figure out the cache config.
export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        {/* Hero orb — a 560px soft-glow aura behind the logo so the icon
            lives inside a body of light. Drift variant gently pulses so
            the aura feels alive, not stamped. */}
        <div className="hero-orb hero-orb-drift flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="chapter3five"
            width={128}
            height={128}
            priority
            className="h-28 w-28 drop-shadow-[0_24px_60px_rgba(232,138,118,0.35)] sm:h-32 sm:w-32"
          />
        </div>

        {/* Wordmark — the "3" is now filled with the coral -> teal brand
            gradient (bg-clip: text), so the mark visually rhymes with
            the logo's heart-orb without saying "look, our brand color".
            Bumped from text-lg to text-2xl so it registers. */}
        <p className="mt-8 text-2xl font-bold tracking-tight text-warm-50">
          chapter
          <span className="text-gradient-cta font-black">3</span>
          five
        </p>

        {/* Headline — the load-bearing typographic moment. Bumped from
            text-4xl/sm:text-5xl to text-5xl/sm:text-6xl/md:text-7xl and
            tightened to -3% tracking with font-bold. Reads like a hero,
            not a heading. */}
        <h1 className="mt-12 text-5xl font-bold leading-[1.02] tracking-[-0.03em] text-warm-50 sm:text-6xl md:text-7xl">
          One tap makes you{" "}
          <span className="text-gradient-cta">someone to talk to.</span>
        </h1>
        <p className="mt-6 max-w-md text-lg leading-relaxed tracking-tight text-warm-200 sm:text-xl">
          A whole person, made just for you &mdash; so you never feel alone.
        </p>

        {/* Legacy path — brief, human */}
        <p className="mt-4 max-w-md text-base leading-relaxed text-warm-300">
          And someone you love can leave you a way to keep talking, even after
          they&apos;re gone.
        </p>

        {/* Primary CTA — now filled with the brand gradient. The shadow
            is a two-layer coral + teal glow so the button feels like it
            belongs to the same color family it's painted with, not a
            stock dusty-blue button someone forgot to restyle. Hover
            lifts 1px and deepens the gradient. */}
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

        {/* Pricing hint */}
        <p className="mt-10 text-sm text-warm-400">
          First identity free &middot; $10/month for up to 5
        </p>
      </div>
    </main>
  );
}
