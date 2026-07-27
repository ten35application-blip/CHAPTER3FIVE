import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Get help · chapter3five",
};

/**
 * Contact directory. Every address on our domain, with what each is
 * for. Kept plain — a person on the other end will read whatever
 * comes in, we just want the routing right.
 */
export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  return (
    <main className="min-h-dvh flex-1 pb-16">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-6">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-700/70 text-warm-100 backdrop-blur transition-colors hover:bg-warm-700"
        >
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
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold text-warm-50">Get help</h1>
      </header>

      <div className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-4 px-4">
        <p className="text-base leading-relaxed text-warm-200">
          A person reads every email. Use whichever address fits &mdash;
          we&rsquo;ll route it if it lands in the wrong inbox.
        </p>

        <ContactCard
          address="help@chapter3five.app"
          label="Help"
          blurb="Something not working the way you expect. Broken flow, weird bug, feature you can't find."
        />
        <ContactCard
          address="support@chapter3five.app"
          label="Support"
          blurb="Account issues, billing questions, subscription changes, canceling. Include your account email in the message."
        />
        <ContactCard
          address="contact@chapter3five.app"
          label="Contact"
          blurb="Everything else. Feedback, partnerships, press, hello."
        />

        <div className="mt-4">
          <h2 className="mb-3 px-1 text-xs font-semibold uppercase tracking-wider text-warm-300">
            For specific things
          </h2>
          <div className="flex flex-col gap-4">
            <ContactCard
              address="hello@chapter3five.app"
              label="Safety"
              blurb="Report a user, a persona, or something that made you feel unsafe. Read every day. (Same inbox as hello@ while our dedicated safety address is being set up.)"
            />
            <ContactCard
              address="privacy@chapter3five.app"
              label="Privacy"
              blurb="Data requests, access, correction, deletion. GDPR / CCPA rights all live here."
            />
            <ContactCard
              address="hello@chapter3five.app"
              label="General"
              blurb="Legacy: our oldest address. Still works. Still read."
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-ink-soft p-6 ring-1 ring-warm-700/60">
          <h2 className="text-base font-semibold text-warm-50">
            If you&rsquo;re in crisis
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-warm-200">
            chapter3five is not a crisis service. If you are in the US and
            need to talk to a real human right now, call or text{" "}
            <a
              href="tel:988"
              className="font-semibold text-coral-strong hover:underline"
            >
              988
            </a>{" "}
            (Suicide &amp; Crisis Lifeline). Outside the US, contact your
            local emergency line.
          </p>
        </div>
      </div>
    </main>
  );
}

function ContactCard({
  address,
  label,
  blurb,
}: {
  address: string;
  label: string;
  blurb: string;
}) {
  return (
    <a
      href={`mailto:${address}`}
      className="group flex items-start gap-4 rounded-2xl bg-ink-soft p-5 ring-1 ring-warm-700/60 transition-all hover:-translate-y-px hover:ring-coral/40"
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral/12"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="text-gradient-cta text-coral-strong"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="text-base font-semibold text-warm-50">{label}</span>
          <span className="text-sm font-medium text-coral-strong group-hover:underline">
            {address}
          </span>
        </span>
        <span className="mt-1 text-sm leading-relaxed text-warm-300">
          {blurb}
        </span>
      </span>
    </a>
  );
}
