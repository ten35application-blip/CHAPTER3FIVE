import Link from "next/link";
import {
  EXTRA_IDENTITY_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PLUS_IMAGES_PER_MONTH,
  PLUS_MONTHLY_PRICE_LABEL,
  PLUS_TIER_LABEL,
  PRICING,
  PRO_IMAGES_PER_MONTH,
} from "@/lib/pricing";
import { UpgradeButton } from "@/app/(gated)/settings/_components/UpgradeButton";

/**
 * Shared plan cards -- rendered on /upgrade AND in the settings Plan
 * block for free-tier users. Wilson wants both surfaces to show Pro
 * AND Plus with features + an Enroll button, matching the landing.
 * Extracted to one component so a copy or price tweak lands in one
 * place instead of three.
 *
 * Layout: two cards side-by-side on md+, stacked on mobile. Pro gets
 * the gradient-border highlight as the primary tier; Plus sits beside
 * it with a solid border. Both end in an Enroll button:
 *   - Pro: Stripe checkout when `checkoutEnabled` (env is set), mailto
 *     fallback otherwise.
 *   - Plus: always mailto (no Stripe Price exists for Plus yet).
 *
 * Props:
 *   email          — user's email, threaded into mailto bodies
 *   checkoutEnabled— true when STRIPE_PRICE_ID_PRO_MONTHLY is set
 *   nextHref       — where to send users after enrolling on Pro
 *                    (bubbled into the mailto body context)
 *   variant        — "full" (default; the /upgrade page shape) or
 *                    "compact" (settings block; smaller padding + type)
 */
