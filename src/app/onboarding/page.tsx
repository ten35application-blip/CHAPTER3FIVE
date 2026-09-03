import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAcceptedCurrentTerms } from "@/lib/legal/version";
import { AcceptForm } from "./AcceptForm";
import { signOut } from "./actions";
import { ManageSubscriptionButton } from "@/app/(gated)/settings/_components/ManageSubscriptionButton";
import { sanitizeErrorParam } from "@/lib/action-errors";

export const metadata = {
  title: "Before we begin · chapter3five",
};

/**
 * The acceptance gate. Every authed surface lives behind the (gated)
 * layout, which bounces anyone who hasn't accepted the current legal
 * bundle here. Accepting (AcceptForm → acceptTerms action) stamps the
 * profile row and opens the door.
 *
 * The eight explicit disclosures + "Read full" links each render
 * inside the AcceptForm itself so this page has one canonical list
 * (not a preview list here + a checklist below that could drift).
 * Mirrors the mobile /agreements screen; server action + shared
 * whitelist in @/lib/legal/acceptance keep the two in lock-step.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: rawError } = await searchParams;
  const error = sanitizeErrorParam(rawError);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("terms_version_accepted, stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && hasAcceptedCurrentTerms(profile)) {
    redirect("/dashboard");
  }

  // A re-consent user who is also a paying customer needs to be able
  // to cancel from here (FTC click-to-cancel + no dead-end trap).
  // The billing portal is deliberately ungated so this works even
  // before they accept.
  const hasSubscription = Boolean(
    (profile as { stripe_customer_id?: string | null } | null)
      ?.stripe_customer_id,
  );

  // Re-consent (existing user hit by a legal-version bump) uses the
  // same copy as first-time consent -- Wilson's call, to keep the
  // "welcome" tone consistent whether it's the first time or a Terms
  // update. The routing decision (whether to land here at all) still
  // rides on hasAcceptedCurrentTerms upstream.

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

        {/* Mobile parity 2026-08-03: collapsed eyebrow + gradient-split
            headline into a single plain H1, dropped the "real weight"
            preface so the sub is exactly what mobile shows. */}
        <h1 className="mt-8 text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-warm-50 sm:text-5xl">
          One more thing.
        </h1>
        <p className="mt-4 max-w-sm text-base leading-relaxed text-warm-300">
          Read through, check one box. We record what you agreed to and when.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-6 w-full rounded-2xl bg-warm-700 px-4 py-3 text-center text-sm text-warm-100"
          >
            {error}
          </p>
        ) : null}

        <AcceptForm />

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="text-sm font-semibold text-warm-300 underline underline-offset-4 transition-colors hover:text-coral-strong"
          >
            Sign out instead
          </button>
        </form>

        {hasSubscription ? (
          <div className="mt-6 w-full max-w-xs rounded-2xl bg-ink-soft p-4 ring-1 ring-warm-700">
            <p className="text-xs text-warm-300">
              Rather cancel your subscription first? You can manage or
              cancel it from the billing portal without accepting.
            </p>
            <div className="mt-3">
              <ManageSubscriptionButton />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
