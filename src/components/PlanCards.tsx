import Link from "next/link";
import {
  BASIC_IMAGES_PER_MONTH,
  BASIC_MESSAGES_PER_MONTH,
  BASIC_MONTHLY_PRICE_LABEL,
  BASIC_TIER_LABEL,
  EXTRA_IDENTITY_PRICE_LABEL,
  INHERITED_SLOT_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PRICING,
  PRO_IMAGES_PER_MONTH,
  PRO_MESSAGES_PER_MONTH,
} from "@/lib/pricing";
import { ManageSubscriptionButton } from "@/app/(gated)/settings/_components/ManageSubscriptionButton";
import { UpgradeButton } from "@/app/(gated)/settings/_components/UpgradeButton";

/**
 * Shared plan cards -- rendered on /upgrade AND in the settings Plan
 * block for free-tier users. Both paid tiers (Basic + Pro) with
 * features + an Enroll button, matching the landing. Extracted to one
 * component so a copy or price tweak lands in one place instead of
 * three.
 *
 * Layout: two cards side-by-side on md+, stacked on mobile. Basic
 * sits first (cheaper starter tier) with the teal gradient frame that
 * the retired Plus card wore -- Wilson liked that treatment, and the
 * cooler all-teal border keeps it reading "real, pickable" without
 * stealing the lead. Pro keeps the warm coral gradient highlight as
 * the primary tier. Both end in an Enroll button:
 *   - Pro: Stripe checkout when `checkoutEnabled` (env is set), mailto
 *     fallback otherwise.
 *   - Basic: Stripe checkout when `basicCheckoutEnabled`
 *     (STRIPE_PRICE_ID_BASIC_MONTHLY is set), mailto fallback
 *     otherwise.
 *
 * A Basic SUBSCRIBER (currentTier="basic") sees their card marked
 * "Your current plan" and the Pro card as the upgrade CTA — which
 * routes through the Stripe billing portal, not a fresh Checkout,
 * because /api/stripe/checkout 409s on an already-subscribed user.
 *
 * Below the grid: a one-line nudge pointing at the add-on packs on
 * /upgrade#packs (packs are one-time message/image top-ups; the full
 * pack cards live in src/components/PackOptions.tsx).
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
  basicCheckoutEnabled = false,
  currentTier = null,
  nextHref,
  variant = "full",
}: {
  email: string;
  checkoutEnabled: boolean;
  /** True when STRIPE_PRICE_ID_BASIC_MONTHLY is set — Basic's Enroll
   *  goes to Stripe Checkout instead of the mailto fallback. */
  basicCheckoutEnabled?: boolean;
  /** The viewer's resolved paid tier. "basic" flips the cards into
   *  current-plan / upgrade mode; "pro" | null render the pitch. */
  currentTier?: "basic" | "pro" | null;
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
    <div className="w-full">
      <div className="grid w-full grid-cols-1 gap-6 text-left md:grid-cols-2">
        {/* Basic — teal gradient border (inherited from the retired
            Plus card's treatment). The cheaper starter tier: Adrian
            plus a first cast of your own. */}
        <div
          className={`relative flex flex-col rounded-3xl bg-ink-soft shadow-[0_20px_48px_-16px_rgba(126,196,196,0.22)] ${pad}`}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-3xl p-[2px]"
            style={{
              background:
                "linear-gradient(135deg, var(--color-teal) 0%, var(--color-teal-strong) 100%)",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />
          <div className="relative flex flex-1 flex-col">
            <p className="text-sm font-bold uppercase tracking-[0.14em] text-teal-strong">
              {BASIC_TIER_LABEL}
            </p>
            <p
              className={`mt-3 font-bold tracking-[-0.03em] text-warm-50 ${priceSize}`}
            >
              {BASIC_MONTHLY_PRICE_LABEL}
              <span className="text-lg font-semibold text-warm-400">
                /month
              </span>
            </p>
            <p className={`mt-2 ${featureText} text-warm-300`}>
              Your first companions of your own.
            </p>
            <ul
              className={`mt-6 flex flex-1 flex-col gap-2.5 ${featureText} text-warm-200`}
            >
              <FeatureLine>
                <strong className="text-warm-50">
                  {PRICING.basicTotalIdentitiesPerPlan} companions
                </strong>{" "}
                &mdash; {PRICING.basicFormulaIdentitiesPerPlan} from our
                formula + {PRICING.basicPhotoIdentitiesPerPlan} from a
                photo you upload
              </FeatureLine>
              <FeatureLine>
                <strong className="text-warm-50">
                  {BASIC_MESSAGES_PER_MONTH} messages a month
                </strong>{" "}
                across all your conversations
              </FeatureLine>
              <FeatureLine>
                <strong className="text-warm-50">
                  {BASIC_IMAGES_PER_MONTH} photos a month
                </strong>{" "}
                to send to any companion
              </FeatureLine>
              <FeatureLine>
                Redeem inherit codes for {INHERITED_SLOT_PRICE_LABEL}{" "}
                each &mdash; same one-time fee on every plan
              </FeatureLine>
              {/* Basic can buy extra slots too — canCreateOracle folds
                  extra_oracle_credits onto whichever base applies, and
                  the checkout gate is isPro(), which Basic satisfies.
                  Only the Pro card said so, which undersold Basic. */}
              <FeatureLine>
                Extra companion slots {EXTRA_IDENTITY_PRICE_LABEL} each,
                one time &mdash; buy as many as you like
              </FeatureLine>
              <FeatureLine>
                Adrian, our guide, always included
              </FeatureLine>
            </ul>
            <div className="mt-6">
              {currentTier === "basic" ? (
                <>
                  <div className="flex h-14 w-full items-center justify-center rounded-full border-2 border-teal-strong/60 text-base font-bold text-teal-strong">
                    Your current plan
                  </div>
                  <p className="mt-3 text-center text-xs text-warm-400">
                    Manage or cancel any time from Settings.
                  </p>
                </>
              ) : basicCheckoutEnabled ? (
                <>
                  <UpgradeButton
                    checkoutEnabled
                    purpose="basic_monthly"
                    tone="teal"
                    fallbackHref="/upgrade"
                    label="Enroll"
                  />
                  <p className="mt-3 text-center text-xs text-warm-400">
                    Auto-renews monthly at {BASIC_MONTHLY_PRICE_LABEL}{" "}
                    until you cancel. See our{" "}
                    <Link
                      href="/terms#billing"
                      className="text-warm-300 underline underline-offset-2 hover:text-teal-strong"
                    >
                      billing and refund policy
                    </Link>
                    .
                  </p>
                </>
              ) : (
                <>
                  <a
                    href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
                      `Enroll me in ${BASIC_TIER_LABEL}`,
                    )}&body=${encodeURIComponent(
                      `Hi — I'd like to enroll in ${BASIC_TIER_LABEL} (${BASIC_MONTHLY_PRICE_LABEL}/month) for my chapter3five account (${email}). Please send a checkout link when it's ready.\n\nThanks.`,
                    )}`}
                    className="flex h-14 w-full items-center justify-center rounded-full px-6 text-base font-bold text-white transition-all hover:-translate-y-px"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--color-teal) 0%, var(--color-teal-strong) 100%)",
                      boxShadow:
                        "0 14px 32px -10px rgba(126,196,196,0.5), 0 4px 12px -4px rgba(126,196,196,0.3)",
                    }}
                  >
                    Enroll
                  </a>
                  <p className="mt-3 text-center text-xs text-warm-400">
                    Enrollment opens soon &mdash; this emails us and
                    we&rsquo;ll flip your account on within a day.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Pro — coral gradient border, the primary highlighted tier */}
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
                <strong className="text-warm-50">
                  {PRICING.totalIdentitiesPerPlan} companions
                </strong>{" "}
                &mdash; {PRICING.formulaIdentitiesPerPlan} from our
                formula + {PRICING.photoIdentitiesPerPlan} from a photo
                you upload
              </FeatureLine>
              <FeatureLine>
                <strong className="text-warm-50">
                  {PRO_MESSAGES_PER_MONTH} messages a month
                </strong>{" "}
                across all your conversations
              </FeatureLine>
              <FeatureLine>
                <strong className="text-warm-50">
                  {PRO_IMAGES_PER_MONTH} photos a month
                </strong>{" "}
                to send to any companion
              </FeatureLine>
              <FeatureLine>
                Redeem inherit codes for {INHERITED_SLOT_PRICE_LABEL}{" "}
                each &mdash; same one-time fee on every plan
              </FeatureLine>
              {/* "/mo" advertised a ONE-TIME charge as recurring: the
                  slot SKU is Stripe mode:"payment" and RevenueCat
                  kind:"one_time". Fixed 2026-08-21 on both platforms. */}
              <FeatureLine>
                Extra companion slots {EXTRA_IDENTITY_PRICE_LABEL} each,
                one time &mdash; buy as many as you like
              </FeatureLine>
            </ul>
            <div className="mt-6">
              {currentTier === "basic" ? (
                <>
                  <ManageSubscriptionButton
                    label="Upgrade to Pro"
                    variant="cta"
                  />
                  <p className="mt-3 text-center text-xs text-warm-400">
                    Plan changes happen in the Stripe billing portal
                    and take effect right away.
                  </p>
                </>
              ) : checkoutEnabled ? (
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
              {currentTier === "basic" ? null : (
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pack nudge removed 2026-07-28 -- redundant with the actual
          PacksList surface that renders right below PlanCards in
          Settings, and with the PackOptions block on /upgrade. On the
          landing page a user follows the Enroll CTAs; pack discovery
          happens after signup on Settings > Extra usage. */}
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
