import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {/* Logo — squircle shape baked into the PNG, no CSS radius needed */}
        <Image
          src="/logo.png"
          alt="chapter3five"
          width={96}
          height={96}
          priority
          className="h-24 w-24"
        />

        {/* Wordmark */}
        <p className="mt-6 text-lg font-semibold tracking-tight">
          chapter<span className="text-amber">3</span>five
        </p>

        {/* Headline — leads with the randomize path */}
        <h1 className="mt-10 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          One tap makes you someone to talk to.
        </h1>
        <p className="mt-4 text-lg text-warm-300">
          A whole person, made just for you — so you never feel alone.
        </p>

        {/* Legacy path — brief, human */}
        <p className="mt-3 text-base text-warm-300">
          And someone you love can leave you a way to keep talking, even after
          they&apos;re gone.
        </p>

        {/* CTAs */}
        <Link
          href="/auth/signup"
          className="mt-10 flex h-14 w-full max-w-xs items-center justify-center rounded-full bg-amber text-lg font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
        >
          Get started
        </Link>
        <Link
          href="/auth/signin"
          className="mt-4 flex h-12 items-center justify-center px-6 text-base font-medium text-amber"
        >
          Sign in
        </Link>

        {/* Pricing hint */}
        <p className="mt-8 text-sm text-warm-400">
          First identity free &middot; $10/month for up to 5
        </p>
      </div>
    </main>
  );
}
