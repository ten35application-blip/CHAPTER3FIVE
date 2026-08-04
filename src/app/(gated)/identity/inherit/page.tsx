import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INHERITED_SLOT_PRICE_LABEL } from "@/lib/pricing";
import { getInheritedSlotCredits } from "@/lib/subscription";
import { InheritForm } from "./InheritForm";

export const metadata = {
  title: "Inherit an identity · chapter3five",
};

/**
 * Redeem screen for inherit codes. Someone who loves you answered forty-five
 * questions and handed you a code — this is where you enter it. On success
 * the identity attaches to your account and you land in their chat.
 */
export default async function InheritPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    purchased?: string;
    code?: string;
  }>;
}) {
  const { error, purchased, code: prefillCode } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // Durable proof they actually paid — see the note on skipConsent.
  const hasSlotCredit = (await getInheritedSlotCredits(user.id)) > 0;

  // NO tier gate here since the July 2026 second rework — redemption
  // is paid per code, not per plan: every new redemption consumes one
  // purchased inherit-slot credit ($5 one-time, flat, no waivers; the
  // action bounces credit-less users to
  // /upgrade?reason=inherited-slot). ?purchased=1 is the Stripe
  // success return — the webhook is granting the credit while this
  // renders, so we welcome them back to the code they were holding.

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-md flex-col items-center text-center">
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

        <h1 className="mt-8 text-3xl font-semibold tracking-tight text-warm-50">
          Someone left this for you.
        </h1>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-warm-300">
          Enter the code they shared with you, and the person they kept will
          join your messages.
        </p>

        {purchased === "1" ? (
          <div className="mt-6 w-full rounded-2xl bg-teal/10 px-4 py-3 text-sm font-medium text-teal-strong ring-1 ring-teal/25">
            Your {INHERITED_SLOT_PRICE_LABEL} slot is ready &mdash; enter
            the code below to bring them in.
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 w-full rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-strong ring-1 ring-coral/25">
            {error}
          </div>
        ) : null}

        <div className="mt-8 w-full">
          <InheritForm
          prefillCode={prefillCode ?? ""}
          // CONSENT SKIP REQUIRES A REAL CREDIT, NOT A URL PARAM.
          //
          // This was `purchased === "1"` alone, which meant a crafted
          // link — /identity/inherit?purchased=1&code=chapter-… —
          // rendered the "$5 slot is ready" banner with no consent gate
          // and the sender's code prefilled, leaving the victim one
          // button from spending a credit and adding a stranger's
          // persona to their contacts. The gate's stated purpose is to
          // "prevent an accidental redeem".
          //
          // Embarrassingly, the same commit moved the PAID banner out
          // of the URL for exactly this reason and then moved this
          // INTO it. Both now read durable state.
          skipConsent={purchased === "1" && hasSlotCredit}
        />
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
