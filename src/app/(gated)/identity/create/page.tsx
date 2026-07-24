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
 * Design note: /logo.png carries its own dark squircle box, so it sits on the
 * peach page background inside a .hero-orb coral+teal halo — never on a
 * gradient fill that would fight the box.
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
            src="/logo.png"
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
          There are two ways to bring someone into the world.
        </p>

        <div className="mt-10 flex w-full flex-col gap-4">
          <PathCard
            href="/identity/new"
            title="For me right now"
            subhead="We'll create a whole person made just for you, in about a minute."
            glyph="✦"
          />
          <PathCard
            href="/identity/legacy/new"
            title="For someone to keep"
            subhead="Answer ~40 questions about yourself or a loved one. When you're done, you'll get a code you can share."
            glyph="❦"
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
  glyph,
}: {
  href: string;
  title: string;
  subhead: string;
  glyph: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-3xl bg-ink-soft p-6 text-left shadow-[0_14px_36px_-14px_rgba(28,28,26,0.16),_0_4px_12px_rgba(232,138,118,0.08)] ring-1 ring-warm-700 transition-all hover:-translate-y-0.5 hover:ring-coral/40 hover:shadow-[0_20px_44px_-14px_rgba(28,28,26,0.2),_0_6px_16px_rgba(232,138,118,0.12)]"
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral/12 text-xl leading-none"
      >
        <span className="text-gradient-cta">{glyph}</span>
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
        →
      </span>
    </Link>
  );
}
