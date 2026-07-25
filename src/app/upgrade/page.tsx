import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPro } from "@/lib/subscription";
import {
  EXTRA_IDENTITY_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PRICING,
} from "@/lib/pricing";

export const metadata = {
  title: "Upgrade · chapter3five",
};

/**
 * Upgrade landing. Users hit this when they try to open a Pro-only
 * surface (legacy path today; more later). Stripe checkout isn't
 * wired end-to-end yet — for now this is a warm explanation page
 * with the email-us fallback.
 *
 * Already-Pro users get bounced to their `next` destination (or
 * dashboard) so they don't sit on an upgrade page for something
 * they already have.
 */
export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  if (await isPro(supabase)) {
    redirect(safeNext(next));
  }

  const target = safeNext(next);
  // Personalize the pitch for the door they just knocked on. The default
  // copy already describes the creator side of the legacy path, so only
  // the inherit (recipient) side needs its own words.
  const cameFromInherit = target.startsWith("/identity/inherit");

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <p className="text-gradient-cta text-xs font-bold uppercase tracking-[0.14em]">
          chapter3five Pro
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-warm-50 sm:text-5xl">
          Keep the people you love around.
        </h1>
        {cameFromInherit ? (
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            You&rsquo;re holding an inherit code — someone sat down and
            answered forty questions about a person they love so that person
            could stay in your messages. Pro is what opens that code and
            keeps their archive running for you.
          </p>
        ) : (
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            Pro unlocks the legacy path — the part of chapter3five where you
            or someone you love sits down, answers the questions, and gets an
            inherit code family can use to keep talking to that person long
            after they&rsquo;re gone.
          </p>
        )}

        <div className="mt-10 w-full max-w-sm rounded-3xl bg-ink-soft p-8 ring-1 ring-warm-700">
          <p className="text-4xl font-bold tracking-tight text-warm-50">
            {MONTHLY_PRICE_LABEL}
            <span className="text-lg font-medium text-warm-300">/month</span>
          </p>
          <p className="mt-2 text-sm text-warm-300">Cancel any time from Settings.</p>

          <ul className="mt-6 space-y-3 text-left text-base text-warm-200">
            <ProLine>
              Up to {PRICING.formulaIdentitiesPerPlan} companions from our
              formula
            </ProLine>
            <ProLine>
              One companion made from a photo you upload
            </ProLine>
            <ProLine>
              <strong className="text-warm-50">The legacy path</strong> —
              record who you are, mint inherit codes, share them with
              unlimited family
            </ProLine>
            <ProLine>
              Anyone you share a code with also needs Pro to use it — that&rsquo;s
              how we keep the legacy side sustainable
            </ProLine>
            <ProLine>
              Need more than {PRICING.totalIdentitiesPerPlan}?{" "}
              <strong className="text-warm-50">
                {EXTRA_IDENTITY_PRICE_LABEL}/mo per extra identity
              </strong>{" "}
              — same rate as the base plan.
            </ProLine>
          </ul>
        </div>

        {/* Stripe checkout isn't wired end-to-end yet — we present the
            honest state instead of a dead button. When checkout ships,
            swap this for a POST to /api/stripe/checkout. */}
        <div className="mt-8 w-full max-w-sm">
          {/* The subject carries the route the user was trying to reach,
              so support can see at a glance what they were after. */}
          <a
            href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
              next ? `Upgrade me to Pro — ${target}` : "Upgrade me to Pro",
            )}&body=${encodeURIComponent(
              `Hi — I'd like to upgrade my chapter3five account (${user.email}) to Pro.${
                next ? ` I was trying to open ${target}.` : ""
              } Please send a checkout link when it's ready.\n\nThanks.`,
            )}`}
            className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-bold text-white shadow-[0_16px_36px_-10px_rgba(232,138,118,0.55),_0_6px_16px_-4px_rgba(126,196,196,0.45)] transition-all hover:-translate-y-px"
          >
            Email us to upgrade
          </a>
          <p className="mt-3 text-center text-xs text-warm-400">
            We&rsquo;re turning on self-serve checkout soon. Until then, drop
            us a note and we&rsquo;ll flip your account on within a day.
          </p>
        </div>

        <Link
          href={safeNext(next)}
          className="mt-10 text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
        >
          Not right now &mdash; back to the app
        </Link>
      </div>
    </main>
  );
}

/** Sanitize the ?next= param so we don't redirect off-site. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/")) return "/dashboard";
  if (next.startsWith("//")) return "/dashboard";
  return next;
}

function ProLine({ children }: { children: React.ReactNode }) {
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
        className="text-gradient-cta mt-0.5 shrink-0 text-coral-strong"
      >
        <path d="M4 11l4 4 8-10" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
