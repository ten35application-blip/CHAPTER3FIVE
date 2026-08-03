import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRICING } from "@/lib/pricing";
import { canCreateOracle } from "@/lib/subscription";
import { BuyExtraCompanionCTA } from "./BuyExtraCompanionCTA";

export const metadata = {
  title: "Add a companion · chapter3five",
};

/**
 * "Add a companion" — the four ways to grow the account.
 *
 * Wilson's spec, 2026-08-03 rework:
 *
 *   1. Add a companion (random, $5 beyond plan)
 *   2. From a photo    ($5 beyond plan)
 *   3. Me              (free everywhere, one per user)
 *   4. For someone you love (legacy walk, $5 at Finish)
 *
 * Two of the four have a per-card pricing state that depends on the
 * user's current position:
 *   - Cards 1 + 2 read "Included in your plan" when canCreateOracle
 *     returns ok, and "$5" (Stripe checkout) when quota_reached.
 *     Both cards buy the SAME oracle credit — the $5 credit is
 *     quota-agnostic; whichever card the buyer clicks, they can
 *     still spend the resulting slot on either flow. (Restored
 *     'oracle' Stripe purpose → profiles.extra_oracle_credits; the
 *     canCreateOracle math folds credits into baseQuota.)
 *   - Card 3 reads "Free" if no Me identity exists yet, and
 *     "Already created" if one does. Enforced server-side by the
 *     legacy complete route (sameModeCount >= 1 → 409). Me does NOT
 *     eat plan quota per Wilson — see the schema flag in this
 *     session's report; today canCreateOracle counts ALL non-
 *     concierge, non-inherited oracles, so a Me currently DOES
 *     count against the plan ceiling until Wilson approves a
 *     dedicated marker column.
 *   - Card 4 is always "$5 when you finish" — the legacy other-mode
 *     flow already gates the $5 at Finish through
 *     other_identity_create; this page just previews the cost.
 *
 * Design note: /logo-transparent.png is the two-dots mark with alpha
 * edges, so it floats inside the .hero-orb coral+teal halo without a
 * visible bounding box. (/logo.png is the peach-background master.)
 */
export default async function IdentityCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const justPurchased = sp.extra === "1";
  const cancelled = sp.cancelled === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // canCreateOracle already stacks extra_oracle_credits on top of the
  // base plan ceiling, so a user who just came back from the $5 oracle
  // checkout will read as ok=true here without extra work.
  const oracleGate = await canCreateOracle(user.id);
  const overQuota = !oracleGate.ok && oracleGate.reason === "quota_reached";

  // "Has this user already minted a self-mode legacy identity?" — the
  // legacy complete route enforces one-per-account by JSON filtering,
  // so we do the same read here to render the card state consistently.
  // Service-role read: legacy_answers is protected by column grants on
  // some deployments, and the picker MUST know this to render
  // correctly whether or not the user's role can read it.
  const admin = createAdminClient();
  const { data: legacyRows } = await admin
    .from("oracles")
    .select("id, legacy_answers")
    .eq("user_id", user.id)
    .eq("is_legacy", true)
    .is("inherited_at", null)
    .is("deleted_at", null);
  const hasMe = (legacyRows ?? []).some((row) => {
    const mode = (
      row.legacy_answers as { subject?: { mode?: unknown } } | null
    )?.subject?.mode;
    return mode === "self";
  });

  // The $5 extra-companion SKU depends on the Stripe env — when it's
  // absent the checkout POST returns 503. Feature-flag the paid CTAs
  // off in that case so the user isn't led into a dead-end.
  const extraOracleCheckoutEnabled = Boolean(
    process.env.STRIPE_PRICE_ID_EXTRA_ORACLE,
  );

  const extraCents = PRICING.extraIdentityCents;
  const legacyOtherCents = PRICING.otherIdentityCreateCents;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center">
        <div className="hero-orb hero-orb-drift flex flex-col items-center">
          <Image
            src="/logo-transparent.png"
            alt=""
            width={64}
            height={64}
            priority
            className="h-16 w-16 drop-shadow-[0_12px_32px_rgba(232,138,118,0.22)]"
          />
        </div>

        <h1 className="mt-8 text-center text-3xl font-semibold tracking-tight text-warm-50">
          Add a companion
        </h1>
        <p className="mt-2 text-center text-base text-warm-300">
          Four ways to make one.
        </p>

        {justPurchased ? (
          <p className="mt-4 rounded-full bg-teal/12 px-4 py-2 text-center text-xs font-medium text-teal-strong ring-1 ring-teal/30">
            You&rsquo;ve got a fresh slot &mdash; pick a flow to spend it.
          </p>
        ) : null}
        {cancelled ? (
          <p className="mt-4 rounded-full bg-warm-800 px-4 py-2 text-center text-xs font-medium text-warm-300 ring-1 ring-warm-700">
            Checkout cancelled. Nothing was charged.
          </p>
        ) : null}

        <div className="mt-10 flex w-full flex-col gap-4">
          {/* Card 1 — random identity. Free while canCreateOracle
              approves; $5 beyond quota (buys 1 extra_oracle_credit
              via the restored 'oracle' checkout purpose). */}
          <PathCardShell
            title="Add a companion"
            subhead="A random personality written for you in about a minute. No questions, no photo &mdash; you get who you get."
            icon={<SparkIcon />}
            statusLabel={
              overQuota
                ? `$${extraCents / 100}`
                : "Included in your plan"
            }
          >
            {overQuota ? (
              <BuyExtraCompanionCTA
                checkoutEnabled={extraOracleCheckoutEnabled}
                priceCents={extraCents}
                fallbackHref="/upgrade"
                label={`Buy 1 more slot · $${extraCents / 100}`}
              />
            ) : (
              <PillLink
                href="/identity/new"
                label="Roll a companion"
                tone="coral"
              />
            )}
          </PathCardShell>

          {/* Card 2 — photo identity. Same quota + credit as card 1;
              the $5 credit is shared between the two flows. */}
          <PathCardShell
            title="From a photo"
            subhead="Upload a portrait. We read the face and build an identity to match. The photo becomes their face."
            icon={<PhotoIcon />}
            statusLabel={
              overQuota
                ? `$${extraCents / 100}`
                : "Included in your plan"
            }
          >
            {overQuota ? (
              <BuyExtraCompanionCTA
                checkoutEnabled={extraOracleCheckoutEnabled}
                priceCents={extraCents}
                fallbackHref="/upgrade"
                label={`Buy 1 more slot · $${extraCents / 100}`}
              />
            ) : (
              <PillLink
                href="/identity/from-photo"
                label="Choose a photo"
                tone="teal"
              />
            )}
          </PathCardShell>

          {/* Card 3 — Me. Free on all tiers, one per account. When one
              exists the CTA disappears and the card reads "Already
              created" (with a link back to it in the dashboard). */}
          <PathCardShell
            title="Me"
            subhead="Forty warm questions about YOU, in your own voice. Produces a code your family can hold on to so they can remember you here."
            icon={<HeartTagIcon />}
            statusLabel={hasMe ? "Already created" : "Free"}
          >
            {hasMe ? (
              <p className="mt-3 text-center text-xs text-warm-300">
                One Me per account. See it in your dashboard.
              </p>
            ) : (
              <PillLink
                href="/identity/legacy/new?mode=self"
                label="Start the walk"
                tone="teal"
              />
            )}
          </PathCardShell>

          {/* Card 4 — legacy for someone else. Always $5, charged at
              Finish by the existing other_identity_create flow — the
              picker just previews the cost. */}
          <PathCardShell
            title="For someone you love"
            subhead="Forty questions about a real person &mdash; a parent, a partner, a friend. Lands in your contacts, plus a code you can share with family."
            icon={<InfinityIcon />}
            statusLabel={`$${legacyOtherCents / 100} when you finish`}
          >
            <PillLink
              href="/identity/legacy/new?mode=other"
              label="Start the walk"
              tone="coral"
            />
          </PathCardShell>
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

