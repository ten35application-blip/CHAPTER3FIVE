import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Orb } from "@/components/Orb";
import { acceptArchiveInvite } from "./actions";

export const metadata = {
  title: "An invite — chapter3five",
};

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { code } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Look up invite via service role so we can show preview info even when
  // the user isn't authenticated yet (so they know what they're accepting).
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("archive_invites")
    .select("id, oracle_id, inviter_user_id, status")
    .eq("code", code)
    .maybeSingle();

  let oracleName: string | null = null;
  if (invite) {
    const { data: oracle } = await admin
      .from("oracles")
      .select("name")
      .eq("id", invite.oracle_id)
      .maybeSingle();
    oracleName = oracle?.name ?? null;
  }

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        {!invite ? (
          <>
            <h1 className="font-serif text-3xl text-warm-50 mb-4">
              We don&rsquo;t recognize this code.
            </h1>
            <p className="text-warm-200 mb-10 leading-relaxed">
              Double-check it, or ask the person who shared it for a fresh one.
            </p>
            <Link
              href="/"
              className="text-warm-200 underline underline-offset-2 hover:text-warm-100 text-sm"
            >
              Back to start
            </Link>
          </>
        ) : invite.status !== "pending" ? (
          <>
            <h1 className="font-serif text-3xl text-warm-50 mb-4">
              This invite&rsquo;s already used.
            </h1>
            <p className="text-warm-200 mb-10 leading-relaxed">
              {invite.status === "revoked"
                ? "The person who sent it revoked access."
                : "It was already accepted."}
            </p>
            <Link
              href="/dashboard"
              className="text-warm-200 underline underline-offset-2 hover:text-warm-100 text-sm"
            >
              Back to dashboard
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 mb-4 leading-tight">
              <span className="italic font-light">An invite.</span>
            </h1>
            <p className="text-warm-200 leading-relaxed mb-2 max-w-sm">
              You&rsquo;ve been invited to talk to{" "}
              <span className="text-warm-100 font-serif">
                {oracleName ?? "a thirtyfive"}
              </span>
              .
            </p>
            <p className="text-warm-300 text-sm leading-relaxed mb-10 max-w-sm">
              You&rsquo;ll get your own private conversation with them — no one
              else can see your messages. They&rsquo;re shared, you&rsquo;re
              private.
            </p>

            {!user ? (
              <>
                <Link
                  href={`/auth/signup?next=${encodeURIComponent(`/invite/${code}`)}`}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors w-full"
                >
                  Create an account to accept
                </Link>
                <Link
                  href={`/auth/signin?next=${encodeURIComponent(`/invite/${code}`)}`}
                  className="mt-3 text-sm text-warm-200 underline underline-offset-2 hover:text-warm-100"
                >
                  Already have an account? Sign in
                </Link>
              </>
            ) : (
              <form action={acceptArchiveInvite} className="w-full">
                <input type="hidden" name="code" value={code} />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors w-full"
                >
                  Accept invite
                </button>
              </form>
            )}

            {error && <p className="mt-4 text-sm text-red-300/80">{error}</p>}
          </>
        )}
      </div>
    </main>
  );
}
