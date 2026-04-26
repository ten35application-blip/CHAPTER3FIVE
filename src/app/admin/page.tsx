import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { resolveCrisisFlag } from "./actions";

export const metadata = {
  title: "Admin — chapter3five",
};

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

  // Counts in parallel.
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
    recentSignups,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).eq("onboarding_completed", true),
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
      .gte("last_active_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_outreach_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
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
      .from("profiles")
      .select("id, oracle_name, mode, preferred_language, created_at, onboarding_completed")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const stat = (n: { count?: number | null }) => n.count ?? 0;

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
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
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
              Users
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Total accounts" value={stat(profilesCount)} />
              <Stat label="Completed onboarding" value={stat(onboardedCount)} />
              <Stat label="Active in 7 days" value={stat(activeLastSevenCount)} />
              <Stat label="Outreach sent (30d)" value={stat(outreachSentLast30)} />
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Mode distribution
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Real" value={stat(realCount)} />
              <Stat label="Randomize" value={stat(randomizeCount)} />
              <Stat label="Import" value={stat(importCount)} />
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-4">
              Content
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label="Total thirtyfives" value={stat(oraclesCount)} />
              <Stat label="Total answers" value={stat(answersCount)} />
              <Stat label="Active share codes" value={stat(sharesActiveCount)} />
              <Stat label="Revoked share codes" value={stat(sharesRevokedCount)} />
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300">
                Crisis flags
              </h2>
              <p className="text-sm text-warm-200">
                <span className="text-warm-50 font-medium">{stat(openCrisisCount)}</span>{" "}
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
              <p className="text-sm text-warm-400">
                No crisis flags yet.
              </p>
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
                      <span className="text-xs text-warm-400">
                        {p.mode ?? "—"}
                      </span>
                      <span className="text-xs text-warm-400">
                        {p.preferred_language ?? "—"}
                      </span>
                    </div>
                    <div className="text-xs text-warm-400 whitespace-nowrap">
                      {p.onboarding_completed ? "✓" : "—"} {" "}
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-warm-700/60 bg-warm-700/15 px-5 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-warm-400 mb-2">
        {label}
      </p>
      <p className="font-serif text-3xl text-warm-50 tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
