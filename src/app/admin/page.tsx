import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { resolveCrisisFlag, resolveMessageReport } from "./actions";
import { lookupUser } from "./lookup/actions";

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
    invitesPendingCount,
    invitesAcceptedCount,
    grantsCount,
    beneficiariesDesignatedCount,
    beneficiariesActivatedCount,
    beneficiariesClaimedCount,
    deceasedCount,
    deceasedRecent,
    chatTodayCount,
    chatWeekRows,
    topChatUsersWeek,
    recentStripeEvents,
    cronOutreachLast,
    cronProactiveLast,
    emailRecent,
    emailFailedCount,
    emailSentTodayCount,
    auditRecent,
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
    admin
      .from("archive_invites")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    admin
      .from("archive_invites")
      .select("id", { count: "exact", head: true })
      .eq("status", "accepted"),
    admin.from("archive_grants").select("id", { count: "exact", head: true }),
    admin
      .from("beneficiaries")
      .select("id", { count: "exact", head: true })
      .eq("status", "designated"),
    admin
      .from("beneficiaries")
      .select("id", { count: "exact", head: true })
      .eq("status", "activated"),
    admin
      .from("beneficiaries")
      .select("id", { count: "exact", head: true })
      .eq("status", "claimed"),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("deceased_at", "is", null),
    admin
      .from("profiles")
      .select("id, oracle_name, deceased_at")
      .not("deceased_at", "is", null)
      .order("deceased_at", { ascending: false })
      .limit(10),
    admin
      .from("chat_usage")
      .select("message_count")
      .eq("day", new Date().toISOString().slice(0, 10)),
    admin
      .from("chat_usage")
      .select("message_count")
      .gte("day", new Date(now - 7 * ONE_DAY_MS).toISOString().slice(0, 10)),
    admin
      .from("chat_usage")
      .select("user_id, message_count")
      .gte("day", new Date(now - 7 * ONE_DAY_MS).toISOString().slice(0, 10))
      .order("message_count", { ascending: false })
      .limit(50),
    admin
      .from("stripe_events")
      .select("id, type, user_id, processed_at")
      .order("processed_at", { ascending: false })
      .limit(15),
    admin
      .from("cron_runs")
      .select("ran_at, status, processed, duration_ms, error")
      .eq("job", "outreach")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("cron_runs")
      .select("ran_at, status, processed, duration_ms, error")
      .eq("job", "proactive")
      .order("ran_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("email_log")
      .select("id, recipient, kind, subject, status, error, sent_at")
      .order("sent_at", { ascending: false })
      .limit(20),
    admin
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("sent_at", new Date(now - 7 * ONE_DAY_MS).toISOString()),
    admin
      .from("email_log")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", new Date(now - ONE_DAY_MS).toISOString()),
    admin
      .from("audit_log")
      .select("id, actor_email, action, target_user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const stat = (n: { count?: number | null }) => n.count ?? 0;
  const sumCents = (rows: { data?: { amount_cents: number }[] | null }) =>
    (rows.data ?? []).reduce((acc, r) => acc + (r.amount_cents ?? 0), 0);

  const revenueAllCents = sumCents(paidPaymentsAll);
  const revenueMonthCents = sumCents(paidPaymentsMonth);
  const revenueWeekCents = sumCents(paidPaymentsWeek);
  const paidCount = (paidPaymentsAll.data ?? []).length;

  const sumMessages = (rows: { data?: { message_count: number }[] | null }) =>
    (rows.data ?? []).reduce((acc, r) => acc + (r.message_count ?? 0), 0);
  const chatMessagesToday = sumMessages(chatTodayCount);
  const chatMessagesWeek = sumMessages(chatWeekRows);

  // Aggregate top users (chat_usage rows are per-day, so collapse).
  const topUsersMap = new Map<string, number>();
  for (const row of topChatUsersWeek.data ?? []) {
    topUsersMap.set(
      row.user_id,
      (topUsersMap.get(row.user_id) ?? 0) + (row.message_count ?? 0),
    );
  }
  const topUsers = Array.from(topUsersMap.entries())
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  function fmtAgo(iso: string | null | undefined): string {
    if (!iso) return "never";
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.floor(ms / 60000);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    return `${Math.floor(hr / 24)}d ago`;
  }

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
              Look up a user
            </h2>
            <form action={lookupUser} className="flex gap-2">
              <input
                type="text"
                name="q"
                required
                placeholder="email or user UUID"
                className="flex-1 h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
              />
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm whitespace-nowrap"
              >
                Find
              </button>
            </form>
          </section>

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
              Chat usage
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Stat label="Messages today" value={chatMessagesToday.toLocaleString()} />
              <Stat label="Messages (7d)" value={chatMessagesWeek.toLocaleString()} />
              <Stat
                label="~Anthropic spend (7d)"
                value={`$${((chatMessagesWeek * 0.02)).toFixed(2)}`}
              />
              <Stat
                label="Daily cap"
                value="200/user"
              />
            </div>
            {topUsers.length > 0 && (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-warm-400 mb-2">
                  Top users (7d)
                </p>
                <div className="space-y-1">
                  {topUsers.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                    >
                      <Link
                        href={`/admin/user/${u.id}`}
                        className="font-mono text-xs text-warm-200 hover:text-warm-50 truncate"
                      >
                        {u.id.slice(0, 8)}
                      </Link>
                      <span className="text-sm text-warm-100 tabular-nums">
                        {u.count.toLocaleString()} msgs
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Legacy &amp; sharing
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Stat
                label="Beneficiaries designated"
                value={stat(beneficiariesDesignatedCount).toLocaleString()}
              />
              <Stat
                label="Activated (awaiting claim)"
                value={stat(beneficiariesActivatedCount).toLocaleString()}
              />
              <Stat
                label="Claimed"
                value={stat(beneficiariesClaimedCount).toLocaleString()}
              />
              <Stat
                label="Marked deceased"
                value={stat(deceasedCount).toLocaleString()}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <Stat
                label="Invites pending"
                value={stat(invitesPendingCount).toLocaleString()}
              />
              <Stat
                label="Invites accepted"
                value={stat(invitesAcceptedCount).toLocaleString()}
              />
              <Stat
                label="Active grants"
                value={stat(grantsCount).toLocaleString()}
              />
            </div>
            {deceasedRecent.data && deceasedRecent.data.length > 0 && (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-warm-400 mb-2">
                  Recently marked deceased
                </p>
                <div className="space-y-1">
                  {deceasedRecent.data.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-red-300/20 bg-red-900/10"
                    >
                      <Link
                        href={`/admin/user/${p.id}`}
                        className="text-sm text-warm-100 truncate font-serif hover:text-warm-50"
                      >
                        {p.oracle_name ?? p.id.slice(0, 8)}
                      </Link>
                      <span className="text-xs text-warm-400">
                        {fmtAgo(p.deceased_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Cron health
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CronCard
                name="outreach"
                row={cronOutreachLast.data}
                fmtAgo={fmtAgo}
              />
              <CronCard
                name="proactive"
                row={cronProactiveLast.data}
                fmtAgo={fmtAgo}
              />
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Stripe events (recent)
            </h2>
            {recentStripeEvents.data && recentStripeEvents.data.length > 0 ? (
              <div className="space-y-1">
                {recentStripeEvents.data.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <code className="font-mono text-xs text-warm-400">
                        {e.id.slice(0, 14)}…
                      </code>
                      <span className="text-sm text-warm-100">{e.type}</span>
                      {e.user_id && (
                        <Link
                          href={`/admin/user/${e.user_id}`}
                          className="font-mono text-xs text-warm-300 hover:text-warm-100"
                        >
                          {e.user_id.slice(0, 8)}
                        </Link>
                      )}
                    </div>
                    <span className="text-xs text-warm-400 whitespace-nowrap">
                      {fmtAgo(e.processed_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">No events yet.</p>
            )}
          </section>

          <section>
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300">
                Email log
              </h2>
              <p className="text-sm text-warm-200">
                <span className="text-warm-50 font-medium">
                  {stat(emailSentTodayCount)}
                </span>{" "}
                sent today ·{" "}
                <span
                  className={
                    stat(emailFailedCount) > 0 ? "text-red-300" : "text-warm-300"
                  }
                >
                  {stat(emailFailedCount)} failed (7d)
                </span>
              </p>
            </div>
            {emailRecent.data && emailRecent.data.length > 0 ? (
              <div className="space-y-1">
                {emailRecent.data.map((e) => (
                  <div
                    key={e.id}
                    className={`flex items-center justify-between gap-3 px-4 py-2 rounded-lg border ${
                      e.status === "failed"
                        ? "border-red-300/30 bg-red-900/10"
                        : "border-warm-700/60 bg-warm-700/15"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-xs text-warm-400 uppercase tracking-wider">
                          {e.kind}
                        </span>
                        <span className="text-sm text-warm-100 truncate">
                          {e.recipient}
                        </span>
                      </div>
                      {e.error && (
                        <span className="text-xs text-red-300 truncate">
                          {e.error}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-warm-400 whitespace-nowrap">
                      {fmtAgo(e.sent_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">No emails yet.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Audit log
            </h2>
            {auditRecent.data && auditRecent.data.length > 0 ? (
              <div className="space-y-1">
                {auditRecent.data.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-warm-400 uppercase tracking-wider">
                        {a.action}
                      </span>
                      {a.actor_email && (
                        <span className="text-sm text-warm-200 truncate">
                          {a.actor_email}
                        </span>
                      )}
                      {a.target_user_id && (
                        <Link
                          href={`/admin/user/${a.target_user_id}`}
                          className="font-mono text-xs text-warm-300 hover:text-warm-100"
                        >
                          {a.target_user_id.slice(0, 8)}
                        </Link>
                      )}
                    </div>
                    <span className="text-xs text-warm-400 whitespace-nowrap">
                      {fmtAgo(a.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">Nothing recorded yet.</p>
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

function CronCard({
  name,
  row,
  fmtAgo,
}: {
  name: string;
  row:
    | {
        ran_at: string;
        status: string;
        processed: number | null;
        duration_ms: number | null;
        error: string | null;
      }
    | null
    | undefined;
  fmtAgo: (iso: string | null | undefined) => string;
}) {
  const stale =
    !row ||
    Date.now() - new Date(row.ran_at).getTime() > 36 * 60 * 60 * 1000;
  const errored = row?.status === "error";

  return (
    <div
      className={`rounded-2xl border px-5 py-4 ${
        errored
          ? "border-red-300/30 bg-red-900/10"
          : stale
            ? "border-warm-300/30 bg-warm-700/20"
            : "border-warm-700/60 bg-warm-700/15"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs uppercase tracking-[0.2em] text-warm-400">
          {name}
        </p>
        <span
          className={`text-[10px] uppercase tracking-wider ${
            errored
              ? "text-red-300"
              : stale
                ? "text-amber-300"
                : "text-warm-300"
          }`}
        >
          {errored ? "error" : stale ? "stale" : "ok"}
        </span>
      </div>
      <p className="font-serif text-2xl text-warm-50">{fmtAgo(row?.ran_at)}</p>
      <p className="text-xs text-warm-400 mt-1">
        {row
          ? `${row.processed ?? 0} processed · ${row.duration_ms ?? 0}ms`
          : "never run"}
      </p>
      {errored && row?.error && (
        <p className="text-xs text-red-300 mt-2 break-words">{row.error}</p>
      )}
    </div>
  );
}
