import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlanTier } from "@/lib/subscription";
import {
  BASIC_MONTHLY_PRICE_LABEL,
  BASIC_TIER_LABEL,
  EXTRA_INHERITED_PRICE_LABEL,
  FREE_MESSAGES_PER_MONTH,
  MONTHLY_PRICE_LABEL,
  PACK_FROM_PRICE_LABEL,
} from "@/lib/pricing";
import { PlanCards } from "@/components/PlanCards";
import { PackOptions } from "@/components/PackOptions";

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

  // Tier-aware gate: Pro (incl. admin/trial) bounces to its target as
  // before; a BASIC subscriber stays — this page doubles as their
  // upgrade surface with Basic marked "current."
  const plan = await getPlanTier(supabase);
  if (!wantsExtraInherited && plan.tier === "pro") {
    redirect(safeNext(next));
  }
  const isBasicSubscriber = plan.tier === "basic";

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
            The Pro plan below opens it.
          </p>
        ) : isBasicSubscriber ? (
          <p className="mt-6 max-w-md text-lg leading-relaxed text-warm-200">
            Step up to Pro for a bigger cast, the inherited slot, and
            your own legacy archive &mdash; or grab an add-on pack when
            a month runs long.
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
            context when they email us. */}
        <div className="mt-12 w-full">
          <PlanCards
            email={email}
            checkoutEnabled={checkoutEnabled}
            basicCheckoutEnabled={basicCheckoutEnabled}
            currentTier={isBasicSubscriber ? "basic" : null}
            nextHref={next ? target : null}
          />
        </div>

        {/* Add-on packs — one-time message/image top-ups. Anchored so
            the chat cap-hit CTA ("Grab a pack →") lands right here.
            Stripe checkout per pack when its Price env exists; mailto
            reserve fallback otherwise. */}
        <div id="packs" className="mt-14 w-full scroll-mt-24">
          <h2 className="text-2xl font-bold tracking-[-0.02em] text-warm-50">
            Add-on packs
          </h2>
          <p className="mx-auto mt-2 max-w-md text-base text-warm-300">
            One-time top-ups from {PACK_FROM_PRICE_LABEL}, on top of any
            plan. Pick extra messages or extra images per pack.
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
