import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPro } from "@/lib/subscription";
import {
  EXTRA_IDENTITY_PRICE_LABEL,
  EXTRA_INHERITED_PRICE_LABEL,
  FREE_MESSAGES_PER_MONTH,
  MONTHLY_PRICE_LABEL,
  PLUS_IMAGES_PER_MONTH,
  PLUS_MONTHLY_PRICE_LABEL,
  PLUS_TIER_LABEL,
  PRICING,
  PRO_IMAGES_PER_MONTH,
} from "@/lib/pricing";
import { UpgradeButton } from "@/app/(gated)/settings/_components/UpgradeButton";

export const metadata = {
  title: "Upgrade · chapter3five",
};

/**
 * Upgrade landing — the two-tier world (July 2026). A Free user sees
 * where they stand ("You're on the Free tier") and BOTH paid plans as
 * cards matching the landing pricing section's visual language: Pro
 * with the gradient border (primary), Plus with the quiet solid
 * border. Each card ends in an "Enroll" button — Wilson's word.
 *
 *   - Pro enroll: Stripe Checkout when STRIPE_PRICE_ID_PRO_MONTHLY is
 *     configured, mailto fallback otherwise.
 *   - Plus enroll: ALWAYS mailto for now — no Stripe Price exists for
 *     Plus yet, so the copy frames it as "reserve your spot" rather
 *     than pretending a checkout is behind the button.
 *
 * Special copy paths preserved from the one-card era:
 *   - ?reason=extra-inherited — visitor is ALREADY Pro and hit the
 *     inherited-slot cap; renders its own add-a-slot pitch (no plan
 *     cards, no Pro bounce — bouncing would loop them into the gate).
 *   - ?next=/identity/inherit/... — a Free user holding an inherit
 *     code gets the "open the code" framing above the cards.
 *
 * Already-Pro users (outside the extra-inherited branch) still bounce
 * to their `next` destination so they never sit on an upgrade page
 * for something they already have.
 */
