import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  EXTRA_IDENTITY_PRICE_LABEL,
  MONTHLY_PRICE_LABEL,
  PRICING,
} from "@/lib/pricing";

export const metadata = {
  title: "Settings · chapter3five",
};

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

  const email = user.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();
  const count = identityCount ?? 0;

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
          src="/logo.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 drop-shadow-[0_6px_16px_rgba(232,138,118,0.22)]"
        />
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-8">
        {/* PROFILE */}
        <Section label="Profile">
          <Link
            href="/settings/profile"
            className="flex items-center gap-4 px-4 py-3 first:rounded-t-2xl last:rounded-b-2xl hover:bg-warm-700/20"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber text-lg font-semibold text-white">
              {initial}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-base font-medium text-warm-50">
                {email}
              </span>
              <span className="text-sm text-warm-300">Name & Photo</span>
            </span>
            <Chevron />
          </Link>
        </Section>

        {/* PLAN */}
        <Section label="Plan">
          <Row label="Plan" value={PLAN_NAME} />
          <Divider />
          <Row label="Identities" value={`${count} of ${PLAN_QUOTA}`} />
          <div className="px-4 py-4">
            <Link
              href="/upgrade"
              className="flex h-14 w-full items-center justify-center rounded-full bg-amber text-base font-semibold text-white shadow-[0_14px_36px_-10px_rgba(107,140,175,0.55),_0_4px_12px_rgba(232,138,118,0.12)] transition-all hover:-translate-y-px hover:shadow-[0_18px_44px_-10px_rgba(107,140,175,0.6),_0_6px_14px_rgba(232,138,118,0.15)] active:translate-y-0 active:opacity-90"
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

        {/* ACCOUNT */}
        <Section label="Account">
          <NavRow href="/settings/email" label="Email" value={email} />
          <Divider />
          <NavRow href="/settings/password" label="Password" value="Change" />
        </Section>

        {/* HOW THIS WORKS — the tutorial + get-help hub. */}
        <Section label="How this works">
          <NavRow
            href="/settings/tutorial"
            label="Tutorial"
            value="How to use chapter3five"
          />
          <Divider />
          <NavRow
            href="/settings/help"
            label="Get help"
            value="Contact us"
          />
        </Section>

        {/* THE FINE PRINT — legal docs, in-app. Terms are gated on
            the current version constant, so the same links here also
            let users re-read what they accepted at signup. */}
        <Section label="The fine print">
          <NavRow href="/terms" label="Terms of Service" value="Read" />
          <Divider />
          <NavRow href="/privacy" label="Privacy Policy" value="Read" />
          <Divider />
          <NavRow
            href="/guidelines"
            label="Community Guidelines"
            value="Read"
          />
        </Section>

        {/* DANGER ZONE — sign out is soft. Delete is permanent and
            unambiguous per Wilson's directive: identities go with it,
            money spent is not refunded, account cannot be recovered.
            The confirmation copy lives on /settings/delete. */}
        <Section label="Danger zone">
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center px-4 py-3 text-left text-base font-medium text-red-500 first:rounded-t-2xl last:rounded-b-2xl hover:bg-warm-700/20"
            >
              Sign out
            </button>
          </form>
          <Divider />
          <Link
            href="/settings/delete"
            className="flex items-center px-4 py-3 text-base font-medium text-red-500 first:rounded-t-2xl last:rounded-b-2xl hover:bg-warm-700/20"
          >
            Delete account
          </Link>
        </Section>
      </div>
    </main>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-warm-300">
        {label}
      </h2>
      <div className="overflow-hidden rounded-2xl bg-ink-soft ring-1 ring-warm-700/60">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center px-4 py-3">
      <span className="flex-1 text-base text-warm-50">{label}</span>
      <span className="text-base text-warm-300">{value}</span>
    </div>
  );
}

function NavRow({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center px-4 py-3 hover:bg-warm-700/20"
    >
      <span className="flex-1 text-base text-warm-50">{label}</span>
      <span className="max-w-[55%] truncate text-base text-warm-300">
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
