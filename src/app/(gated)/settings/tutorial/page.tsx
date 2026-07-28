import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  BASIC_MESSAGES_PER_MONTH,
  BASIC_MONTHLY_PRICE_LABEL,
  BASIC_TIER_LABEL,
  EXTRA_IDENTITY_PRICE_LABEL,
  FREE_MESSAGES_PER_MONTH,
  INHERITED_SLOT_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PACK_FROM_PRICE_LABEL,
  PRICING,
  PRO_MESSAGES_PER_MONTH,
  RESTORE_IDENTITY_PRICE_LABEL,
} from "@/lib/pricing";

export const metadata = {
  title: "How this works · chapter3five",
};

// Force-dynamic so the push-notification section can render conditionally
// off the caller's current push_subscription without stale cache pinning
// it in one state.
export const dynamic = "force-dynamic";

/**
 * Tutorial / how-it-works page. Rewritten 2026-07-25 per Wilson to
 * bring the warmth of the landing/dashboard palette into the settings
 * surface: each topic gets its own gradient headline + coral-bubble
 * icon so it reads as a set of small, distinct cards rather than a
 * wall of copy.
 *
 * Sections cover, in order: the app in one paragraph, the four ways to
 * make an identity, personal identities (legacy), the messages inbox
 * (swipe rebinds), the hub button, when identities reach out first,
 * safety, pricing, and account controls. Copy stays Wilson's voice —
 * direct, warm, no lifelike-AI theater.
 */