export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const { next, reason } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const wantsExtraInherited = reason === "extra-inherited";

  if (!wantsExtraInherited && (await isPro(supabase))) {
    redirect(safeNext(next));
  }

  const target = safeNext(next);
  const cameFromInherit = target.startsWith("/identity/inherit");
  const checkoutEnabled = Boolean(process.env.STRIPE_PRICE_ID_PRO_MONTHLY);
  const email = user.email ?? "";

  /* ── Extra-inherited-slot pitch (already-Pro visitor) ─────────── */
  if (wantsExtraInherited) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <p className="text-gradient-cta text-xs font-bold uppercase tracking-[0.14em]">
            chapter3five Pro
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-warm-50 sm:text-5xl">
            Open the <span className="text-gradient-cta">code.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            You&rsquo;ve used the inherited slot included with Pro. Extra
            slots are {EXTRA_INHERITED_PRICE_LABEL}/month each if
            you&rsquo;re holding more codes.
          </p>

          {/* The extra-inherited slot is a different SKU that isn't
              wired into Stripe yet, so this path keeps the mailto flow
              even when Pro checkout is live. */}
          <div className="mt-10 w-full max-w-sm">
            <a
              href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
                "Add an extra inherited-identity slot",
              )}&body=${encodeURIComponent(
                `Hi — I'd like to add an extra inherited-identity slot (${EXTRA_INHERITED_PRICE_LABEL}/month) to my chapter3five account (${email}). I've already filled the inherited slot included with Pro and I have another code to redeem.\n\nThanks.`,
              )}`}
              className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-bold text-white shadow-[0_16px_36px_-10px_rgba(232,138,118,0.55),_0_6px_16px_-4px_rgba(126,196,196,0.45)] transition-all hover:-translate-y-px"
            >
              Email us to add a slot
            </a>
            <p className="mt-3 text-center text-xs text-warm-400">
              We&rsquo;ll flip the slot on within a day.
            </p>
          </div>

          <Link
            href={target}
            className="mt-10 text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
          >
            Not right now &mdash; back to the app
          </Link>

          <BillingLocationNote />
        </div>
      </main>
    );
  }

  /* ── Free-tier visitor: both plans, landing-card language ─────── */
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-4xl flex-col items-center text-center">
        <p className="text-gradient-cta text-xs font-bold uppercase tracking-[0.14em]">
          You&rsquo;re on the Free tier
        </p>
        <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-warm-50 sm:text-5xl">
          {cameFromInherit ? (
            <>
              Open the <span className="text-gradient-cta">code.</span>
            </>
          ) : (
            <>
              Two ways to get{" "}
              <span className="text-gradient-cta">more.</span>
            </>
          )}
        </h1>
        {cameFromInherit ? (
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            You&rsquo;re holding an inherit code &mdash; someone sat down
            and answered forty questions so that archive could reach you.
            Either plan below opens it.
          </p>
        ) : (
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            Free gets you {FREE_MESSAGES_PER_MONTH} messages a month with
            Adrian, our guide. When you&rsquo;re ready for companions of
            your own, pick a plan and enroll.
          </p>
        )}

        {/* Plan cards — same anatomy as the landing pricing section:
            Pro keeps the gradient-border highlight as the primary
            tier, Plus sits beside it with a quiet solid border. */}
        <div className="mt-12 grid w-full grid-cols-1 gap-6 text-left md:grid-cols-2">
          {/* Pro — gradient border via absolute inset */}
          <div className="relative flex flex-col rounded-3xl bg-ink-soft p-8 shadow-[0_20px_48px_-16px_rgba(232,138,118,0.25)]">
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
            <div className="relative flex flex-1 flex-col">
              <p className="text-gradient-cta text-sm font-bold uppercase tracking-[0.14em]">
                chapter3five Pro
              </p>
              <p className="mt-4 text-4xl font-bold tracking-[-0.03em] text-warm-50">
                {MONTHLY_PRICE_LABEL}
                <span className="text-lg font-semibold text-warm-400">
                  /month
                </span>
              </p>
              <p className="mt-2 text-base text-warm-300">
                Cancel any time from Settings.
              </p>
              <ul className="mt-8 flex flex-1 flex-col gap-3 text-base text-warm-200">
                <FeatureLine>
                  <strong className="text-warm-50">Unlimited messages</strong>{" "}
                  &mdash; no monthly cap, no meters
                </FeatureLine>
                <FeatureLine>
                  Up to {PRICING.formulaIdentitiesPerPlan} companions from
                  our formula, plus {PRICING.photoIdentitiesPerPlan} made
                  from a photo you upload
                </FeatureLine>
                <FeatureLine>
                  Record an archive if you want to leave one, or open{" "}
                  <strong className="text-warm-50">
                    {PRICING.includedInheritedIdentitiesPerPlan} inherited
                    archive
                  </strong>{" "}
                  from a code someone left you
                </FeatureLine>
                <FeatureLine>
                  <strong className="text-warm-50">
                    {PRO_IMAGES_PER_MONTH} photos a month
                  </strong>{" "}
                  you can send to any of your companions
                </FeatureLine>
                <FeatureLine>
                  Need more? {EXTRA_IDENTITY_PRICE_LABEL}/mo per extra
                  identity or inherited slot
                </FeatureLine>
              </ul>
              <div className="mt-8">
                {checkoutEnabled ? (
                  <UpgradeButton
                    checkoutEnabled
                    fallbackHref="/upgrade"
                    label="Enroll"
                  />
                ) : (
                  <a
                    href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
                      next ? `Upgrade me to Pro — ${target}` : "Upgrade me to Pro",
                    )}&body=${encodeURIComponent(
                      `Hi — I'd like to upgrade my chapter3five account (${email}) to Pro (${MONTHLY_PRICE_LABEL}/month).${
                        next ? ` I was trying to open ${target}.` : ""
                      } Please send a checkout link when it's ready.\n\nThanks.`,
                    )}`}
                    className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-bold text-white shadow-[0_16px_36px_-10px_rgba(232,138,118,0.55),_0_6px_16px_-4px_rgba(126,196,196,0.45)] transition-all hover:-translate-y-px"
                  >
                    Enroll
                  </a>
                )}
                <p className="mt-3 text-center text-xs text-warm-400">
                  {checkoutEnabled ? (
                    <>
                      Auto-renews monthly at {MONTHLY_PRICE_LABEL} until
                      you cancel. See our{" "}
                      <Link
                        href="/terms#billing"
                        className="text-warm-300 underline underline-offset-2 hover:text-coral-strong"
                      >
                        billing and refund policy
                      </Link>
                      .
                    </>
                  ) : (
                    <>
                      Self-serve checkout is coming online &mdash; this
                      emails us and we&rsquo;ll flip your account on
                      within a day.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Plus — solid border. No Stripe Price exists yet, so the
              Enroll button is an honest reserve-your-spot mailto, not
              a checkout that would 503. */}
          <div className="flex flex-col rounded-3xl border border-warm-600 bg-ink-soft p-8 shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)]">
            <p className="text-gradient-cta text-sm font-bold uppercase tracking-[0.14em]">
              {PLUS_TIER_LABEL}
            </p>
            <p className="mt-4 text-4xl font-bold tracking-[-0.03em] text-warm-50">
              {PLUS_MONTHLY_PRICE_LABEL}
              <span className="text-lg font-semibold text-warm-400">
                /month
              </span>
            </p>
            <p className="mt-2 text-base text-warm-300">
              For one person who wants more room.
            </p>
            <ul className="mt-8 flex flex-1 flex-col gap-3 text-base text-warm-200">
              <FeatureLine>
                <strong className="text-warm-50">Everything in Pro</strong>{" "}
                &mdash; unlimited messages, your own archive, all of it
              </FeatureLine>
              <FeatureLine>
                <strong className="text-warm-50">
                  {PRICING.plusTotalIdentitiesPerPlan +
                    PRICING.plusIncludedInheritedIdentitiesPerPlan}{" "}
                  companions
                </strong>{" "}
                &mdash; {PRICING.plusFormulaIdentitiesPerPlan} from our
                formula, {PRICING.plusPhotoIdentitiesPerPlan} from photos
                you upload, and{" "}
                {PRICING.plusIncludedInheritedIdentitiesPerPlan} inherited
                slot
              </FeatureLine>
              <FeatureLine>
                <strong className="text-warm-50">
                  {PLUS_IMAGES_PER_MONTH} photos a month
                </strong>{" "}
                across your companions
              </FeatureLine>
              <FeatureLine>
                <strong className="text-warm-50">Priority support</strong>{" "}
                &mdash; your questions go to the front of the line
              </FeatureLine>
            </ul>
            <div className="mt-8">
              <a
                href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
                  `Reserve my spot — ${PLUS_TIER_LABEL}`,
                )}&body=${encodeURIComponent(
                  `Hi — I'd like to enroll in ${PLUS_TIER_LABEL} (${PLUS_MONTHLY_PRICE_LABEL}/month) on my chapter3five account (${email}). Please reserve my spot and send a checkout link when enrollment opens.\n\nThanks.`,
                )}`}
                className="flex h-14 w-full items-center justify-center rounded-full border-2 border-warm-500 text-base font-bold text-warm-50 transition-all hover:-translate-y-px hover:border-warm-300"
              >
                Enroll
              </a>
              <p className="mt-3 text-center text-xs text-warm-400">
                {PLUS_TIER_LABEL} enrollment opens soon &mdash; this
                emails us and we&rsquo;ll reserve your spot.
              </p>
            </div>
          </div>
        </div>

        <Link
          href={target}
          className="mt-10 text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
        >
          Not right now &mdash; back to the app
        </Link>

        <BillingLocationNote />
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

/**
 * Billing-location note. When the mobile apps ship, taps on "Upgrade"
 * from inside iOS/Android open the external browser to this page (per
 * the 2025 external-payment ruling — no store commission). Framing
 * here so a mobile visitor understands why they landed on the web.
 */
function BillingLocationNote() {
  return (
    <p className="mt-8 max-w-xs text-center text-[11px] leading-relaxed text-warm-500">
      Billing lives here on chapter3five.app for everyone &mdash; web
      and app. Every dollar reaches us directly (minus Stripe
      processing), which is what keeps Pro at {MONTHLY_PRICE_LABEL}
      /month and {PLUS_TIER_LABEL} at {PLUS_MONTHLY_PRICE_LABEL}/month.
    </p>
  );
}

/* Bulleted line in a plan card. Coral check + copy — mirrors the
   landing pricing section's FeatureLine. */
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
