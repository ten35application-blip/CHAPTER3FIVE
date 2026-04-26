import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { resolveCrisisFlag, resolveMessageReport } from "./actions";

export const metadata = {
  title: "Admin — chapter3five",
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    redirect("/");
  }

  const admin = createAdminClient();
  const now = Date.now();
  const sevenAgo = new Date(now - 7 * ONE_DAY_MS).toISOString();
  const thirtyAgo = new Date(now - 30 * ONE_DAY_MS).toISOString();
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();

  const [
    profilesCount,
    onboardedCount,
    realCount,
    randomizeCount,
    importCount,
    oraclesCount,
    answersCount,
    sharesActiveCount,
    sharesRevokedCount,
    activeLastSevenCount,
    outreachSentLast30,
    openCrisisCount,
    recentCrisis,
    openReportsCount,
    recentReports,
    recentSignups,
    paidPaymentsAll,
    paidPaymentsMonth,
    paidPaymentsWeek,
    pendingPaymentsCount,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("onboarding_completed", true),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("mode", "real"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("mode", "randomize"),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("mode", "import"),
    admin.from("oracles").select("id", { count: "exact", head: true }),
    admin.from("answers").select("id", { count: "exact", head: true }),
    admin.from("shares").select("id", { count: "exact", head: true }).is("revoked_at", null),
    admin.from("shares").select("id", { count: "exact", head: true }).not("revoked_at", "is", null),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_active_at", sevenAgo),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_outreach_at", thirtyAgo),
    admin
      .from("crisis_flags")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null),
    admin
      .from("crisis_flags")
      .select("id, user_id, message_excerpt, triggered_keywords, flagged_at, resolved_at")
      .order("flagged_at", { ascending: false })
      .limit(20),
    admin
      .from("message_reports")
      .select("id", { count: "exact", head: true })
      .is("resolved_at", null),
    admin
      .from("message_reports")
      .select("id, user_id, message_content, reason, reported_at, resolved_at")
      .order("reported_at", { ascending: false })
      .limit(20),
    admin
      .from("profiles")
      .select("id, oracle_name, mode, preferred_language, created_at, onboarding_completed")
      .order("created_at", { ascending: false })
      .limit(15),
    admin.from("payments").select("amount_cents").eq("status", "paid"),
    admin
      .from("payments")
      .select("amount_cents")
      .eq("status", "paid")
      .gte("paid_at", startOfMonth),
    admin
      .from("payments")
      .select("amount_cents")
      .eq("status", "paid")
      .gte("paid_at", sevenAgo),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const stat = (n: { count?: number | null }) => n.count ?? 0;
  const sumCents = (rows: { data?: { amount_cents: number }[] | null }) =>
    (rows.data ?? []).reduce((acc, r) => acc + (r.amount_cents ?? 0), 0);

  const revenueAllCents = sumCents(paidPaymentsAll);
  const revenueMonthCents = sumCents(paidPaymentsMonth);
  const revenueWeekCents = sumCents(paidPaymentsWeek);
  const paidCount = (paidPaymentsAll.data ?? []).length;

  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            chapter3five
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-warm-300">
            admin
          </span>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-12">
          {saved && (
            <div className="rounded-lg bg-warm-700/30 border border-warm-300/30 px-4 py-3 text-sm text-warm-100">
              Saved.
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-300/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Revenue
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Total revenue" value={fmtCents(revenueAllCents)} />
              <Stat label="This month" value={fmtCents(revenueMonthCents)} />
              <Stat label="Last 7 days" value={fmtCents(revenueWeekCents)} />
              <Stat label="Pending payments" value={stat(pendingPaymentsCount).toString()} />
            </div>
            <p className="mt-3 text-xs text-warm-400">
              {paidCount} paid randomize{paidCount === 1 ? "" : "s"} all-time.
            </p>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Users
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Total accounts" value={stat(profilesCount).toLocaleString()} />
              <Stat label="Completed onboarding" value={stat(onboardedCount).toLocaleString()} />
              <Stat label="Active in 7 days" value={stat(activeLastSevenCount).toLocaleString()} />
              <Stat label="Outreach sent (30d)" value={stat(outreachSentLast30).toLocaleString()} />
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Mode distribution
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Real" value={stat(realCount).toLocaleString()} />
              <Stat label="Randomize" value={stat(randomizeCount).toLocaleString()} />
              <Stat label="Import" value={stat(importCount).toLocaleString()} />
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Content
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Total thirtyfives" value={stat(oraclesCount).toLocaleString()} />
              <Stat label="Total answers" value={stat(answersCount).toLocaleString()} />
              <Stat label="Active share codes" value={stat(sharesActiveCount).toLocaleString()} />
              <Stat label="Revoked share codes" value={stat(sharesRevokedCount).toLocaleString()} />
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300">
                Crisis flags
              </h2>
              <p className="text-sm text-warm-200">
                <span className="text-warm-50 font-medium">
                  {stat(openCrisisCount)}
                </span>{" "}
                open / {recentCrisis.data?.length ?? 0} recent shown
              </p>
            </div>

            {recentCrisis.data && recentCrisis.data.length > 0 ? (
              <div className="space-y-3">
                {recentCrisis.data.map((flag) => (
                  <div
                    key={flag.id}
                    className={`rounded-2xl border p-4 ${
                      flag.resolved_at
                        ? "border-warm-700/60 bg-warm-700/10"
                        : "border-red-300/30 bg-red-900/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="text-xs text-warm-400">
                        {new Date(flag.flagged_at).toLocaleString()} · user{" "}
                        <code className="font-mono text-warm-300">
                          {flag.user_id.slice(0, 8)}
                        </code>
                      </div>
                      {flag.resolved_at ? (
                        <span className="text-xs uppercase tracking-wider text-warm-400">
                          resolved
                        </span>
                      ) : (
                        <span className="text-xs uppercase tracking-wider text-red-300">
                          open
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-warm-100 whitespace-pre-wrap break-words">
                      {flag.message_excerpt}
                    </p>
                    <div className="mt-2 text-xs text-warm-400">
                      Triggered:{" "}
                      <span className="font-mono">
                        {(flag.triggered_keywords ?? []).join(", ")}
                      </span>
                    </div>
                    {!flag.resolved_at && (
                      <form
                        action={resolveCrisisFlag}
                        className="mt-3 flex gap-2"
                      >
                        <input type="hidden" name="id" value={flag.id} />
                        <input
                          name="notes"
                          placeholder="Resolution notes (optional)"
                          maxLength={500}
                          className="flex-1 h-9 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                        />
                        <button
                          type="submit"
                          className="h-9 px-4 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm whitespace-nowrap"
                        >
                          Mark resolved
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">No crisis flags yet.</p>
            )}
          </section>

          <section>
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300">
                Reported messages
              </h2>
              <p className="text-sm text-warm-200">
                <span className="text-warm-50 font-medium">
                  {stat(openReportsCount)}
                </span>{" "}
                open / {recentReports.data?.length ?? 0} recent shown
              </p>
            </div>

            {recentReports.data && recentReports.data.length > 0 ? (
              <div className="space-y-3">
                {recentReports.data.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-2xl border p-4 ${
                      r.resolved_at
                        ? "border-warm-700/60 bg-warm-700/10"
                        : "border-warm-300/30 bg-warm-700/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="text-xs text-warm-400">
                        {new Date(r.reported_at).toLocaleString()} · user{" "}
                        <code className="font-mono text-warm-300">
                          {r.user_id.slice(0, 8)}
                        </code>
                      </div>
                      {r.resolved_at ? (
                        <span className="text-xs uppercase tracking-wider text-warm-400">
                          resolved
                        </span>
                      ) : (
                        <span className="text-xs uppercase tracking-wider text-warm-200">
                          open
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-warm-100 italic whitespace-pre-wrap break-words">
                      &ldquo;{r.message_content}&rdquo;
                    </p>
                    {r.reason && (
                      <p className="mt-2 text-xs text-warm-300">
                        Reason: {r.reason}
                      </p>
                    )}
                    {!r.resolved_at && (
                      <form
                        action={resolveMessageReport}
                        className="mt-3 flex gap-2"
                      >
                        <input type="hidden" name="id" value={r.id} />
                        <input
                          name="notes"
                          placeholder="Resolution notes (optional)"
                          maxLength={500}
                          className="flex-1 h-9 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                        />
                        <button
                          type="submit"
                          className="h-9 px-4 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm whitespace-nowrap"
                        >
                          Mark resolved
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">No reported messages.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Recent signups
            </h2>
            {recentSignups.data && recentSignups.data.length > 0 ? (
              <div className="space-y-1">
                {recentSignups.data.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <code className="font-mono text-xs text-warm-400">
                        {p.id.slice(0, 8)}
                      </code>
                      <span className="text-sm text-warm-100 truncate font-serif">
                        {p.oracle_name ?? "—"}
                      </span>
                      <span className="text-xs text-warm-400">{p.mode ?? "—"}</span>
                      <span className="text-xs text-warm-400">
                        {p.preferred_language ?? "—"}
                      </span>
                    </div>
                    <div className="text-xs text-warm-400 whitespace-nowrap">
                      {p.onboarding_completed ? "✓" : "—"}{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">No signups yet.</p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-warm-700/60 bg-warm-700/15 px-5 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-warm-400 mb-2">
        {label}
      </p>
      <p className="font-serif text-3xl text-warm-50 tabular-nums">{value}</p>
    </div>
  );
}
