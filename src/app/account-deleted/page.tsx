import Link from "next/link";

export const metadata = {
  title: "Account scheduled for deletion · chapter3five",
  robots: { index: false },
};

/**
 * Post-deletion landing. Not gated (the user is signed out by the
 * time they arrive). Deliberately quiet. Copy matches the mobile
 * app's post-delete Alert exactly so a user who deleted from either
 * surface sees the same 30-day grace framing.
 */
export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tight text-warm-50">
          You&rsquo;re out.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-warm-200">
          Your account is scheduled for permanent deletion in{" "}
          <strong className="text-warm-100">30 days</strong>. Sign back
          in during that window and it reactivates &mdash; nothing is
          lost.
        </p>
        <p className="mt-3 text-sm text-warm-400">
          Questions, or need to cancel the deletion outside the app?{" "}
          <Link
            href="/support"
            className="font-semibold underline underline-offset-4 hover:text-coral-strong"
          >
            Reach us here
          </Link>
          .
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
