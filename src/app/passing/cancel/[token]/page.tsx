import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Orb } from "@/components/Orb";
import { vetoPassingReport } from "./actions";

export const metadata = {
  title: "Confirm you're here — chapter3five",
};

export default async function PassingCancelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("passing_reports")
    .select(
      "id, owner_user_id, reporter_email, reporter_name, passed_on, notes, status, submitted_at, veto_deadline",
    )
    .eq("veto_token", token)
    .maybeSingle();

  if (!report) notFound();
  if (report.status === "vetoed") {
    redirect("/passing/cancel/result?state=already");
  }
  if (report.status === "confirmed") {
    redirect("/passing/cancel/result?state=expired");
  }

  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("oracle_name")
    .eq("id", report.owner_user_id)
    .maybeSingle();

  const reporterLabel = report.reporter_name
    ? `${report.reporter_name} (${report.reporter_email})`
    : report.reporter_email;

  const deadline = new Date(report.veto_deadline);
  const hoursLeft = Math.max(
    0,
    Math.round((deadline.getTime() - Date.now()) / 3_600_000),
  );

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
          Are you there, {ownerProfile?.oracle_name ?? "friend"}?
        </h1>
        <p className="text-warm-200 leading-relaxed mb-2">
          Someone reported your passing on chapter3five. If you&rsquo;re
          reading this — you&rsquo;re obviously not gone, so click below
          to dismiss it.
        </p>
        <p className="text-warm-300 text-sm mb-8">
          {hoursLeft > 0
            ? `You have about ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} left.`
            : "Your window is about to close. Cancel now."}
        </p>

        <div className="bg-warm-700/15 border border-warm-700/40 rounded-2xl p-5 mb-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-warm-300">
            What we received
          </p>
          <p className="text-sm text-warm-100">
            <span className="text-warm-300">Submitted by:</span>{" "}
            {reporterLabel}
          </p>
          {report.passed_on && (
            <p className="text-sm text-warm-100">
              <span className="text-warm-300">Date reported:</span>{" "}
              {report.passed_on}
            </p>
          )}
          {report.notes && (
            <p className="text-sm text-warm-100">
              <span className="text-warm-300">Notes:</span> {report.notes}
            </p>
          )}
        </div>

        <form action={vetoPassingReport}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="w-full h-12 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
          >
            I&rsquo;m here — cancel the report
          </button>
        </form>

        <p className="text-warm-400 text-xs leading-relaxed mt-6 text-center">
          If you don&rsquo;t cancel by{" "}
          {deadline.toUTCString()}, your beneficiaries will receive
          access to your archive and your account will be marked as
          passed.
        </p>
      </div>
    </main>
  );
}
