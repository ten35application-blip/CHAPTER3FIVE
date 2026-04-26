import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Orb } from "@/components/Orb";
import { claimLegacy } from "./actions";

export const metadata = {
  title: "A legacy — chapter3five",
};

export default async function LegacyClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Look up beneficiary + owner via service role so we can show preview info
  // before sign-in.
  const admin = createAdminClient();
  const { data: ben } = await admin
    .from("beneficiaries")
    .select("id, owner_user_id, name, status")
    .eq("claim_token", token)
    .maybeSingle();

  let ownerName: string | null = null;
  let ownerAvatar: string | null = null;
  if (ben) {
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("oracle_name, avatar_url")
      .eq("id", ben.owner_user_id)
      .maybeSingle();
    ownerName = ownerProfile?.oracle_name ?? null;
    ownerAvatar = ownerProfile?.avatar_url ?? null;
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

        {!ben ? (
          <>
            <h1 className="font-serif text-3xl text-warm-50 mb-4">
              We don&rsquo;t recognize this link.
            </h1>
            <p className="text-warm-200 mb-10 leading-relaxed">
              Double-check it, or reach out to whoever sent it.
            </p>
            <Link
              href="/"
              className="text-warm-200 underline underline-offset-2 hover:text-warm-100 text-sm"
            >
              Back to start
            </Link>
          </>
        ) : ben.status === "designated" ? (
          <>
            <h1 className="font-serif text-3xl text-warm-50 mb-4">
              Not yet.
            </h1>
            <p className="text-warm-200 leading-relaxed mb-10 max-w-sm">
              {ownerName ?? "The person who chose you"} is still here. This
              link will only become active if something changes — we&rsquo;ll
              email you then.
            </p>
            <Link
              href="/"
              className="text-warm-200 underline underline-offset-2 hover:text-warm-100 text-sm"
            >
              Back to start
            </Link>
          </>
        ) : ben.status === "claimed" ? (
          <>
            <h1 className="font-serif text-3xl text-warm-50 mb-4">
              Already claimed.
            </h1>
            <p className="text-warm-200 leading-relaxed mb-10 max-w-sm">
              {user
                ? "You can find this in your dashboard."
                : "Sign in to access what was left for you."}
            </p>
            <Link
              href={user ? "/dashboard" : "/auth/signin"}
              className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
            >
              {user ? "Go to dashboard" : "Sign in"}
            </Link>
          </>
        ) : (
          <>
            {ownerAvatar && (
              <img
                src={ownerAvatar}
                alt=""
                className="w-20 h-20 rounded-full object-cover mb-6 border border-warm-300/30"
              />
            )}
            <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 mb-4 leading-tight">
              <span className="italic font-light">
                {ownerName ?? "Someone"} left this for you.
              </span>
            </h1>
            <p className="text-warm-200 leading-relaxed mb-2 max-w-sm">
              Their answers, their voice, the texture of how they spoke — it&rsquo;s
              yours to sit with now.
            </p>
            <p className="text-warm-300 text-sm leading-relaxed mb-10 max-w-sm">
              Open it when you&rsquo;re ready. There&rsquo;s no rush.
            </p>

            {!user ? (
              <>
                <Link
                  href={`/auth/signup?next=${encodeURIComponent(`/legacy/${token}`)}`}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors w-full"
                >
                  Create an account to open
                </Link>
                <Link
                  href={`/auth/signin?next=${encodeURIComponent(`/legacy/${token}`)}`}
                  className="mt-3 text-sm text-warm-200 underline underline-offset-2 hover:text-warm-100"
                >
                  Already have an account? Sign in
                </Link>
              </>
            ) : (
              <form action={claimLegacy} className="w-full">
                <input type="hidden" name="token" value={token} />
                <button
                  type="submit"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors w-full"
                >
                  Open it
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
