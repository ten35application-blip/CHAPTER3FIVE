import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";
import { getPlanTier, isPro } from "@/lib/subscription";
import {
  PRICING,
} from "@/lib/pricing";
import { DataExportButton } from "./_components/DataExportButton";
import { InheritCodesList } from "./_components/InheritCodesList";
import { MintedBanner } from "./_components/MintedBanner";
import { NameField } from "./_components/NameField";
import { PasswordResetRow } from "./_components/PasswordResetRow";
import { PhotoUploader } from "./_components/PhotoUploader";
import { ThemeToggle } from "./_components/ThemeToggle";
import { TextSizeControl } from "./_components/TextSizeControl";
import { PushPermissionRow } from "./_components/PushPermissionRow";

export const metadata = {
  title: "Settings · chapter3five",
};

// Force a fresh render so profile-photo signed URLs are always current.
export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Wilson's pricing (July 2026 second rework): Free tier chats with
// Adrian only; Pro is $10/month for 4 formula + 1 photo (5
// self-created, what this constant counts). No inherited slot is
// bundled anymore — inherit codes are a flat $5 one-time unlock per
// code on every tier, no waivers. Numbers live in
// src/lib/pricing.ts -- change them there.
const PLAN_QUOTA = PRICING.totalIdentitiesPerPlan;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // `?debug=1` toggles the photo-widget's on-screen diagnostic panel so
  // Wilson can screenshot state changes on his phone. Any other value
  // (including missing) → no panel. Read from RSC searchParams because
  // the page is force-dynamic anyway.
  const sp = await searchParams;
  const debug = sp.debug === "1";
  // ?minted=<oracleId> — set by completeLegacyIdentity on success so
  // the user lands on Settings with a celebratory banner instead of
  // being dropped in cold. Normalize the shape (RSC searchParams can
  // hand us string[] too) before using it.
  const mintedParam = Array.isArray(sp.minted) ? sp.minted[0] : sp.minted;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // RLS restricts to auth.uid() = user_id; filter soft-deleted.
  const { count: identityCount } = await supabase
    .from("oracles")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  // Signed URL for the user's own profile photo (private bucket).
  // Same 1 h TTL as the chat-uploads history re-sign — plenty for
  // one page view. Also pull full_name for the inline name editor,
  // and the subscription mirror columns so the Plan block can render
  // "cancels on X" vs "renews on X" without a second round-trip.
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "avatar_url, full_name, stripe_customer_id, current_period_end, cancel_at_period_end, plan_source, trial_ends_at, outreach_enabled",
    )
    .eq("id", user.id)
    .maybeSingle();
  let avatarSignedUrl: string | null = null;
  if (profile?.avatar_url) {
    const { data: signed } = await supabase.storage
      .from("profile-avatars")
      .createSignedUrl(profile.avatar_url, 60 * 60);
    avatarSignedUrl = signed?.signedUrl ?? null;
  }

  const email = user.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();
  const count = identityCount ?? 0;
  const fullName = (profile?.full_name as string | null) ?? null;

  // Inherit codes for legacy identities THIS user minted (not ones
  // they've merely redeemed). Two thin queries mirror the dashboard
  // shape (dashboard/page.tsx:80-101) so a single index covers both
  // surfaces. Same-user RLS scopes the oracles read; the inherit_codes
  // read is filtered to those oracle ids so a stray policy change
  // can't leak someone else's codes here.
  // legacy_answers carries the subject blob including `mode`
  // ("self" | "other"), stamped by completeLegacyIdentity when a code
  // is minted. Selecting the jsonb column is cheap here — a user has
  // at most a small handful of legacy oracles.
  // inherited_at filter (0111): a REDEEMED copy is owned + is_legacy
  // too, but its code isn't the user's to reshare — inherit_codes RLS
  // (creator-only reads) already keeps the code invisible; this filter
  // makes the intent explicit and skips the pointless lookup.
  const { data: legacyRows } = await supabase
    .from("oracles")
    .select("id, name, created_at, legacy_answers")
    .eq("is_legacy", true)
    .is("inherited_at", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const legacyOracleIds = (legacyRows ?? []).map((r) => r.id as string);
  const codeByOracle = new Map<string, string>();
  if (legacyOracleIds.length > 0) {
    const { data: codeRows } = await supabase
      .from("inherit_codes")
      .select("code, oracle_id")
      .in("oracle_id", legacyOracleIds)
      .is("revoked_at", null);
    for (const c of codeRows ?? []) {
      if (typeof c.code === "string" && typeof c.oracle_id === "string") {
        codeByOracle.set(c.oracle_id, c.code);
      }
    }
  }
  // Legacy archives whose code mint FAILED (or was revoked) — they
  // exist, they're paid for, and they have nothing to share. Before
  // 2026-08-04 these were simply dropped from the list below, so the
  // slot rendered its "when you record someone, their code will appear
  // here" placeholder and the user had no idea anything had gone wrong.
  const codelessLegacy = (legacyRows ?? [])
    .filter((r) => !codeByOracle.get(r.id as string))
    .map((r) => {
      const answers = r.legacy_answers as
        | { subject?: { mode?: unknown } }
        | null;
      const rawMode = answers?.subject?.mode;
      return {
        oracleId: r.id as string,
        name: (r.name as string | null) ?? "Untitled",
        // Same bucketing as the coded items so the recovery card can
        // replace the right empty slot rather than sit beside it.
        mode:
          rawMode === "self" || rawMode === "other"
            ? (rawMode as "self" | "other")
            : null,
      };
    });

  const inheritCodeItems = (legacyRows ?? [])
    .map((r) => {
      const code = codeByOracle.get(r.id as string);
      if (!code) return null;
      // Pull mode out of the jsonb blob defensively — pre-toggle mints
      // don't carry it, and a corrupted blob shouldn't crash the page.
      const answers = r.legacy_answers as
        | { subject?: { mode?: unknown } }
        | null;
      const rawMode = answers?.subject?.mode;
      const mode: "self" | "other" | null =
        rawMode === "self" || rawMode === "other" ? rawMode : null;
      return {
        oracleId: r.id as string,
        name: (r.name as string | null) ?? "Untitled",
        code,
        mode,
      };
    })
    .filter(
      (x): x is {
        oracleId: string;
        name: string;
        code: string;
        mode: "self" | "other" | null;
      } => x !== null,
    );

  // If ?minted matches an identity the user actually owns, resolve
  // its name for the banner. Server-side lookup so we can't be
  // spoofed by a crafted URL naming someone else's oracle.
  const mintedItem = mintedParam
    ? inheritCodeItems.find((item) => item.oracleId === mintedParam) ?? null
    : null;

  const pro = await isPro(supabase);
  // Tier split (Basic vs Pro) for the plan label + identity quota.
  // isPro stays the paid/free gate; the tier refines the copy.
  const plan = await getPlanTier(supabase);
  const isBasicTier = plan.tier === "basic";

  // "Your agreements" receipts — one acceptance event covers the whole
  // 8-item onboarding bundle, version-stamped (0086). RLS: user reads own.
  const { data: latestAcceptance } = await supabase
    .from("terms_acceptances")
    .select("terms_version, accepted_at")
    .eq("user_id", user.id)
    .order("accepted_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ terms_version: string; accepted_at: string }>();
  const stripeCustomerId =
    (profile?.stripe_customer_id as string | null) ?? null;
  const planSource = (profile?.plan_source as string | null) ?? "none";
  const trialEndsAt = (profile?.trial_ends_at as string | null) ?? null;
  const trialActive =
    trialEndsAt !== null && new Date(trialEndsAt).getTime() > Date.now();

  // Admin allowlist wins BEFORE the trial check. Allowlisted admins
  // are Pro forever via isPro's isAdmin short-circuit, but many also
  // carry a stale trial_ends_at from before they were allowlisted —
  // without this ordering they'd see "Trial (free)" plus a Convert
  // pitch for a plan they can never fall off of.
  const admin = isAdmin(email);
  const planName = admin
    ? "Pro (admin)"
    : pro
      ? stripeCustomerId
        ? isBasicTier
          ? "Basic plan"
          : "Pro plan"
        : planSource === "admin_grant"
          ? "Pro (comped)"
          : trialActive
            ? "Trial (free)"
            : "Pro plan"
      : "Free plan";
  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const trialEndLabel = trialActive && trialEndsAt ? dateLabel(trialEndsAt) : null;

  return (
    <main className="min-h-dvh flex-1 pb-16">
      {/* Header — back chevron + plain page title. Deliberately quiet
          (no logo, no gradient) so the page reads as product chrome,
          not a marketing surface — the Instagram/Reddit settings
          register Wilson asked for (2026-07-27 redesign). */}
      <header className="mx-auto flex w-full max-w-2xl items-center gap-1 px-4 pt-10">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-warm-100 transition-colors hover:bg-warm-700/40"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold -tracking-[0.02em] text-warm-50">
          Settings
        </h1>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-7 px-4 pt-6">
        {mintedItem ? <MintedBanner name={mintedItem.name} /> : null}
        {/* PROFILE — everything about who you are + how you sign in.
            Photo, display name, email all live together. Wilson's ask
            2026-07-28: consolidated Account into Profile because
            "email under name" reads naturally as one identity block.
            Password change is a separate follow-up (needs a reset
            landing page, not just a UI row). */}
        <Section label="Profile">
          <PhotoUploader
            initialPhotoUrl={avatarSignedUrl}
            initial={initial}
            debug={debug}
          />
          <NameField fullName={fullName} />
          <Row icon={<MailIcon />} label="Email" value={email} />
          <PasswordResetRow email={email} />
        </Section>

        {/* INHERIT CODES — its own Section (Wilson's ask 2026-07-28:
            these are artifacts you've produced, not identity
            attributes; they deserve their own container next to Plan,
            not a nested slot inside Profile). Two-slot passive
            layout, no CTAs -- creation happens via the identity
            picker, not here. */}
        <Section label="Inherit codes">
          <InheritCodesList
            items={inheritCodeItems}
            codeless={codelessLegacy}
          />
        </Section>

        {/* PLAN — count + upgrade CTA. Identity row shows the raw
            count with descriptive text ("You have N identities") rather
            than "N of 5". Wilson's read: the quota framing feels
            restrictive, and it's especially wrong when N=0 (a "5 more
            before you need premium" nudge lands as tone-deaf on an
            empty account). Subtitle only appears when there's room
            left and at least one identity exists.
            LOCKED per Wilson 2026-07-26: "I love how the plans look" —
            the PlanCards / buttons / copy below must not change. Only
            the shared Section/Row chrome around them follows the
            grouped-list restyle. */}
        <Section label="Plan">
          <Row icon={<StarIcon />} label="Plan" value={planName} />
          {/* Renews-on/Cancels-on moved to /upgrade with the rest of
              the paying information (Wilson 2026-08-06). */}
          {pro && !admin && trialActive && trialEndLabel && !stripeCustomerId ? (
            <>
              <Divider />
              <Row
                icon={<StarIcon />}
                label="Trial ends"
                value={trialEndLabel}
              />
            </>
          ) : null}
          <Divider />
          <IdentityCountRow
            count={count}
            quota={
              isBasicTier ? PRICING.basicTotalIdentitiesPerPlan : PLAN_QUOTA
            }
            pro={pro}
          />
          {/* "Add a companion" removed 2026-08-04 (Wilson): settings
              is STATUS + subscription management ONLY. The picker
              lives on the dashboard's Contacts panel / account menu
              — settings never sells. Both surfaces match. */}
          <div className="px-4 py-4">
            {/* ONE MONEY HOME (Wilson 2026-08-06): usage meters,
                plans, packs, renewal date and the billing portal all
                live on /upgrade behind the dashboard chip. Settings
                keeps one signpost so anyone who comes here out of
                habit is a tap away. Mirrors mobile Settings exactly. */}
            <Link
              href="/upgrade"
              className="flex h-12 w-full items-center justify-center rounded-full text-[15px] font-semibold text-warm-100 ring-1 ring-warm-700 transition-colors hover:ring-coral/40"
            >
              Plan, usage &amp; billing
            </Link>
            <p className="mt-3 text-center text-xs text-warm-300">
              See this month&rsquo;s usage, change or cancel your plan,
              and grab add-on packs &mdash; all in one place.
            </p>
          </div>
        </Section>

        {/* Extra usage section removed 2026-08-03: add-on packs now
            live only on /upgrade, reachable via the dashboard chip. */}

        {/* NOTIFICATIONS — account-level opt-out for unprompted
            messages. Writes profiles.outreach_enabled, the column the
            outreach crons filter on, so OFF stops the message being
            composed at all rather than just hiding the banner. Mirrors
            the mobile Settings toggle (Wilson 2026-08-03: "make sure
            mobile settings and web settings both have the settings open
            for notifications"). */}
        {/* Wilson 2026-08-06: one combined row, same copy as mobile.
            Browser push permission is the OS-level switch here; the
            client component shows its live state and requests it when
            still undecided. The old outreach toggle is gone from the
            UI; profiles.outreach_enabled stays untouched server-side. */}
        <Section label="Notifications">
          <PushPermissionRow />
        </Section>

        {/* Parity with mobile's Permissions section — but a browser
            asks for camera/photos at the moment of use and keeps no
            app-wide switch, so the honest web version is one line of
            truth instead of dead toggles. */}
        <Section label="Permissions">
          <p className="px-4 py-4 text-sm leading-relaxed text-warm-300">
            Camera and photo access are asked by your browser at the
            moment you use them &mdash; nothing to manage here. On the
            phone app, these live in Settings &rarr; Permissions.
          </p>
        </Section>

        {/* Everything approved on the way to the dashboard — the
            receipts, with acceptance date + bundle version (mirrors
            mobile's "Your agreements"). */}
        <Section label="Your agreements">
          {latestAcceptance ? (
            <p className="px-4 pb-1 pt-3 text-xs text-warm-400">
              Accepted{" "}
              {new Date(latestAcceptance.accepted_at).toLocaleDateString(
                "en-US",
                { month: "long", day: "numeric", year: "numeric" },
              )}{" "}
              &middot; version {latestAcceptance.terms_version}
            </p>
          ) : null}
          <AgreementRow href="/terms" label="Terms of Service" />
          <AgreementRow href="/privacy" label="Privacy Policy" />
          <AgreementRow
            href="/privacy#anthropic"
            label="AI processing — Anthropic + OpenAI"
          />
          <AgreementRow href="/privacy#cookies" label="Cookie Policy" />
          <AgreementRow href="/eula" label="End User License Agreement" />
          <AgreementRow href="/guidelines" label="Community Guidelines" />
          <AgreementRow label="I am 18 or older" />
          <AgreementRow label="Not therapy or crisis support" />
        </Section>

        {/* APPEARANCE — theme picker. Client-only state; localStorage
            persists across visits; the inline script in RootLayout
            reapplies before first paint so there's no FOUC. */}
        <Section label="Appearance">
          <ThemeToggle />
          <div className="h-px bg-warm-700 opacity-70" />
          <TextSizeControl />
        </Section>

        {/* SAFETY — moderation posture + crisis lines. Ported from
            the mobile app (Bundle C). Read-only surface: filters are
            always-on server-side, so this section just tells the user
            what's scanned and how to Report / Block. Same warm register
            as the rest of Settings. */}
        <Section label="Safety">
          <div className="px-4 py-3.5">
            <p className="text-sm leading-relaxed text-warm-200">
              Every photo you share is scanned before it&rsquo;s sent.
              Every message a companion sends on its own (proactive
              check-ins, morning nods) is scanned before it reaches you.
              If something ever crosses a line, tap and hold the message
              to <strong className="font-bold">Report</strong>, or open a
              conversation&rsquo;s menu to{" "}
              <strong className="font-bold">Block</strong> the identity.
              A person reads every report &mdash; we aim to respond
              within 24 hours.
            </p>
            <p className="mt-2.5 text-xs leading-relaxed text-warm-400">
              In crisis? US 988 (call/text) &middot; UK Samaritans 116
              123 &middot; Mexico SAPTEL +52 55 5259-8121.
            </p>
          </div>
        </Section>

        {/* SUPPORT — was the "How this works" collapsible. Flattened
            to a plain section in the 2026-07-27 grouped-list redesign:
            two rows don't earn a disclosure control, and Instagram/
            Reddit-style settings never hide rows behind one. "Contact
            us" here absorbs the old fine-print Support group's
            duplicate row (both pointed at /settings/help). */}
        <Section label="Support">
          <NavRow href="/settings/tutorial" icon={<CompassIcon />} label="Tutorial" />
          <Divider />
          <NavRow href="/settings/help" icon={<HeartIcon />} label="Contact us" />
        </Section>

        {/* ABOUT & LEGAL — was "The fine print" collapsible. Full
            landing-footer inventory, kept per Wilson so a signed-in
            user never has to leave the app to find terms/privacy/
            about/etc. Flattened + trailing "Read" value-text dropped:
            label + chevron is the whole story for a nav row, and the
            uniform column of chevrons reads cleaner than repeated
            filler values. */}
        <Section label="About &amp; legal">
          <NavRow href="/about" icon={<InfoIcon />} label="About chapter3five" />
          <Divider />
          <NavRow href="/terms" icon={<ShieldIcon />} label="Terms of Service" />
          <Divider />
          <NavRow href="/privacy" icon={<LockIcon />} label="Privacy Policy" />
          <Divider />
          <NavRow
            href="/privacy#cookies"
            icon={<LockIcon />}
            label="Cookie Policy"
          />
          <Divider />
          <NavRow
            href="/eula"
            icon={<ShieldIcon />}
            label="End-User License Agreement"
          />
          <Divider />
          <NavRow
            href="/guidelines"
            icon={<HeartIcon />}
            label="Community Guidelines"
          />
          <Divider />
          <NavRow
            href="/data-deletion"
            icon={<TrashIcon />}
            label="Data deletion"
          />
          <Divider />
          <NavRow href="/advertise" icon={<MegaphoneIcon />} label="Advertise" />
        </Section>

        {/* YOUR DATA — GDPR / CCPA / Play Data Safety portability.
            The delete-account row still sits below in its red block,
            so this section is intentionally the export-only path. */}
        <Section label="Your data">
          <DataExportButton />
        </Section>

        {/* SIGN OUT — its own single-row card, centered label, no
            icon and no red: it's a way out, not a warning (Wilson:
            "not scary"). Sits above delete so the destructive row
            keeps the very bottom. */}
        <form action={signOut}>
          <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center px-4 text-[15px] font-medium text-warm-100 transition-colors hover:bg-warm-700/30"
            >
              Sign out
            </button>
          </div>
        </form>

        {/* DELETE — red row without the DANGER ZONE header per Wilson
            (2026-07-25): "if people want to delete their account it's
            cool. I like how it looks in red and in the bottom." The
            row itself carries the warning copy so the consequence is
            still clear at the tap-target. Red is the only non-neutral
            color on the page — reserved for the destructive action. */}
        <section>
          <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
            <Link
              href="/settings/delete"
              className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-[15px] font-medium text-[#c53a2f] transition-colors hover:bg-[#c53a2f]/5"
            >
              <span
                aria-hidden
                className="flex w-6 flex-shrink-0 items-center justify-center"
              >
                <TrashIcon />
              </span>
              Delete my account
            </Link>
            <p className="px-4 pb-4 text-xs leading-relaxed text-[#c53a2f]/70">
              Deleting your account will also delete every identity
              you&apos;ve made, every conversation, and every legacy
              code you&apos;ve shared. This cannot be undone.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Grouped-list section — small uppercase header above a plain card,
 * Reddit-settings style. No icons or accent words in the header; the
 * 2026-07-27 redesign keeps all color out of section chrome so the
 * rows themselves carry the page.
 */
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-warm-400">
        {label}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700">
        {children}
      </div>
    </section>
  );
}

/**
 * Static row: plain neutral icon, label, right-aligned value. 48px
 * minimum height for tap-target parity with the nav rows.
 */
function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
      <span
        aria-hidden
        className="flex w-6 flex-shrink-0 items-center justify-center text-warm-300"
      >
        {icon}
      </span>
      <span className="flex-1 text-[15px] font-medium text-warm-50">
        {label}
      </span>
      <span className="max-w-[55%] truncate text-sm text-warm-300">
        {value}
      </span>
    </div>
  );
}

