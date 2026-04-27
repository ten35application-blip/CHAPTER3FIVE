import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Orb } from "@/components/Orb";
import { submitPassingReport } from "../actions";

export const metadata = {
  title: "Report — chapter3five",
};

export default async function PassingReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const admin = createAdminClient();
  const { data: ben } = await admin
    .from("beneficiaries")
    .select("id, owner_user_id, name, email, status")
    .eq("claim_token", token)
    .maybeSingle();

  if (!ben) notFound();

  // Only allow reporting while owner is alive (status='designated').
  // If they've already been activated, the user should claim instead.
  if (ben.status !== "designated") {
    return (
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-3xl text-warm-50 mb-4">
            Nothing to report.
          </h1>
          <p className="text-warm-200 mb-8">
            This link is already active.
          </p>
          <Link
            href={`/legacy/${token}`}
            className="text-warm-200 underline underline-offset-2 hover:text-warm-100 text-sm"
          >
            Open it
          </Link>
        </div>
      </main>
    );
  }

  let ownerName: string | null = null;
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("oracle_name")
    .eq("id", ben.owner_user_id)
    .maybeSingle();
  ownerName = ownerProfile?.oracle_name ?? null;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
        <Orb size={460} />
      </div>

      <div className="relative w-full max-w-md flex flex-col">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12 text-center"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-3xl text-warm-50 mb-3">
          Report a passing.
        </h1>
        <p className="text-warm-200 leading-relaxed mb-2">
          We&rsquo;re sorry. Tell us about{" "}
          {ownerName ?? "the person who chose you"} so we can confirm.
        </p>
        <p className="text-warm-300 text-sm leading-relaxed mb-8">
          We&rsquo;ll email them with a 72-hour window to respond. If they
          do, the report is dismissed and the archive stays private. If
          they don&rsquo;t, you&rsquo;ll receive an access link.
        </p>

        <form
          action={submitPassingReport}
          className="space-y-4 bg-warm-700/15 border border-warm-700/40 rounded-2xl p-5"
        >
          <input type="hidden" name="token" value={token} />

          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-warm-300 mb-2">
              Your name
            </label>
            <input
              type="text"
              name="reporter_name"
              defaultValue={ben.name ?? ""}
              maxLength={120}
              required
              className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-warm-300 mb-2">
              Your email
            </label>
            <input
              type="email"
              name="reporter_email"
              defaultValue={ben.email ?? ""}
              maxLength={200}
              required
              className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-warm-300 mb-2">
              Date of passing
            </label>
            <input
              type="date"
              name="passed_on"
              required
              className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.2em] text-warm-300 mb-2">
              Notes (optional)
            </label>
            <textarea
              name="notes"
              maxLength={2000}
              rows={4}
              placeholder="Obituary link, funeral home, anything that helps confirm…"
              className="w-full rounded-2xl bg-warm-700/30 border border-warm-400/30 px-5 py-3 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm leading-relaxed"
            />
          </div>

          {error && <p className="text-sm text-red-300/80">{error}</p>}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              className="h-12 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
            >
              Submit report
            </button>
            <Link
              href={`/legacy/${token}`}
              className="text-center text-sm text-warm-200 hover:text-warm-100 underline underline-offset-2"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  );
}
