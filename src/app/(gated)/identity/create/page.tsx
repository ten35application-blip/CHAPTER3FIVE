import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Who is this for? · chapter3five",
};

/**
 * Path picker — the fork between the two ways an identity comes to exist:
 *
 *   1. "For me right now"     → /identity/new       (we randomize + synthesize)
 *   2. "For someone to keep"  → /identity/legacy/new (40 questions → inheritable)
 *
 * Both cards get identical visual weight — the legacy path is the load-bearing
 * promise of the product and must never read as the fine-print option.
 *
 * Design note: /logo-transparent.png is the two-dots mark with alpha
 * edges, so it floats inside the .hero-orb coral+teal halo without a
 * visible bounding box. (/logo.png is the peach-background master.)
 */
export default async function IdentityCreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="hero-orb hero-orb-drift flex flex-col items-center">
          <Image
            src="/logo-transparent.png"
            alt=""
            width={64}
            height={64}
            priority
            className="h-16 w-16 drop-shadow-[0_12px_32px_rgba(232,138,118,0.22)]"
          />
        </div>

        <h1 className="mt-8 text-center text-3xl font-semibold tracking-tight text-warm-50">
          Who is this for?
        </h1>
        <p className="mt-2 text-center text-base text-warm-300">
          Three ways to bring someone into the world.
        </p>

        <div className="mt-10 flex w-full flex-col gap-4">
          <PathCard
            href="/identity/new"
            title="For me right now"
            subhead="We roll a full trait bundle and our AI writes the person from it, in about a minute. You get who you get."
            icon={<SparkIcon />}
          />
          <PathCard
            href="/identity/from-photo"
            title="From a photo"
            subhead="Upload a picture — a portrait works best. Our AI looks at it and builds an identity to match. The photo itself becomes their face."
            icon={<PhotoIcon />}
          />
          <PathCard
            href="/identity/legacy/new"
            title="For someone to keep"
            subhead="Sit with yourself, or with someone you love. Answer warm, specific questions about who they really are. You'll get a code you can share with family."
            icon={<HeartTagIcon />}
          />
        </div>

        <Link
          href="/dashboard"
          className="mt-8 text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
        >
          Back to messages
        </Link>
      </div>
    </main>
  );
}

function PathCard({
  href,
  title,
  subhead,
  icon,
}: {
  href: string;
  title: string;
  subhead: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-start gap-4 rounded-3xl bg-ink-soft p-6 text-left shadow-[0_14px_36px_-14px_rgba(28,28,26,0.16),_0_4px_12px_rgba(232,138,118,0.08)] ring-1 ring-warm-700 transition-all hover:-translate-y-0.5 hover:ring-coral/40 hover:shadow-[0_20px_44px_-14px_rgba(28,28,26,0.2),_0_6px_16px_rgba(232,138,118,0.12)]"
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral/12"
      >
        <span className="text-gradient-cta">{icon}</span>
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-lg font-semibold text-warm-50">{title}</span>
        <span className="mt-1 text-sm leading-relaxed text-warm-300">
          {subhead}
        </span>
      </span>
      <span
        aria-hidden
        className="ml-auto mt-1 text-warm-400 transition-transform group-hover:translate-x-0.5"
      >
        <svg
          viewBox="0 0 20 20"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 10h12M11 5l5 5-5 5" />
        </svg>
      </span>
    </Link>
  );
}

function PhotoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M17 8.5h.01" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}

function HeartTagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}