/**
 * Identity count row — reads as an inventory ("You have 3
 * identities"), tier-aware below the fold:
 *   - Free: the "Room for N more on Free" nudge, only when the user
 *     has at least one identity AND there's room left. At N=0 we
 *     suppress it entirely — a "more before you'll need premium"
 *     prompt lands wrong on an empty account and Wilson called that
 *     out explicitly.
 *   - Pro (paid, comped, admin): the Free upsell line is wrong — the
 *     main line becomes "You have N of Y identities" against the
 *     plan ceiling instead. Past the ceiling (extra purchased slots)
 *     the "of Y" fraction would read as an error, so it drops back
 *     to the plain inventory line.
 */
function IdentityCountRow({
  count,
  quota,
  pro,
}: {
  count: number;
  quota: number;
  pro: boolean;
}) {
  // Copy 2026-08-03: was "You have 5 of 5 identities" — Wilson
  // (correctly) felt that read as a hard cap. Reworded to a status
  // ("in your circle") instead — extras above quota are always
  // buyable at $5, so the row shouldn't imply a ceiling. Matches the
  // mobile copy in chapter3five-app/app/settings.tsx byte-for-byte.
  const mainLine =
    count === 1
      ? "1 identity in your circle"
      : `${count} identities in your circle`;
  const remaining = Math.max(0, quota - count);
  const showRemaining = !pro && count > 0 && remaining > 0;
  return (
    <div className="flex min-h-12 items-center gap-3 px-4 py-2.5">
      <span
        aria-hidden
        className="flex w-6 flex-shrink-0 items-center justify-center text-warm-300"
      >
        <PeopleIcon />
      </span>
      <div className="flex flex-1 flex-col">
        <span className="text-[15px] font-medium text-warm-50">
          {mainLine}
        </span>
        {showRemaining ? (
          <span className="mt-0.5 text-xs text-warm-400">
            Room for {remaining} more on Free
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Navigable row: icon + label + chevron. No trailing value text —
 * dropped in the grouped-list redesign so nav rows scan as one clean
 * column (the old "Read" / "Our story" fillers added noise without
 * information).
 */
function NavRow({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-warm-700/30"
    >
      <span
        aria-hidden
        className="flex w-6 flex-shrink-0 items-center justify-center text-warm-300"
      >
        {icon}
      </span>
      <span className="flex-1 truncate text-[15px] font-medium text-warm-50">
        {label}
      </span>
      <Chevron />
    </Link>
  );
}

/** One checked acknowledgment from the onboarding bundle — tappable
 *  when a document backs it, plain and checked for the personal
 *  statements (18+, not-therapy). Mirrors mobile's AgreementRow. */
function AgreementRow({ href, label }: { href?: string; label: string }) {
  const inner = (
    <>
      <span
        aria-hidden
        className="flex w-6 flex-shrink-0 items-center justify-center text-teal-strong"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.2 14.4-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7Z" />
        </svg>
      </span>
      <span className="flex-1 truncate text-[14px] font-medium text-warm-50">
        {label}
      </span>
      {href ? <Chevron /> : null}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-3 px-4 py-2 transition-colors hover:bg-warm-700/30"
    >
      {inner}
    </Link>
  ) : (
    <div className="flex min-h-11 items-center gap-3 px-4 py-2">{inner}</div>
  );
}

/**
 * Hairline divider, inset to align with row text (16px padding + 24px
 * icon column + 12px gap = 52px) — the iOS grouped-list detail.
 */
function Divider() {
  return <div className="ml-[52px] h-px bg-warm-700/60" />;
}

function Chevron() {
  return (
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
      className="ml-2 flex-shrink-0 text-warm-500"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/* ================================================================== */
/* Icons — small stroke-only glyphs, sized 18×18, colored by parent   */
/* (rows tint them text-warm-300; the delete row inherits red).       */
/* ================================================================== */

function PeopleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <polyline points="22,7 12,13 2,7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function MegaphoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11v2a1 1 0 0 0 1 1h3l6 4V6L7 10H4a1 1 0 0 0-1 1z" />
      <path d="M17 8a5 5 0 0 1 0 8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
