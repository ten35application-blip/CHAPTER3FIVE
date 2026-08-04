import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PRICING } from "@/lib/pricing";
import { getPlanTier, isPro } from "@/lib/subscription";
import { isAdmin } from "@/lib/admin/allowlist";
import { BuyExtraCompanionCTA } from "./BuyExtraCompanionCTA";

export const metadata = {
  title: "Add a companion · chapter3five",
};

/**
 * "Add a companion" — the four ways to grow the account.
 *
 * VISUAL SOURCE OF TRUTH: chapter3five-app/app/identity/create.tsx.
 * Wilson 2026-08-03: mobile is the canonical visual and web catches
 * up here. Behavior/routing was already at parity from the gap-#6
 * rework — this file only rewrites JSX + Tailwind to match mobile's
 * PathCard treatment (rounded-[22px] card, 44px rounded-[14px]
 * coral-tinted icon square, pill status chip, SOLID coral/teal CTA
 * — NOT the CTA gradient; mobile uses flat brand fills).
 *
 * Wilson's spec, 2026-08-03 audit gap #6 rework:
 *
 *   1. Add a companion (random, $5 beyond plan)
 *   2. From a photo    (photo slot, $5 beyond plan)
 *   3. Me              (free everywhere, one per user)
 *   4. For someone you love (legacy walk, $5 at Finish)
 *
 * TWO INDEPENDENT PER-PLAN QUOTAS drive cards 1 + 2 (per Wilson,
 * 2026-08-03 — closes the audit gap where a fresh Basic subscriber
 * saw "$5" on both cards because the placeholder + auto-populate
 * randoms filled the shared `canCreateOracle` ceiling):
 *
 *   RANDOM QUOTA — Basic 2, Pro 4 (from
 *     PRICING.basicFormulaIdentitiesPerPlan /
 *     PRICING.formulaIdentitiesPerPlan). Filter is
 *     is_concierge=false, is_self_archive=false, is_legacy=false,
 *     is_photo_placeholder=false, creation_source != 'photo',
 *     inherited_at IS NULL, deleted_at IS NULL.
 *
 *   PHOTO SLOT — always 1 per plan; a placeholder is auto-created
 *     on subscribe and DOES NOT count as spent. The slot is "used"
 *     only when a filled photo companion exists
 *     (creation_source='photo' AND is_photo_placeholder=false).
 *
 * Per-card state:
 *   Card 1: randomCount < randomQuota → "Included in your plan"
 *                                       + Roll a companion CTA
 *           randomCount >= randomQuota → "$5"
 *                                       + BuyExtraCompanionCTA (Stripe)
 *   Card 2: hasUnfilledPlaceholder → "Included in your plan"
 *                                    + "Bring your photo companion to
 *                                      life" → /chat/{placeholderId}
 *           !placeholder && !filled  → "Included in your plan · start
 *                                       from a photo"
 *                                       + /identity/from-photo
 *           hasFilledPhoto           → "$5"
 *                                       + BuyExtraCompanionCTA (Stripe)
 *   Card 3: hasMe → "Already created" (no CTA)
 *           !hasMe → "Free" + Start the walk (self-mode)
 *   Card 4: always "$5 when you finish" + Start the walk (other-mode)
 *
 * Free tier: the two-quota split collapses to a single "you have
 * exactly one identity ever" gate — profiles.free_identity_id set →
 * both cards show "$5". A Free user who happens to hold a leftover
 * placeholder (upgraded then downgraded) can still fill it: card 2's
 * "hasUnfilledPlaceholder" branch fires before the free-quota fallback.
 * The server (canCreateOracle) is still the source of truth; this UI
 * is only what the user reads.
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

  // Tier + admin resolution: getPlanTier returns basic|pro|free;
  // admins are unlimited (tier=pro, unlimited=true). Free-tier gate
  // still uses profiles.free_identity_id as the ceiling (one identity
  // ever).
  const plan = await getPlanTier(supabase);
  const admin = createAdminClient();
  const isProUser = await isPro(supabase);
  const adminBypass = plan.unlimited || isAdmin(user.email);

  // Service-role reads across the board so column grants can't skew
  // per-card state (Wilson's ask: picker must render consistently
  // regardless of whether the user role can read a given column).
  const [
    { data: profile },
    { count: randomCountRaw },
    { count: filledPhotoCountRaw },
    { data: placeholderRow },
    { data: legacyRows },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("free_identity_id, extra_oracle_credits")
      .eq("id", user.id)
      .maybeSingle<{
        free_identity_id: string | null;
        extra_oracle_credits: number | null;
      }>(),
    // RANDOM count — spec filter: not concierge, not Me, not any
    // legacy, not inherited, not deleted, not placeholder, and
    // creation_source != 'photo' (belt: even a filled photo persona
    // never counts against random).
    admin
      .from("oracles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_concierge", false)
      .eq("is_self_archive", false)
      .eq("is_legacy", false)
      .eq("is_photo_placeholder", false)
      .not("creation_source", "eq", "photo")
      .is("inherited_at", null)
      .is("deleted_at", null),
    // FILLED photo count — a filled photo companion exists when
    // creation_source='photo' AND is_photo_placeholder=false.
    admin
      .from("oracles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("creation_source", "photo")
      .eq("is_photo_placeholder", false)
      .is("inherited_at", null)
      .is("deleted_at", null),
    // UNFILLED placeholder — the auto-populate helper's post-subscribe
    // reservation. Card 2 routes here (/chat/{id}) so the user's next
    // click lands on PhotoPlaceholderScreen and the existing upload
    // flow fills the row in place (Phase 4). Never more than one per
    // user in practice (autoPopulate guards it), but LIMIT 1 defensively.
    admin
      .from("oracles")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_photo_placeholder", true)
      .is("inherited_at", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string }>(),
    // Me detection — legacy_answers.subject.mode === 'self'.
    admin
      .from("oracles")
      .select("id, legacy_answers")
      .eq("user_id", user.id)
      .eq("is_legacy", true)
      .is("inherited_at", null)
      .is("deleted_at", null),
  ]);

  const randomCount = randomCountRaw ?? 0;
  const hasFilledPhoto = (filledPhotoCountRaw ?? 0) > 0;
  const hasUnfilledPlaceholder = Boolean(placeholderRow?.id);
  const placeholderId = placeholderRow?.id ?? null;

  const hasMe = (legacyRows ?? []).some((row) => {
    const mode = (
      row.legacy_answers as { subject?: { mode?: unknown } } | null
    )?.subject?.mode;
    return mode === "self";
  });

  // Per-tier random ceiling. Free's ceiling is "1 identity ever"
  // (free_identity_id) — the random-count read above is irrelevant
  // there; the fallback branch below uses free_identity_id directly.
  const baseRandomQuota =
    plan.tier === "basic"
      ? PRICING.basicFormulaIdentitiesPerPlan
      : PRICING.formulaIdentitiesPerPlan;
  const extraCredits = profile?.extra_oracle_credits ?? 0;

  // randomOverQuota:
  //   - Admins: never over.
  //   - Free: over iff free_identity_id is set (one-identity-ever gate).
  //   - Basic/Pro: over iff randomCount >= (baseRandomQuota + credits).
  //     Credits are the shared "extras purchased" pool — bought via the
  //     $5 BuyExtraCompanionCTA, folded into ceiling by canCreateOracle.
  //     A user who buys and hasn't spent yet reads as under quota again
  //     (label flips back to "Included · N remaining" so they can
  //     actually click Roll and use the credit they paid for).
  const randomOverQuota = adminBypass
    ? false
    : !isProUser
      ? Boolean(profile?.free_identity_id)
      : randomCount >= baseRandomQuota + extraCredits;

  const randomRemaining = adminBypass
    ? null
    : !isProUser
      ? null
      : Math.max(0, baseRandomQuota + extraCredits - randomCount);

  // photoOverQuota:
  //   - Admins: never over.
  //   - Any tier with a filled photo already: over (photo slot spent).
  //     A bought credit does NOT flip the label back — the render
  //     always prefers "$5" once the slot is filled per Wilson's
  //     literal spec ("photo slot is used → $5"). If the user wants
  //     another photo they buy a credit (may double-buy if they
  //     already hold one from a random overflow — accepted rounding).
  //   - Free tier + free_identity_id set + no placeholder to fill:
  //     over (one-identity-ever gate closed on the photo card too).
  const photoOverQuota = adminBypass
    ? false
    : hasFilledPhoto ||
      (!isProUser &&
        Boolean(profile?.free_identity_id) &&
        !hasUnfilledPlaceholder);

  // The $5 extra-companion SKU depends on the Stripe env — when it's
  // absent the checkout POST returns 503. Feature-flag the paid CTAs
  // off in that case so the user isn't led into a dead-end.
  const extraOracleCheckoutEnabled = Boolean(
    process.env.STRIPE_PRICE_ID_EXTRA_ORACLE,
  );

  const extraCents = PRICING.extraIdentityCents;
  const legacyOtherCents = PRICING.otherIdentityCreateCents;

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-6 pb-12 pt-14">
      {/* Back link — matches mobile "← Back" top-left in coral-strong,
          16px / weight 600. Web target is /dashboard (mobile does
          router.back() but web reaches this picker from the dashboard
          compose flow, so /dashboard is the correct rewind). */}
      <div className="mb-2">
        <Link
          href="/dashboard"
          className="text-base font-semibold text-coral-strong transition-colors hover:text-coral"
        >
          ← Back
        </Link>
      </div>

      {/* Header — logo (56px, no hero-orb; mobile has none), h1 at
          28px/extrabold/tight, subtitle 16px warm-300. Matches the
          centered stack on mobile above the four cards. */}
      <div className="mt-3 mb-6 flex flex-col items-center">
        <Image
          src="/logo-transparent.png"
          alt=""
          width={56}
          height={56}
          priority
          className="h-14 w-14"
        />
        <h1 className="mt-5 text-center text-[28px] font-extrabold tracking-[-0.8px] text-warm-50">
          Add a companion
        </h1>
        <p className="mt-1.5 text-center text-base text-warm-300">
          Four ways to make one.
        </p>
      </div>

      {/* Web-only post-checkout banners. Kept because mobile doesn't
          transit through Stripe's success/cancel URLs — but styled to
          sit inside the same visual language (pill, warm tokens). */}
      {justPurchased ? (
        <p className="mb-3 rounded-full bg-teal/12 px-4 py-2 text-center text-xs font-medium text-teal-strong ring-1 ring-teal/30">
          You&rsquo;ve got a fresh slot &mdash; pick a flow to spend it.
        </p>
      ) : null}
      {cancelled ? (
        <p className="mb-3 rounded-full bg-warm-700 px-4 py-2 text-center text-xs font-medium text-warm-300 ring-1 ring-warm-700">
          Checkout cancelled. Nothing was charged.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {/* Card 1 — random identity. "Included in your plan · N
            remaining" while under the tier's random quota (Basic 2 /
            Pro 4, plus purchased extra_oracle_credits); "$5" beyond
            that (buys 1 extra_oracle_credit via the 'oracle'
            checkout purpose). Coral CTA to match mobile. */}
        <PathCardShell
          title="Add a companion"
          subhead="A random personality written for you in about a minute. No questions, no photo &mdash; you get who you get."
          icon={<SparkIcon />}
          // No "Included in your plan" chip, ever (Wilson 2026-08-04).
          // Paid plans auto-create their identities at checkout, so by
          // the time anyone reaches this screen the allotment has
          // already been spent — advertising "included" here told people
          // they could keep adding for free, which was never true. Price
          // shows only when a purchase is genuinely required; otherwise
          // the chip is omitted rather than replaced with a cheerier
          // lie. Quota logic underneath is untouched, so a user who
          // really does have a slot left still gets the free path.
          statusLabel={
            randomOverQuota ? `$${extraCents / 100}` : undefined
          }
        >
          {randomOverQuota ? (
            <BuyExtraCompanionCTA
              checkoutEnabled={extraOracleCheckoutEnabled}
              priceCents={extraCents}
              fallbackHref="/upgrade"
              label={`Buy 1 more slot · $${extraCents / 100}`}
              tone="coral"
            />
          ) : (
            <SolidPillLink
              href="/identity/new"
              label="Roll a companion"
              tone="coral"
            />
          )}
        </PathCardShell>

        {/* Card 2 — photo identity. Three states, in priority order:
            (a) unfilled placeholder exists → "Included in your plan"
                + route to /chat/{placeholderId} so the existing
                PhotoPlaceholderScreen upload flow fills the row
                in place (uses the reserved slot, no new insert);
            (b) no placeholder & no filled photo → "Included · start
                from a photo" + /identity/from-photo (rare — happens
                when auto-populate hasn't run or the placeholder got
                deleted);
            (c) filled photo exists → "$5" + BuyExtraCompanionCTA.
            Teal CTA in all three branches to match mobile. */}
        <PathCardShell
          title="From a photo"
          subhead="Upload a portrait. We read the face and build an identity to match. The photo becomes their face."
          icon={<PhotoIcon />}
          // Same rule as card 1. The unfilled-placeholder case is the one
          // thing here the user genuinely already owns — their plan
          // created the slot at checkout and it's waiting on a photo —
          // so it says so plainly rather than "Included in your plan",
          // which reads as "here's another free one".
          statusLabel={
            hasUnfilledPlaceholder
              ? "Already yours · waiting on a photo"
              : photoOverQuota
                ? `$${extraCents / 100}`
                : undefined
          }
        >
          {hasUnfilledPlaceholder && placeholderId ? (
            <SolidPillLink
              href={`/chat/${placeholderId}`}
              label="Bring your photo companion to life"
              tone="teal"
            />
          ) : photoOverQuota ? (
            <BuyExtraCompanionCTA
              checkoutEnabled={extraOracleCheckoutEnabled}
              priceCents={extraCents}
              fallbackHref="/upgrade"
              label={`Buy 1 more slot · $${extraCents / 100}`}
              tone="teal"
            />
          ) : (
            <SolidPillLink
              href="/identity/from-photo"
              label="Choose a photo"
              tone="teal"
            />
          )}
        </PathCardShell>

        {/* Card 3 — Me. Free on all tiers, one per account. When one
            exists the CTA disappears and the card reads "Already
            created" (with a link back to it in the dashboard). Teal
            CTA to match mobile. */}
        <PathCardShell
          title="Me"
          subhead="Forty-five warm questions about YOU, in your own voice. Produces a code your family can hold on to so they can remember you here."
          icon={<HeartTagIcon />}
          statusLabel={hasMe ? "Already created" : "Free"}
        >
          {hasMe ? (
            <p className="mt-2 text-center text-[13px] text-warm-300">
              One Me per account. See it in your dashboard.
            </p>
          ) : (
            <SolidPillLink
              href="/identity/legacy/new?mode=self"
              label="Start the walk"
              tone="teal"
            />
          )}
        </PathCardShell>

        {/* Card 4 — legacy for someone else. Always $5, charged at
            Finish by the existing other_identity_create flow — the
            picker just previews the cost. Coral CTA to match mobile. */}
        <PathCardShell
          title="For someone you love"
          subhead="Forty-five questions about a real person &mdash; a parent, a partner, a friend. Lands in your contacts, plus a code you can share with family."
          icon={<InfinityIcon />}
          statusLabel={`$${legacyOtherCents / 100} when you finish`}
        >
          <SolidPillLink
            href="/identity/legacy/new?mode=other"
            label="Start the walk"
            tone="coral"
          />
        </PathCardShell>
      </div>
    </main>
  );
}