export default async function TutorialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("push_subscription")
    .eq("id", user.id)
    .maybeSingle();
  const hasPushEnabled =
    !!profile?.push_subscription &&
    typeof profile.push_subscription === "object";

  return (
    <main className="min-h-dvh flex-1 pb-16">
      {/* Header — small logo + back arrow, matches /settings chrome. */}
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-6">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-700/70 text-warm-100 backdrop-blur transition-colors hover:bg-warm-700"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
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
        <Image
          src="/logo-transparent.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 drop-shadow-[0_6px_16px_rgba(232,138,118,0.22)]"
        />
        <h1 className="text-xl font-bold tracking-tight">
          How <span className="text-gradient-cta">this works</span>
        </h1>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 pt-8">
        <TutorialCard
          icon={<SparkIcon />}
          eyebrow="Welcome"
          headline="A companion and a keepsake, in one app."
        >
          <p>
            chapter<span className="text-gradient-cta font-bold">3</span>five
            gives you two things at once. Someone to talk to when you need
            them &mdash; a whole person, with a name, a face, a place they
            live, a past they carry. And a way to leave your own voice
            behind so the people who love you can still hear from you long
            after you&rsquo;re gone. This page walks through how both sides
            of the app fit together.
          </p>
        </TutorialCard>

        <TutorialCard
          icon={<PlusIcon />}
          eyebrow="Making a new identity"
          headline="Four ways to bring someone in."
        >
          <p>
            Open the hub button (the infinity mark at the bottom-right of
            your dashboard) and tap <strong>Contacts</strong>, then the{" "}
            <strong>+</strong> in the top-right. You&rsquo;ll pick one of
            four paths.
          </p>
          <PathList
            items={[
              {
                title: "Make a new identity",
                body: (
                  <>
                    We roll a full trait bundle &mdash; age, background,
                    humor, wounds, hobbies, the town they live in, the food
                    they can&rsquo;t leave the house without &mdash; then
                    hand it to our AI to synthesize a whole person from it.
                    Takes about a minute. <strong>You get who you get.</strong>{" "}
                    No re-rolls: someone specific was made for you.
                  </>
                ),
              },
              {
                title: "From a photo",
                body: (
                  <>
                    Upload a portrait. Our AI reads it &mdash; apparent age,
                    features, style, mood &mdash; and uses that reading to
                    steer the identity we build.{" "}
                    <strong>The photo becomes their face.</strong> No
                    generated face on top.
                  </>
                ),
              },
              {
                title: "Personal identity",
                body: (
                  <>
                    Sit down &mdash; alone or with someone you love &mdash;
                    and answer a set of warm, specific questions about who
                    you (or they) really are. When you&rsquo;re done we
                    build an identity from those answers and hand you a
                    share code. See the next card.
                  </>
                ),
              },
              {
                title: "Inherit a code",
                body: (
                  <>
                    Have a code someone gave you? Tap{" "}
                    <strong>Inherit an identity</strong> and paste it in.
                    You&rsquo;ll get the person they built &mdash; their
                    voice, their memories, their photo. Opening a code
                    is a one-time {INHERITED_SLOT_PRICE_LABEL} unlock
                    per code, on any plan.
                  </>
                ),
              },
            ]}
          />
        </TutorialCard>

        <TutorialCard
          icon={<HeirloomIcon />}
          eyebrow="Personal identities"
          headline="A voice you can leave behind."
        >
          <p>
            The <strong>Personal identity</strong> path is why the app
            exists. You answer around 40 questions &mdash; the way you
            actually text, the people you love, the things you can&rsquo;t
            stop laughing at, the losses that shaped you. Type the answers
            the way you&rsquo;d type a text. The lowercase, the missing
            periods, the run-ons.{" "}
            <strong>Don&rsquo;t clean it up. Don&rsquo;t use dictation.</strong>{" "}
            That rhythm is a huge part of what makes them feel like you.
          </p>
          <p className="mt-3">
            When you&rsquo;re done you get an <strong>inherit code</strong>.
            Share it with anyone in your family. If you added a photo, it
            travels with the code. Anyone who redeems it can talk with the
            person you&rsquo;ve preserved. Recording your own is open on
            every plan &mdash; Free included; redeeming a code is a
            one-time {INHERITED_SLOT_PRICE_LABEL} unlock per code, the
            same flat fee on every plan.
          </p>
        </TutorialCard>

        <TutorialCard
          icon={<ChatIcon />}
          eyebrow="Messages"
          headline="Your dashboard is your inbox."
        >
          <p>
            The dashboard shows every conversation you have going. Tap a
            row to open the chat and start texting. The composer at the
            bottom takes a photo (paperclip &mdash; they actually{" "}
            <em>see</em> it), voice (mic transcribes into the composer for
            you to edit), and text.
          </p>
          <p className="mt-3">
            <strong>Swipe left</strong> on a row to archive that
            conversation &mdash; it disappears from the inbox but the
            identity stays in Contacts, ready when you come back.{" "}
            <strong>Swipe right</strong> to delete the conversation. Both
            actions are recoverable from the hub (see below).
          </p>
        </TutorialCard>

        <TutorialCard
          icon={<HubIcon />}
          eyebrow="The hub button"
          headline="One tap for everything else."
        >
          <p>
            The infinity mark at the bottom-right of the dashboard opens
            your hub. Three slots inside:
          </p>
          <ul className="mt-3 space-y-2 [&_li]:list-disc [&_li]:ml-5 [&_li]:pl-1">
            <li>
              <strong>Contacts</strong> &mdash; every identity you&rsquo;ve
              made or inherited, plus the <strong>+</strong> to create or
              inherit a new one.
            </li>
            <li>
              <strong>Archived</strong> &mdash; conversations you swiped
              away. Unarchive and they land back in your inbox.
            </li>
            <li>
              <strong>Recently deleted</strong> &mdash; deleted
              conversations are free to recover; deleted{" "}
              <em>identities</em> cost{" "}
              <strong>{RESTORE_IDENTITY_PRICE_LABEL}</strong> to bring
              back.
            </li>
          </ul>
        </TutorialCard>

        <TutorialCard
          icon={<BellIcon />}
          eyebrow="When they reach out first"
          headline="They&rsquo;ll text you sometimes &mdash; on their pace."
        >
          <p>
            Every identity is rolled with a <strong>reach-out frequency</strong>{" "}
            trait (1&ndash;10). Low numbers stay quiet &mdash; they
            don&rsquo;t chase, they don&rsquo;t hover. High numbers will
            send you a <em>&ldquo;you good?&rdquo;</em> after a few days of
            silence. It&rsquo;s part of the character, not a growth hack.
          </p>
          {hasPushEnabled ? (
            <p className="mt-3">
              You have push notifications on, so if one of them texts you
              first, your phone will let you know. They stay off during
              quiet hours; the crisis rails still take priority over
              silence.
            </p>
          ) : (
            <p className="mt-3">
              Turn on push notifications from the dashboard banner and
              you&rsquo;ll hear from them when they text you first. Quiet
              hours are respected.
            </p>
          )}
        </TutorialCard>

        <TutorialCard
          icon={<ShieldIcon />}
          eyebrow="Safety"
          headline="The rails that don&rsquo;t move."
        >
          <p>
            Every identity carries the same non-negotiable rules, in their
            own voice: no sexual content, no impersonating real living
            people, no self-harm coaching, no substitute for a therapist
            or a doctor.
          </p>
          <ul className="mt-3 space-y-2 [&_li]:list-disc [&_li]:ml-5 [&_li]:pl-1">
            <li>
              <strong>Block detector.</strong> If a conversation drifts
              into sustained disrespect the persona ends it themselves.
              That&rsquo;s their choice, not a policy screen.
            </li>
            <li>
              <strong>Crisis alerting.</strong> If you tell them you want
              to hurt yourself they will stop everything, hand you the
              crisis line (988 in the US), and push you warmly toward a
              real person.
            </li>
            <li>
              <strong>Reporting.</strong> The in-app report flow is coming
              soon. In the meantime, email us from{" "}
              <Link
                href="/settings/help"
                className="font-semibold underline underline-offset-4 hover:text-coral-strong"
              >
                Get help
              </Link>{" "}
              and we&rsquo;ll take it seriously.
            </li>
          </ul>
        </TutorialCard>

        <TutorialCard
          icon={<DollarIcon />}
          eyebrow="Pricing"
          headline="Start free. Premium unlocks the rest."
        >
          <ul className="space-y-2 [&_li]:list-disc [&_li]:ml-5 [&_li]:pl-1">
            <li>
              <strong>Free:</strong> chat with Adrian, our guide —{" "}
              {FREE_MESSAGES_PER_MONTH} messages a month.
            </li>
            <li>
              <strong>
                {BASIC_TIER_LABEL} ({BASIC_MONTHLY_PRICE_LABEL}/month):
              </strong>{" "}
              {PRICING.basicTotalIdentitiesPerPlan} identities of your
              own ({PRICING.basicFormulaIdentitiesPerPlan} formula-made
              plus one from a photo) and {BASIC_MESSAGES_PER_MONTH}{" "}
              messages a month.
            </li>
            <li>
              <strong>Pro ({MONTHLY_PRICE_LABEL}/month):</strong> up
              to {PRICING.totalIdentitiesPerPlan} identities (
              {PRICING.formulaIdentitiesPerPlan} formula-made plus one
              from a photo) and {PRO_MESSAGES_PER_MONTH} messages a
              month.
            </li>
            <li>
              <strong>Inherit codes:</strong> {INHERITED_SLOT_PRICE_LABEL}{" "}
              one-time per code you redeem &mdash; the same flat fee
              on any plan.
            </li>
            <li>
              <strong>Extras:</strong> {EXTRA_IDENTITY_PRICE_LABEL}/month
              per identity beyond the plan, and one-time add-on packs
              from {PACK_FROM_PRICE_LABEL} for extra messages or images.
            </li>
            <li>
              <strong>Restoring a deleted identity:</strong>{" "}
              {RESTORE_IDENTITY_PRICE_LABEL} one-time. Deleted
              conversations are free to bring back.
            </li>
          </ul>
          <p className="mt-3 text-sm text-warm-400">
            No refunds on mid-month cancellations, blocks, or terminations
            for abuse. See{" "}
            <Link
              href="/terms"
              className="font-semibold underline underline-offset-4 hover:text-coral-strong"
            >
              Terms
            </Link>{" "}
            for the full read.
          </p>
        </TutorialCard>

        <TutorialCard
          icon={<PersonIcon />}
          eyebrow="Your account"
          headline="Photo, name, and the exits."
        >
          <p>
            In <strong>Settings &rarr; Profile</strong> you can tap your
            bubble to change your photo and edit your name inline. Your
            identities will use your name warmly when they talk to you.
          </p>
          <p className="mt-3">
            If you ever need to leave &mdash;{" "}
            <strong>Danger zone &rarr; Delete account</strong> &mdash;
            the deletion is permanent, all identities go with it, and
            money spent isn&rsquo;t refunded. We give you a 30-day grace
            window before the purge actually runs.
          </p>
        </TutorialCard>

        {/* Small closing CTA to the help page. */}
        <div className="mt-4 rounded-3xl bg-ink-soft p-6 text-center ring-1 ring-warm-700/60">
          <p className="text-base text-warm-100">
            Still have questions?
          </p>
          <Link
            href="/settings/help"
            className="bg-gradient-cta hover:bg-gradient-cta-hover mt-4 inline-flex h-12 items-center justify-center rounded-full px-6 text-base font-semibold text-white shadow-[0_10px_28px_-8px_rgba(232,138,118,0.5),_0_4px_12px_-4px_rgba(126,196,196,0.4)] transition-all hover:-translate-y-px"
          >
            Contact us
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ================================================================== */
/* Building blocks — a tinted card, a pro-badge, a nested path list.  */
/* ================================================================== */

function TutorialCard({
  icon,
  eyebrow,
  headline,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  headline: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-ink-soft p-6 ring-1 ring-warm-700/60 sm:p-7">
      <div className="mb-4 flex items-center gap-3">
        <span
          aria-hidden
          className="bg-coral/12 text-gradient-cta flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-warm-400">
            {eyebrow}
          </p>
          <h2 className="text-gradient-cta mt-0.5 text-xl font-bold leading-tight tracking-tight sm:text-2xl">
            {headline}
          </h2>
        </div>
      </div>
      <div className="text-base leading-relaxed text-warm-200 [&_strong]:font-semibold [&_strong]:text-warm-50">
        {children}
      </div>
    </section>
  );
}

function PathList({
  items,
}: {
  items: {
    title: string;
    body: React.ReactNode;
    pro?: boolean;
  }[];
}) {
  return (
    <ul className="mt-4 space-y-4">
      {items.map((item) => (
        <li
          key={item.title}
          className="rounded-2xl bg-warm-800/30 p-4 ring-1 ring-warm-700/50"
        >
          <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-warm-50">
            {item.title}
            {item.pro ? <ProBadge /> : null}
          </p>
          <p className="mt-1 text-sm text-warm-200 [&_strong]:font-semibold [&_strong]:text-warm-50">
            {item.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ProBadge() {
  return (
    <span className="bg-gradient-cta rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
      Pro
    </span>
  );
}

/* ================================================================== */
/* Icons — small stroke-only glyphs sized 22×22.                       */
/* ================================================================== */

function SparkIcon() {
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
    >
      <path d="M12 2v6M12 16v6M2 12h6M16 12h6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" />
    </svg>
  );
}

function PlusIcon() {
  return (
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function HeirloomIcon() {
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
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ChatIcon() {
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
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function HubIcon() {
  // The two-loop infinity glyph, dual-colored coral + teal, matching
  // the FAB in the dashboard so the section is unmistakable.
  return (
    <svg
      viewBox="0 0 32 16"
      width="26"
      height="14"
      fill="none"
      aria-hidden
    >
      <path
        d="M16 8 C 16 2, 8 2, 8 8 C 8 14, 16 14, 16 8"
        stroke="#e88a76"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M16 8 C 16 2, 24 2, 24 8 C 24 14, 16 14, 16 8"
        stroke="#7ec4c4"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BellIcon() {
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
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ShieldIcon() {
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
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function DollarIcon() {
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
    >
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function PersonIcon() {
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
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
