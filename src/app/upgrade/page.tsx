import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanTier } from "@/lib/subscription";
import {
  BASIC_MONTHLY_PRICE_LABEL,
  BASIC_TIER_LABEL,
  FREE_MESSAGES_PER_MONTH,
  INHERITED_SLOT_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PACK_FROM_PRICE_LABEL,
} from "@/lib/pricing";
import { PlanCards } from "@/components/PlanCards";
import { PackOptions } from "@/components/PackOptions";
import { UpgradeButton } from "@/app/(gated)/settings/_components/UpgradeButton";

export const metadata = {
  title: "Upgrade · chapter3five",
};

/**
 * Upgrade landing — the pack-rework tier world (July 2026). A Free
 * user sees where they stand ("You're on the Free tier"), BOTH paid
 * plans as cards matching the landing pricing section's visual
 * language (Basic teal, Pro coral-gradient primary), and the add-on
 * pack options below at #packs (the anchor cap-hit CTAs in chat link
 * to). Each plan card ends in an "Enroll" button — Wilson's word.
 *
 *   - Pro enroll: Stripe Checkout when STRIPE_PRICE_ID_PRO_MONTHLY is
 *     configured, mailto fallback otherwise.
 *   - Basic enroll: Stripe Checkout when STRIPE_PRICE_ID_BASIC_MONTHLY
 *     is configured, mailto fallback otherwise.
 *   - Pack reserve: per-pack Stripe Checkout when the matching
 *     STRIPE_PRICE_ID_PACK_* is configured, mailto fallback otherwise.
 *
 * Tier-aware since the Stripe wiring landed: a Basic subscriber
 *  (getPlanTier → "basic") lands here with Basic marked "your current
 * plan" and Pro as the upgrade CTA (routed through the billing
 * portal). Only full-Pro visitors bounce away.
 *
 * Special copy paths:
 *   - ?reason=inherited-slot (legacy alias: extra-inherited) — the
 *     visitor tried to redeem an inherit code without a purchased
 *     slot credit. Renders the one-time $5 purchase pitch (Stripe
 *     Checkout on STRIPE_PRICE_ID_INHERITED_SLOT, mailto fallback) —
 *     ANY tier can land here since the July 2026 second rework
 *     unbundled the inherited slot (flat $5 per code, every tier, no
 *     waivers), so this branch never bounces Pro visitors (that
 *     would loop them into the gate).
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

  const wantsInheritedSlot =
    reason === "inherited-slot" || reason === "extra-inherited";

  // Tier-aware surface. Pre-audit (2026-07-28) this page bounced Pro
  // users straight back to their target, which dead-ended a Pro
  // subscriber who hit a message cap: they'd land here from the chat
  // banner and get punted right back with no pack path. Now Pro users
  // stay, subscription cards are hidden (they're already on the top
  // tier), and the packs section becomes the whole point.
  const plan = await getPlanTier(supabase);
  const isBasicSubscriber = plan.tier === "basic";
  const isProSubscriber = plan.tier === "pro";

  const target = safeNext(next);
  const cameFromInherit = target.startsWith("/identity/inherit");
  const checkoutEnabled = Boolean(process.env.STRIPE_PRICE_ID_PRO_MONTHLY);
  const basicCheckoutEnabled = Boolean(
    process.env.STRIPE_PRICE_ID_BASIC_MONTHLY,
  );
  const packCheckoutEnabled = {
    small: Boolean(process.env.STRIPE_PRICE_ID_PACK_SMALL),
    medium: Boolean(process.env.STRIPE_PRICE_ID_PACK_MEDIUM),
    large: Boolean(process.env.STRIPE_PRICE_ID_PACK_LARGE),
  };
  const email = user.email ?? "";

  /* ── Inherit-slot purchase pitch (redeem gate, living minter) ─── */
  if (wantsInheritedSlot) {
    const inheritedSlotCheckoutEnabled = Boolean(
      process.env.STRIPE_PRICE_ID_INHERITED_SLOT,
    );
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <p className="text-gradient-cta text-xs font-bold uppercase tracking-[0.14em]">
            chapter3five
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-warm-50 sm:text-5xl">
            Open the <span className="text-gradient-cta">code.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            Bringing in an identity someone shared with you is a{" "}
            {INHERITED_SLOT_PRICE_LABEL} one-time unlock &mdash; once,
            per code, never monthly. The same flat fee on every plan,
            for every code.
          </p>

          <div className="mt-10 w-full max-w-sm">
            {inheritedSlotCheckoutEnabled ? (
              <>
                <UpgradeButton
                  checkoutEnabled
                  purpose="inherited_slot_purchase"
                  fallbackHref="/upgrade"
                  label={`Unlock for ${INHERITED_SLOT_PRICE_LABEL}`}
                />
                <p className="mt-3 text-center text-xs text-warm-400">
                  One-time payment &mdash; you&rsquo;ll come right back
                  here to enter the code.
                </p>
              </>
            ) : (
              <>
                <a
                  href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
                    "Unlock an inherit code",
                  )}&body=${encodeURIComponent(
                    `Hi — I'm holding an inherit code and I'd like the one-time ${INHERITED_SLOT_PRICE_LABEL} unlock on my chapter3five account (${email}).\n\nThanks.`,
                  )}`}
                  className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-bold text-white shadow-[0_16px_36px_-10px_rgba(232,138,118,0.55),_0_6px_16px_-4px_rgba(126,196,196,0.45)] transition-all hover:-translate-y-px"
                >
                  Email us to unlock
                </a>
                <p className="mt-3 text-center text-xs text-warm-400">
                  We&rsquo;ll flip it on within a day.
                </p>
              </>
            )}
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

  /* ── Free-tier or Basic visitor: both plans, landing-card language ── */
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-4xl flex-col items-center text-center">
        <p className="text-gradient-cta text-xs font-bold uppercase tracking-[0.14em]">
          {isBasicSubscriber
            ? `You're on ${BASIC_TIER_LABEL}`
            : "You're on the Free tier"}
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
            Opening it is a {INHERITED_SLOT_PRICE_LABEL} one-time unlock
            on any plan &mdash; head back to{" "}
            <Link
              href="/identity/inherit"
              className="font-semibold text-warm-100 underline underline-offset-2"
            >
              enter your code
            </Link>
            , or pick a plan below for companions of your own.
          </p>
        ) : isProSubscriber ? (
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            You&rsquo;re on Pro &mdash; the top tier. If a month runs
            long, top up with an add-on pack below and keep going.
          </p>
        ) : isBasicSubscriber ? (
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            Step up to Pro for a bigger cast and more room every month
            &mdash; or grab an add-on pack when a month runs long.
          </p>
        ) : (
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            Free gets you {FREE_MESSAGES_PER_MONTH} messages a month with
            Adrian, our guide. When you&rsquo;re ready for companions of
            your own, pick a plan and enroll.
          </p>
        )}

        {/* Plan cards — single source of truth lives in
            src/components/PlanCards.tsx so /upgrade and the settings
            free-tier block can't drift on prices, features, or copy.
            `nextHref` threads context into the Pro mailto so a user
            who was trying to open /identity/inherit/... gives us that
            context when they email us. Skipped for Pro subscribers:
            they're already at the top tier, so the plan cards would
            just be noise; the packs section below is the whole
            point of the page for them. */}
        {isProSubscriber ? null : (
          <div className="mt-12 w-full">
            <PlanCards
              email={email}
              checkoutEnabled={checkoutEnabled}
              basicCheckoutEnabled={basicCheckoutEnabled}
              currentTier={isBasicSubscriber ? "basic" : null}
              nextHref={next ? target : null}
            />
          </div>
        )}

        {/* Add-on packs — one-time message/image top-ups. Anchored so
            the chat cap-hit CTA ("Grab a pack →") lands right here.
            Stripe checkout per pack when its Price env exists; mailto
            reserve fallback otherwise. */}
        <div id="packs" className="mt-14 w-full scroll-mt-24">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-warm-50">
            Add-on packs
          </h2>
          <p className="mx-auto mt-2 max-w-md text-base text-warm-300">
            Extra messages? Extra images? Grab an add-on pack from{" "}
            {PACK_FROM_PRICE_LABEL}.
          </p>
          <div className="mt-6">
            <PackOptions email={email} checkoutEnabled={packCheckoutEnabled} />
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
      processing), which is what keeps {BASIC_TIER_LABEL} at{" "}
      {BASIC_MONTHLY_PRICE_LABEL}/month and Pro at {MONTHLY_PRICE_LABEL}
      /month.
    </p>
  );
}

// FeatureLine helper removed -- plan cards moved to
// src/components/PlanCards.tsx which owns its own bullet rendering.
