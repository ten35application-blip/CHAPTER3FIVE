import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CollapsibleSection } from "@/components/collapsible-section";
import { createClient } from "@/lib/supabase/server";
import {
  EXTRA_IDENTITY_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PRICING,
} from "@/lib/pricing";
import { ProfileEditor } from "./_components/ProfileEditor";

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

// Wilson's pricing today: 1 free forever, $5/month for 5 total
// (4 formula-generated + 1 made from an uploaded photo). No overage
// tier yet. Numbers live in src/lib/pricing.ts — change them there.
// TODO: wire subscription table — for now everyone is on Free plan.
const PLAN_NAME = "Free plan";
const PLAN_QUOTA = PRICING.totalIdentitiesPerPlan;

export default async function SettingsPage() {
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
  // one page view. Also pull full_name for the inline name editor.
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url, full_name")
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

  return (
    <main className="min-h-dvh flex-1 pb-16">
      {/* Header — small logo + back arrow, page title. Sits inline
          rather than as floating chrome; this is a sub-page. */}
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-6">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
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
          Your <span className="text-gradient-cta">settings</span>
        </h1>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-8">
        {/* PROFILE — inline photo + name editor. No sub-page. */}
        <Section label="Profile" accent="You" icon={<PersonIcon />}>
          <ProfileEditor
            photoUrl={avatarSignedUrl}
            initial={initial}
            fullName={fullName}
          />
        </Section>

        {/* PLAN — quota + upgrade CTA. */}
        <Section label="Plan" accent="chapter3five+" icon={<SparkIcon />}>
          <IconRow icon={<StarIcon />} label="Plan" value={PLAN_NAME} />
          <Divider />
          <IconRow
            icon={<PeopleIcon />}
            label="Identities"
            value={`${count} of ${PLAN_QUOTA}`}
          />
          <div className="px-4 py-4">
            <Link
              href="/upgrade"
              className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_14px_36px_-10px_rgba(232,138,118,0.55),_0_4px_12px_rgba(126,196,196,0.15)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90"
            >
              Upgrade to chapter3five+
            </Link>
            <p className="mt-3 text-center text-xs text-warm-300">
              {MONTHLY_PRICE_LABEL}/month for {PRICING.formulaIdentitiesPerPlan}{" "}
              identities plus one made from a photo. Extras{" "}
              {EXTRA_IDENTITY_PRICE_LABEL}/mo each. Cancel anytime.
            </p>
          </div>
        </Section>

        {/* ACCOUNT — email lives here per Wilson (name lives up in
            Profile alongside the photo). Password change isn't wired
            yet — dropping the dead row until it is. */}
        <Section label="Account" accent="secure" icon={<KeyIcon />}>
          <IconRow icon={<MailIcon />} label="Email" value={email} />
        </Section>

        {/* HOW THIS WORKS — collapsible per Wilson (default open). */}
        <CollapsibleSection
          storageKey="settings.how-this-works"
          label="How this works"
        >
          <div className="mt-2 overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700/60">
            <IconNavRow
              href="/settings/tutorial"
              icon={<CompassIcon />}
              label="Tutorial"
              value="How to use chapter3five"
            />
            <Divider />
            <IconNavRow
              href="/settings/help"
              icon={<HeartIcon />}
              label="Get help"
              value="Contact us"
            />
          </div>
        </CollapsibleSection>

        {/* THE FINE PRINT — legal docs, collapsible per Wilson. */}
        <CollapsibleSection
          storageKey="settings.fine-print"
          label="The fine print"
        >
          <div className="mt-2 overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700/60">
            <IconNavRow
              href="/terms"
              icon={<ShieldIcon />}
              label="Terms of Service"
              value="Read"
            />
            <Divider />
            <IconNavRow
              href="/privacy"
              icon={<LockIcon />}
              label="Privacy Policy"
              value="Read"
            />
            <Divider />
            <IconNavRow
              href="/guidelines"
              icon={<HeartIcon />}
              label="Community Guidelines"
              value="Read"
            />
          </div>
        </CollapsibleSection>

        {/* DANGER ZONE — sign out is soft. Delete is permanent and
            unambiguous per Wilson's directive: identities go with it,
            money spent is not refunded, account cannot be recovered.
            The confirmation copy lives on /settings/delete. */}
        <section>
          <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-warm-300">
            Danger <span className="text-coral-strong">zone</span>
          </h2>
          <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700/60">
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center px-4 py-3 text-left text-base font-medium text-red-500 first:rounded-t-2xl last:rounded-b-2xl hover:bg-warm-700/20"
              >
                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                  <SignOutIcon />
                </span>
                Sign out
              </button>
            </form>
            <Divider />
            <Link
              href="/settings/delete"
              className="flex items-center px-4 py-3 text-base font-medium text-red-500 first:rounded-t-2xl last:rounded-b-2xl hover:bg-warm-700/20"
            >
              <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <TrashIcon />
              </span>
              Delete account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Card-style section with a warm gradient-tinted header. `accent` is
 * the highlighted word; keep it short (1–2 words) so the header stays
 * calm. `icon` renders in a coral-tinted bubble to the left of the
 * label — mirrors the HubSheet menu-row treatment for consistency.
 */
function Section({
  label,
  accent,
  icon,
  children,
}: {
  label: string;
  accent?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 px-4 text-xs font-semibold uppercase tracking-wider text-warm-300">
        {icon ? (
          <span
            aria-hidden
            className="bg-coral/12 text-gradient-cta flex h-6 w-6 items-center justify-center rounded-full"
          >
            {icon}
          </span>
        ) : null}
        <span>{label}</span>
        {accent ? (
          <span className="text-gradient-cta font-bold normal-case tracking-normal">
            {accent}
          </span>
        ) : null}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700/60">
        {children}
      </div>
    </section>
  );
}

function IconRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="bg-coral/12 text-gradient-cta flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
      >
        {icon}
      </span>
      <span className="flex-1 text-base font-medium text-warm-50">
        {label}
      </span>
      <span className="max-w-[55%] truncate text-base text-warm-300">
        {value}
      </span>
    </div>
  );
}

function IconNavRow({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 hover:bg-coral/5"
    >
      <span
        aria-hidden
        className="bg-coral/12 text-gradient-cta flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full"
      >
        {icon}
      </span>
      <span className="flex-1 text-base font-medium text-warm-50">
        {label}
      </span>
      <span className="max-w-[45%] truncate text-base text-warm-300">
        {value}
      </span>
      <Chevron />
    </Link>
  );
}

function Divider() {
  return <div className="mx-4 h-px bg-warm-700/60" />;
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
      className="ml-2 text-warm-400"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/* ================================================================== */
/* Icons — small stroke-only glyphs, sized 16×16, colored by parent.  */
/* ================================================================== */

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
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

function PeopleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
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

function KeyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15 21 2" />
      <path d="M18 5l3 3" />
      <path d="M15 8l3 3" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
      width="14"
      height="14"
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

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
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

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
