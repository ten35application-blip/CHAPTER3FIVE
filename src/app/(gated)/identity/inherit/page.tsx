import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requirePro } from "@/lib/subscription";
import { InheritForm } from "./InheritForm";

export const metadata = {
  title: "Inherit an identity · chapter3five",
};

/**
 * Redeem screen for inherit codes. Someone who loves you answered forty
 * questions and handed you a code — this is where you enter it. On success
 * the identity attaches to your account and you land in their chat.
 */
export default async function InheritPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // Inheriting a code requires Pro. Bounce to /upgrade before we show
  // the form so nobody types in a code only to hit a 403 from the
  // action. Wilson's rule: talking to a family member's identity is
  // paid-only, always.
  const gate = await requirePro("/identity/inherit");
  if (!gate.ok) {
    redirect(gate.redirectTo);
  }

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

        {error ? (
          <div className="mt-6 w-full rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-strong ring-1 ring-coral/25">
            {error}
          </div>
        ) : null}

        <div className="mt-8 w-full">
          <InheritForm />
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
