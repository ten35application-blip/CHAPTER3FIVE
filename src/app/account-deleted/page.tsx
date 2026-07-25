import Link from "next/link";

export const metadata = {
  title: "Account deleted · chapter3five",
};

/**
 * Post-deletion landing. Not gated (the user is signed out by the
 * time they arrive). Deliberately quiet.
 */
export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-dvh flex-1 items-center justify-center px-6 py-16">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <h1 className="text-3xl font-bold tracking-tight text-warm-50">
          You&rsquo;re out.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-warm-200">
          Your account and everything in it has been ended. We won&rsquo;t
          contact you again unless you come back and start over.
        </p>
        <p className="mt-3 text-sm text-warm-400">
          If you deleted by accident, write to{" "}
          <a
            href="mailto:support@chapter3five.app"
            className="font-semibold underline underline-offset-4 hover:text-coral-strong"
          >
            support@chapter3five.app
          </a>{" "}
          quickly and we&rsquo;ll do what we can.
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
