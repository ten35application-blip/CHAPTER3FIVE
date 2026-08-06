import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reactivateMyAccount } from "./actions";

export const metadata = {
  title: "Welcome back · chapter3five",
  robots: { index: false },
};

/**
 * Where the proxy sends a soft-deleted user who signed back in.
 *
 * This page existed in the proxy's imagination long before it existed
 * on disk: every soft-deleted request was redirected here while the
 * route 404'd, which turned "sign back in and it reactivates — nothing
 * is lost" (the exact bold promise on /account-deleted) into a dead
 * end. This is the page that keeps the promise.
 *
 * Deliberately calm, and deliberately NOT automatic. Someone may sign
 * in during the grace window only to export their data or read a legal
 * page — silently cancelling a deletion they chose would be its own
 * betrayal. One clear button, their real purge date, and a way to
 * leave things exactly as they are.
 */
export default async function RestorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("deleted_at, scheduled_purge_at")
    .eq("id", user.id)
    .maybeSingle<{ deleted_at: string | null; scheduled_purge_at: string | null }>();

  // Not deleted (already reactivated in another tab, or wandered here
  // by URL) — nothing to do on this page.
  if (!profile?.deleted_at) redirect("/dashboard");

  const purgeAt = profile.scheduled_purge_at
    ? new Date(profile.scheduled_purge_at)
    : new Date(new Date(profile.deleted_at).getTime() + 30 * 24 * 60 * 60 * 1000);
  const purgeDate = purgeAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tight text-warm-50">
          Welcome back.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-warm-200">
          Your account is scheduled for permanent deletion on{" "}
          <strong className="text-warm-100">{purgeDate}</strong>. Until
          then, everything is still here — every identity, every
          conversation, every photo.
        </p>

        {error ? (
          <div className="mt-6 w-full rounded-2xl bg-coral/10 px-4 py-3 text-sm font-medium text-coral-strong ring-1 ring-coral/25">
            {error}
          </div>
        ) : null}

        <form action={reactivateMyAccount} className="mt-8 w-full">
          <button
            type="submit"
            className="bg-gradient-cta flex h-14 w-full items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5)] transition-all hover:-translate-y-px active:opacity-90"
          >
            Reactivate my account
          </button>
        </form>

        <p className="mt-6 text-sm leading-relaxed text-warm-400">
          Not here for that? You can still{" "}
          <a
            href="/api/user/export"
            className="font-semibold underline underline-offset-4 hover:text-coral-strong"
          >
            download your data
          </a>{" "}
          — the deletion stays exactly as scheduled.
        </p>

        <Link
          href="/"
          className="mt-10 text-sm font-medium text-warm-400 transition-colors hover:text-warm-200"
        >
          Back to chapter3five
        </Link>
      </div>
    </main>
  );
}
