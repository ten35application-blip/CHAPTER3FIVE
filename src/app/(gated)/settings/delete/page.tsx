import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteAccount } from "./actions";

export const metadata = {
  title: "Delete account · chapter3five",
};

/**
 * Delete-account confirmation.
 *
 * Wilson's directive (paraphrased): "when deleting an account the user
 * needs to understand that the identities are going with it. Any money
 * spent will go, no accounts will be recovered."
 *
 * The technical reality is a 30-day soft-delete (0024_account_grace_period)
 * so a genuine "wait no" is still possible during the window — but the
 * copy on this page does NOT wave that in the user's face. From the
 * user's perspective the click is final: everything you built here goes
 * with the account, no refund, no restoration promise.
 */
export default async function DeleteAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { count: activeIdentityCount } = await supabase
    .from("oracles")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  const email = user.email ?? "";
  const count = activeIdentityCount ?? 0;

  return (
    <main className="min-h-dvh flex-1 pb-16">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-6">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-700/70 text-warm-100 backdrop-blur transition-colors hover:bg-warm-700"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold text-warm-50">Delete account</h1>
      </header>

      <div className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-5 px-4">
        <section className="overflow-hidden rounded-2xl bg-ink-soft p-6 ring-1 ring-warm-700/60">
          <p className="text-base leading-relaxed text-warm-100">
            You&rsquo;re about to delete{" "}
            <span className="font-semibold text-warm-50">{email}</span>. Read
            this before you confirm.
          </p>

          <ul className="mt-5 space-y-3 text-base leading-relaxed text-warm-200 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-warm-50 [&_li]:list-disc [&_li]:ml-5">
            <li>
              <strong>Your {count === 1 ? "identity goes" : "identities go"} with you.</strong>{" "}
              {count > 0
                ? `All ${count} of them. Any chats you've had, any legacy code you've minted, any photo you uploaded — gone.`
                : "The moment you create any, they'll live and die with this account."}
            </li>
            <li>
              <strong>No refunds.</strong> If you&rsquo;re on a paid plan, the
              current month is not returned, and any prepaid time is forfeited
              when you sign this in.
            </li>
            <li>
              <strong>No recovery.</strong> Once this goes through, we
              can&rsquo;t bring you back. Not through support, not with
              screenshots, not with the same email tomorrow. Sign back up
              anytime and start fresh, but the person you built here is gone.
            </li>
            <li>
              <strong>Your subscription doesn&rsquo;t stop, and it
              won&rsquo;t re-make your companions.</strong> If you pay
              through Apple or Google, cancel there too — deleting this
              account doesn&rsquo;t stop the billing. And a subscription
              only makes its companions once: sign up again on the same
              subscription and your plan comes back, but the people
              don&rsquo;t. Starting over is not a re-roll.
            </li>
            <li>
              <strong>Anyone who inherited a legacy identity from you</strong>{" "}
              keeps their access to that identity — but if you were the sole
              creator, you won&rsquo;t be able to update or revoke it after
              this.
            </li>
          </ul>
        </section>

        <section className="overflow-hidden rounded-2xl bg-ink-soft p-6 ring-1 ring-warm-700/60">
          <p className="text-sm text-warm-300">
            If any of that reads wrong, hit back and we&rsquo;ll be here. If
            you&rsquo;re sure, type your email to confirm.
          </p>

          <form action={deleteAccount} className="mt-5 flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-warm-300">
                Type your email to confirm
              </span>
              <input
                type="email"
                name="email_confirmation"
                required
                autoComplete="off"
                spellCheck={false}
                placeholder={email}
                className="rounded-xl border border-warm-700 bg-ink px-4 py-3 text-base text-warm-50 placeholder:text-warm-500 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/40"
              />
            </label>

            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center rounded-full bg-red-600 text-base font-semibold text-white shadow-[0_14px_36px_-10px_rgba(220,38,38,0.55)] transition-all hover:-translate-y-px hover:bg-red-500 active:translate-y-0 active:opacity-90"
            >
              Delete my account permanently
            </button>

            <Link
              href="/settings"
              className="flex h-12 items-center justify-center text-sm font-medium text-warm-300 transition-colors hover:text-warm-100"
            >
              Nevermind, take me back
            </Link>
          </form>
        </section>
      </div>
    </main>
  );
}