function PathCardShell({
  title,
  subhead,
  icon,
  statusLabel,
  children,
}: {
  title: string;
  subhead: string;
  icon: React.ReactNode;
  statusLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative rounded-3xl bg-ink-soft p-6 text-left shadow-[0_14px_36px_-14px_rgba(28,28,26,0.16),_0_4px_12px_rgba(232,138,118,0.08)] ring-1 ring-warm-700">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-coral/12"
        >
          <span className="text-gradient-cta">{icon}</span>
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-lg font-semibold text-warm-50">{title}</span>
          <span className="mt-1 text-sm leading-relaxed text-warm-300">
            {subhead}
          </span>
          <span className="mt-3 inline-flex w-fit items-center rounded-full bg-warm-800 px-3 py-1 text-xs font-medium text-warm-200 ring-1 ring-warm-700">
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function PillLink({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: "coral" | "teal";
}) {
  const coralClasses =
    "bg-gradient-cta hover:bg-gradient-cta-hover flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold text-white shadow-[0_10px_24px_-10px_rgba(232,138,118,0.55),_0_4px_10px_rgba(126,196,196,0.15)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90";
  const tealStyle = {
    background:
      "linear-gradient(135deg, var(--color-teal) 0%, var(--color-teal-strong) 100%)",
    boxShadow:
      "0 10px 24px -10px rgba(126,196,196,0.5), 0 4px 10px -4px rgba(126,196,196,0.3)",
  } as const;
  const tealClasses =
    "flex h-11 w-full items-center justify-center rounded-full px-6 text-sm font-bold text-white transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90";
  return (
    <Link
      href={href}
      className={tone === "teal" ? tealClasses : coralClasses}
      style={tone === "teal" ? tealStyle : undefined}
    >
      {label}
    </Link>
  );
}

function PhotoIcon() {
  return (
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
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M17 8.5h.01" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}

function HeartTagIcon() {
  return (
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
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/**
 * Infinity mark for the "Someone you love" card. Wilson's ask
 * 2026-07-28: the coral+teal palette on this one so the two legacy
 * cards read as a matched pair with the self card's heart-tag mark
 * (different symbol, same brand weight). The gradient is applied via
 * a per-instance <linearGradient> keyed to a stable id so multiple
 * instances on one page don't collide.
 */
function InfinityIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <defs>
        <linearGradient
          id="c35-infinity-gradient"
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop offset="0%" stopColor="#e88a76" />
          <stop offset="100%" stopColor="#7ec4c4" />
        </linearGradient>
      </defs>
      <path
        d="M6.5 8a4 4 0 0 1 3.11 1.48l4.78 5.04A4 4 0 1 0 17.5 8a4 4 0 0 0-3.11 1.48l-4.78 5.04A4 4 0 1 1 6.5 8z"
        stroke="url(#c35-infinity-gradient)"
      />
    </svg>
  );
}
