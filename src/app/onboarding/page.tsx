import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAcceptedCurrentTerms } from "@/lib/legal/version";
import { AcceptForm } from "./AcceptForm";
import { signOut } from "./actions";

export const metadata = {
  title: "Before we begin · chapter3five",
};

const DOCS = [
  {
    href: "/terms",
    label: "Terms of Service",
    summary:
      "How chapter3five works, what you're agreeing to, and how we handle disputes.",
  },
  {
    href: "/eula",
    label: "End-User License Agreement",
    summary:
      "The license we grant you to use the software, plus extra terms for the iOS app.",
  },
  {
    href: "/privacy",
    label: "Privacy Policy",
    summary:
      "What we collect, how it's protected, and what happens to it if you leave.",
  },
  {
    href: "/guidelines",
    label: "Community Guidelines",
    summary:
      "How to treat the people — and the memories of people — you'll meet here.",
  },
] as const;

/**
 * The acceptance gate. Every authed surface lives behind the (gated)
 * layout, which bounces anyone who hasn't accepted the current legal
 * bundle here. Accepting (AcceptForm → acceptTerms action) stamps the
 * profile row and opens the door.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("terms_version_accepted")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && hasAcceptedCurrentTerms(profile)) {
    redirect("/dashboard");
  }

  // Distinguish first-time consent from re-consent (existing user hit
  // by a legal-version bump). A non-null terms_version_accepted means
  // they've been through here before — the copy shifts to explain WHY
  // they're back rather than reading like a first-run gate.
  const isReconsent =
    profile !== null &&
    profile.terms_version_accepted !== null &&
    !hasAcceptedCurrentTerms(profile);

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {/* Logo in its warm halo — the two-dots mark (transparent PNG)
            floating inside the coral+teal orb, per the visual-v2
            contract. */}
        <div className="hero-orb flex items-center justify-center">
          <Image
            src="/logo-transparent.png"
            alt="chapter3five"
            width={96}
            height={96}
            priority
            className="h-24 w-24 drop-shadow-[0_18px_44px_rgba(232,138,118,0.3)]"
          />
        </div>

        <p className="text-gradient-cta mt-8 text-sm font-bold uppercase tracking-[0.14em]">
          {isReconsent ? "One quick thing" : "One more thing"}
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-warm-50 sm:text-5xl">
          {isReconsent ? (
            <>
              A small <span className="text-gradient-cta">update.</span>
            </>
          ) : (
            <>
              Before we <span className="text-gradient-cta">begin.</span>
            </>
          )}
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-warm-300">
          {isReconsent ? (
            <>
              We&rsquo;ve updated our legal bundle. Please take a look
              at what changed and re-confirm to keep going. Nothing
              about your account or content has changed.
            </>
          ) : (
            <>
              chapter3five holds real weight &mdash; people&apos;s
              voices, memories, and legacy. A quick agreement, then
              you&apos;re in.
            </>
          )}
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-6 w-full rounded-2xl bg-warm-700 px-4 py-3 text-center text-sm text-warm-100"
          >
            {error}
          </p>
        ) : null}

        {/* The four documents — each opens in a new tab so this page
            (and the checkbox) stays put while you read. */}
        <ul className="mt-8 flex w-full flex-col gap-3">
          {DOCS.map((doc) => (
            <li key={doc.href}>
              <a
                href={doc.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-1 rounded-3xl bg-ink-soft px-5 py-4 text-left shadow-[0_8px_28px_-16px_rgba(28,28,26,0.12),_0_2px_8px_-2px_rgba(232,138,118,0.08)] ring-1 ring-warm-700/60 transition-all hover:-translate-y-px hover:ring-coral/40"
              >
                <span className="flex items-center justify-between">
                  <span className="text-base font-semibold text-warm-50 transition-colors group-hover:text-coral-strong">
                    {doc.label}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    className="text-warm-400 transition-colors group-hover:text-coral-strong"
                  >
                    <path d="M7 17L17 7" />
                    <path d="M9 7h8v8" />
                  </svg>
                </span>
                <span className="text-sm leading-relaxed text-warm-300">
                  {doc.summary}
                </span>
              </a>
            </li>
          ))}
        </ul>

        <AcceptForm />

        <p className="mt-8 text-sm text-warm-400">
          You must be 18 or older to use chapter3five.
        </p>

        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="text-sm font-semibold text-warm-300 transition-colors hover:text-coral-strong"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