/**
 * Card shell — mirrors mobile's PathCard exactly.
 *  - 22px radius, 18px padding, warm-700 hairline ring, inkSoft fill.
 *  - Icon square is 44x44 with a coral-tinted (12% alpha) fill and a
 *    14px radius. Icons paint their own color (coral-strong or
 *    teal-strong) via currentColor so they read on the coral tint.
 *  - Title 17/bold, subhead 14/leading-5, status pill 11/semibold in
 *    warm-700 with warm-200 text.
 *  - CTA row sits below the header block with 14px margin-top.
 */
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
  /** Omitted entirely when there is nothing honest to say — an absent
   *  chip beats a chip that implies free. See the card comments. */
  statusLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[22px] bg-ink-soft p-[18px] ring-1 ring-warm-700">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-coral/12"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px] font-bold tracking-[-0.3px] text-warm-50">
            {title}
          </span>
          <span className="mt-1 text-[14px] leading-5 text-warm-300">
            {subhead}
          </span>
          {statusLabel ? (
            <span className="mt-2.5 inline-flex w-fit items-center rounded-full bg-warm-700 px-2.5 py-1 text-[11px] font-semibold text-warm-200 ring-1 ring-warm-700">
              {statusLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

/**
 * Solid coral / teal pill CTA — matches the mobile CardCTA (flat
 * brand fill, NOT the sitewide gradient). 44px height, full-radius,
 * white text at 14/bold with a hair of negative tracking. Hover
 * dips to the -strong shade to mirror mobile's pressed state.
 */
function SolidPillLink({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: "coral" | "teal";
}) {
  const toneClasses =
    tone === "teal"
      ? "bg-teal hover:bg-teal-strong"
      : "bg-coral hover:bg-coral-strong";
  return (
    <Link
      href={href}
      className={`flex h-11 w-full items-center justify-center rounded-full text-sm font-bold tracking-[-0.2px] text-white transition-colors active:opacity-90 ${toneClasses}`}
    >
      {label}
    </Link>
  );
}

/**
 * Spark — mobile SparkIcon. Solid coral-strong fill at 22px.
 */
function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="currentColor"
      aria-hidden
      className="text-coral-strong"
    >
      <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
  );
}

/**
 * Photo — mobile PhotoIcon. Coral-strong 2px stroke, no lens
 * highlight dot (mobile is intentionally minimal here — just the
 * rectangle and the circle).
 */
function PhotoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-coral-strong"
    >
      <path d="M3 5h18v14H3z" />
      <path d="M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" />
    </svg>
  );
}

/**
 * Heart — mobile HeartTagIcon. Teal-strong stroke so the "Me" card
 * reads teal-leaning to match the teal Start-the-walk CTA below it.
 */
function HeartTagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="text-teal-strong"
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