export function PlanCards({
  email,
  checkoutEnabled,
  nextHref,
  variant = "full",
}: {
  email: string;
  checkoutEnabled: boolean;
  nextHref?: string | null;
  variant?: "full" | "compact";
}) {
  const compact = variant === "compact";
  const pad = compact ? "p-6" : "p-8";
  const priceSize = compact
    ? "text-3xl"
    : "text-4xl";
  const featureText = compact ? "text-sm" : "text-base";
  const targetContext = nextHref ? ` I was trying to open ${nextHref}.` : "";

  return (
    <div className="grid w-full grid-cols-1 gap-6 text-left md:grid-cols-2">
      {/* Pro — gradient border via absolute inset */}
      <div
        className={`relative flex flex-col rounded-3xl bg-ink-soft shadow-[0_20px_48px_-16px_rgba(232,138,118,0.25)] ${pad}`}
      >
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
          <p
            className={`mt-3 font-bold tracking-[-0.03em] text-warm-50 ${priceSize}`}
          >
            {MONTHLY_PRICE_LABEL}
            <span className="text-lg font-semibold text-warm-400">
              /month
            </span>
          </p>
          <p className={`mt-2 ${featureText} text-warm-300`}>
            Cancel any time from Settings.
          </p>
          <ul
            className={`mt-6 flex flex-1 flex-col gap-2.5 ${featureText} text-warm-200`}
          >
            <FeatureLine>
              <strong className="text-warm-50">Unlimited messages</strong>
            </FeatureLine>
            <FeatureLine>
              {PRICING.formulaIdentitiesPerPlan} formula companions +{" "}
              {PRICING.photoIdentitiesPerPlan} from a photo you upload
            </FeatureLine>
            <FeatureLine>
              <strong className="text-warm-50">
                {PRICING.includedInheritedIdentitiesPerPlan} inherited slot
              </strong>{" "}
              &mdash; open a legacy code from someone
            </FeatureLine>
            <FeatureLine>
              <strong className="text-warm-50">
                {PRO_IMAGES_PER_MONTH} photos a month
              </strong>{" "}
              to send to any companion
            </FeatureLine>
            <FeatureLine>
              Record your own legacy archive (mint a code for family)
            </FeatureLine>
            <FeatureLine>
              Extras {EXTRA_IDENTITY_PRICE_LABEL}/mo per slot
            </FeatureLine>
          </ul>
          <div className="mt-6">
            {checkoutEnabled ? (
              <UpgradeButton
                checkoutEnabled
                fallbackHref="/upgrade"
                label="Enroll"
              />
            ) : (
              <a
                href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
                  nextHref
                    ? `Upgrade me to Pro — ${nextHref}`
                    : "Upgrade me to Pro",
                )}&body=${encodeURIComponent(
                  `Hi — I'd like to upgrade my chapter3five account (${email}) to Pro (${MONTHLY_PRICE_LABEL}/month).${targetContext} Please send a checkout link when it's ready.\n\nThanks.`,
                )}`}
                className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-bold text-white shadow-[0_16px_36px_-10px_rgba(232,138,118,0.55),_0_6px_16px_-4px_rgba(126,196,196,0.45)] transition-all hover:-translate-y-px"
              >
                Enroll
              </a>
            )}
            <p className="mt-3 text-center text-xs text-warm-400">
              {checkoutEnabled ? (
                <>
                  Auto-renews monthly at {MONTHLY_PRICE_LABEL} until you
                  cancel. See our{" "}
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
                  emails us and we&rsquo;ll flip your account on within a
                  day.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Plus — solid border. No Stripe Price yet, so Enroll is an
          honest reserve-your-spot mailto. */}
      <div
        className={`flex flex-col rounded-3xl border border-warm-600 bg-ink-soft shadow-[0_10px_36px_-16px_rgba(28,28,26,0.18)] ${pad}`}
      >
        <p className="text-gradient-cta text-sm font-bold uppercase tracking-[0.14em]">
          {PLUS_TIER_LABEL}
        </p>
        <p
          className={`mt-3 font-bold tracking-[-0.03em] text-warm-50 ${priceSize}`}
        >
          {PLUS_MONTHLY_PRICE_LABEL}
          <span className="text-lg font-semibold text-warm-400">/month</span>
        </p>
        <p className={`mt-2 ${featureText} text-warm-300`}>
          For a bigger cast.
        </p>
        <ul
          className={`mt-6 flex flex-1 flex-col gap-2.5 ${featureText} text-warm-200`}
        >
          <FeatureLine>
            <strong className="text-warm-50">Everything in Pro</strong>
          </FeatureLine>
          <FeatureLine>
            <strong className="text-warm-50">
              {PRICING.plusFormulaIdentitiesPerPlan +
                PRICING.plusPhotoIdentitiesPerPlan +
                PRICING.plusIncludedInheritedIdentitiesPerPlan}{" "}
              companions total
            </strong>{" "}
            &mdash; {PRICING.plusFormulaIdentitiesPerPlan} formula,{" "}
            {PRICING.plusPhotoIdentitiesPerPlan} from photos,{" "}
            {PRICING.plusIncludedInheritedIdentitiesPerPlan} inherited slot
          </FeatureLine>
          <FeatureLine>
            <strong className="text-warm-50">
              {PLUS_IMAGES_PER_MONTH} photos a month
            </strong>{" "}
            for image-heavy conversations
          </FeatureLine>
          <FeatureLine>Priority support from a real person</FeatureLine>
        </ul>
        <div className="mt-6">
          <a
            href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
              `Reserve my ${PLUS_TIER_LABEL} spot`,
            )}&body=${encodeURIComponent(
              `Hi — I'd like to enroll in ${PLUS_TIER_LABEL} (${PLUS_MONTHLY_PRICE_LABEL}/month) for my chapter3five account (${email}). Please send a checkout link when it's ready.\n\nThanks.`,
            )}`}
            className="flex h-14 w-full items-center justify-center rounded-full bg-warm-700 px-6 text-base font-bold tracking-tight text-warm-50 transition-all hover:-translate-y-px hover:bg-warm-600"
          >
            Enroll
          </a>
          <p className="mt-3 text-center text-xs text-warm-400">
            Enrollment opens soon &mdash; this emails us and we&rsquo;ll
            reserve your spot.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Bulleted feature line — coral check + copy. Local to this file so
 *  the surrounding pages can render text-only feature lists without
 *  reaching for a shared component. */
function FeatureLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg
        viewBox="0 0 20 20"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        className="mt-1 shrink-0 text-coral-strong"
      >
        <path d="M4 11l4 4 8-10" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
