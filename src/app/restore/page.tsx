import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";
import { startRestoreCheckout } from "./actions";

export const metadata = {
  title: "Restore your account — chapter3five",
};

export default async function RestorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      "/auth/signin?next=" + encodeURIComponent("/restore"),
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, deleted_at, scheduled_purge_at")
    .eq("id", user.id)
    .maybeSingle();

  // If they're not in the deleted state, send them home.
  if (!profile?.deleted_at) {
    redirect(success ? "/dashboard" : "/dashboard");
  }

  const purgeAt = profile.scheduled_purge_at
    ? new Date(profile.scheduled_purge_at)
    : null;
  const daysLeft = purgeAt
    ? Math.max(
        0,
        Math.ceil((purgeAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      )
    : 0;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 mb-4 leading-tight">
          <span className="italic font-light">It’s still here.</span>
        </h1>

        <p className="text-warm-200 leading-relaxed mb-2 max-w-sm">
          Your archive — the answers, the conversations, the memories
          {profile.oracle_name ? (
            <>
              {" "}
              between you and{" "}
              <span className="text-warm-100 font-serif">
                {profile.oracle_name}
              </span>
            </>
          ) : null}
          {" "}— is held safely.
        </p>

        <p className="text-warm-300 text-sm leading-relaxed mb-8 max-w-sm">
          {daysLeft > 0
            ? `You have ${daysLeft} day${daysLeft === 1 ? "" : "s"} left to bring it back. After that, it's gone for good.`
            : "Your grace period is up. We'll be purging shortly."}
        </p>

        <div className="rounded-2xl border border-warm-300/30 bg-warm-700/30 px-6 py-5 mb-8 text-left w-full">
          <p className="text-sm text-warm-200 leading-relaxed mb-1">
            Restore your account
          </p>
          <p className="font-serif text-3xl text-warm-50 mb-2">$5</p>
          <p className="text-xs text-warm-400 leading-relaxed">
            Covers the cost of keeping your data warm while you decide.
            Everything you’d built returns exactly as it was.
          </p>
        </div>

        {daysLeft > 0 && (
          <form action={startRestoreCheckout} className="w-full">
            <button
              type="submit"
              className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors w-full"
            >
              Bring it back
            </button>
          </form>
        )}

        <p className="mt-6 text-xs text-warm-400 leading-relaxed">
          Don’t want it back? Do nothing.{" "}
          {purgeAt && (
            <>
              On{" "}
              <span className="text-warm-300 font-mono">
                {purgeAt.toISOString().slice(0, 10)}
              </span>{" "}
              we’ll permanently delete your account, your archive, every
              answer, every message — irreversibly.
            </>
          )}
        </p>

        {error && <p className="mt-4 text-sm text-red-300/80">{error}</p>}
        {success && (
          <p className="mt-4 text-sm text-warm-100">
            Restored. Redirecting…
          </p>
        )}
      </div>
    </main>
  );
}
