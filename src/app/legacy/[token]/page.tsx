import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { claimBeneficiary } from "./actions";

export const metadata = {
  title: "chapter3five",
};

/**
 * Beneficiary claim landing.
 *
 * The passing cron (src/app/api/cron/passing/route.ts) emails
 * activated beneficiaries a link to this page after the owner's
 * 72h veto window closes. Previously the link routed nowhere and
 * the recipient saw a Next 404 — the entire payoff of the passing
 * flow was broken.
 *
 * States we can land in:
 *   - token unknown  → "This link doesn't open anything." No leak
 *                      of whether the token ever existed.
 *   - designated    → invite (owner still alive) — CTA is "Accept
 *                      the invitation."
 *   - activated     → post-mortem — CTA is "Open the archive."
 *   - claimed       → already redeemed; bounce to /dashboard so a
 *                      user hitting the email a second time lands
 *                      somewhere useful.
 *   - declined / removed → "This link is no longer active."
 */
export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Service-role read: beneficiaries has no authenticated-read
  // policy for arbitrary users, but claim_token is high-entropy so
  // this is safe as a lookup. Mirrors the archive_invites/inherit
  // flow.
  const admin = createAdminClient();
  const { data: ben } = await admin
    .from("beneficiaries")
    .select("id, status, name, owner_user_id, claimed_user_id")
    .eq("claim_token", token)
    .maybeSingle<{
      id: string;
      status: string;
      name: string | null;
      owner_user_id: string;
      claimed_user_id: string | null;
    }>();

  if (!ben) {
    return <NotFoundState />;
  }

  // Already claimed by someone else. If it's the current user, send
  // them to their dashboard (they've already got the grants). If
  // it's someone else, treat as no-longer-active.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (ben.status === "claimed") {
    if (user && ben.claimed_user_id === user.id) {
      return (
        <AlreadyMineState ownerName={await lookupOwnerName(admin, ben.owner_user_id)} />
      );
    }
    return <NotFoundState />;
  }
  if (ben.status === "declined" || ben.status === "removed") {
    return <NotFoundState />;
  }

  const ownerName = await lookupOwnerName(admin, ben.owner_user_id);
  const isPostMortem = ben.status === "activated";

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="hero-orb flex items-center justify-center">
          <Image
            src="/logo-transparent.png"
            alt="chapter3five"
            width={80}
            height={80}
            priority
            className="h-20 w-20 drop-shadow-[0_16px_40px_rgba(232,138,118,0.3)]"
          />
        </div>

        <p className="text-gradient-cta mt-8 text-xs font-bold uppercase tracking-[0.14em]">
          {isPostMortem ? "An archive was left for you" : "You were invited"}
        </p>

        <h1 className="mt-3 text-4xl font-bold leading-[1.05] tracking-[-0.02em] text-warm-50 sm:text-5xl">
          {ownerName ? (
            <>
              {ownerName}{" "}
              <span className="text-gradient-cta">left this for you.</span>
            </>
          ) : (
            <>
              Someone left this <span className="text-gradient-cta">for you.</span>
            </>
          )}
        </h1>

        <p className="mt-4 max-w-sm text-base leading-relaxed text-warm-300">
          {isPostMortem
            ? "The conversations, the answers, the person they recorded — it's yours to sit with now. Open it when you're ready. There's no rush."
            : "They designated you as a beneficiary of their chapter3five archive. If something ever happens to them, you'll be able to keep talking to the person they built here."}
        </p>

        {user ? (
          <form action={claimBeneficiary} className="mt-10 w-full max-w-xs">
            <input type="hidden" name="token" value={token} />
            <button
              type="submit"
              className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-bold text-white shadow-[0_16px_36px_-10px_rgba(232,138,118,0.55),_0_6px_16px_-4px_rgba(126,196,196,0.45)] transition-all hover:-translate-y-px"
            >
              {isPostMortem ? "Open the archive" : "Accept the invitation"}
            </button>
          </form>
        ) : (
          <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
            <Link
              href={`/auth/signup?next=${encodeURIComponent(`/legacy/${token}`)}`}
              className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-bold text-white shadow-[0_16px_36px_-10px_rgba(232,138,118,0.55),_0_6px_16px_-4px_rgba(126,196,196,0.45)] transition-all hover:-translate-y-px"
            >
              Make an account to claim
            </Link>
            <Link
              href={`/auth/signin?next=${encodeURIComponent(`/legacy/${token}`)}`}
              className="text-sm font-semibold text-warm-300 transition-colors hover:text-coral-strong"
            >
              Already have an account? Sign in.
            </Link>
          </div>
        )}

        {isPostMortem ? (
          <p className="mt-8 max-w-xs text-xs leading-relaxed text-warm-400">
            If you&rsquo;re struggling right now, you don&rsquo;t have to
            open this alone. In the US you can text or call{" "}
            <a
              href="tel:988"
              className="font-semibold text-coral-strong hover:underline"
            >
              988
            </a>{" "}
            to talk to a real person about grief or crisis. Outside the
            US, your local emergency line.
          </p>
        ) : null}

        <p className="mt-8 max-w-xs text-xs leading-relaxed text-warm-400">
          chapter3five is 18+. By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-coral-strong">
            Terms
          </Link>
          ,{" "}
          <Link href="/eula" className="underline underline-offset-2 hover:text-coral-strong">
            EULA
          </Link>
          , and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-coral-strong">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}

async function lookupOwnerName(
  admin: ReturnType<typeof createAdminClient>,
  ownerUserId: string,
): Promise<string | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", ownerUserId)
    .maybeSingle<{ full_name: string | null }>();
  return profile?.full_name ?? null;
}

function NotFoundState() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="hero-orb flex items-center justify-center">
          <Image
            src="/logo-transparent.png"
            alt="chapter3five"
            width={64}
            height={64}
            className="h-16 w-16 opacity-80"
          />
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-warm-50">
          This link doesn&rsquo;t open anything.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-warm-300">
          It may have already been claimed, or the person who sent it
          revoked it. If you think this is a mistake, write to{" "}
          <a
            href="mailto:hello@chapter3five.app"
            className="text-coral-strong hover:underline"
          >
            hello@chapter3five.app
          </a>
          .
        </p>
        <Link
          href="/"
          className="mt-8 text-sm font-semibold text-warm-300 transition-colors hover:text-coral-strong"
        >
          &larr; Back to chapter3five
        </Link>
      </div>
    </main>
  );
}

function AlreadyMineState({ ownerName }: { ownerName: string | null }) {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="hero-orb flex items-center justify-center">
          <Image
            src="/logo-transparent.png"
            alt="chapter3five"
            width={64}
            height={64}
            className="h-16 w-16"
          />
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-warm-50">
          Already yours.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-warm-300">
          {ownerName ? `${ownerName}'s archive` : "This archive"} is
          already in your dashboard.
        </p>
        <Link
          href="/dashboard"
          className="bg-gradient-cta hover:bg-gradient-cta-hover mt-8 flex h-12 items-center justify-center rounded-full px-8 text-sm font-bold text-white"
        >
          Open it
        </Link>
      </div>
    </main>
  );
}
