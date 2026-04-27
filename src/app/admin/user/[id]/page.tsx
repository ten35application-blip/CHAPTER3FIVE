import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { markUserDeceased, unmarkUserDeceased } from "@/app/admin/actions";

export const metadata = {
  title: "User — chapter3five admin",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fmtCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();
  if (!me || !isAdmin(me.email)) {
    redirect("/");
  }

  const admin = createAdminClient();

  const { data: authUserResult } = await admin.auth.admin.getUserById(id);
  const authUser = authUserResult?.user;
  if (!authUser) notFound();

  const [
    profileResult,
    oraclesResult,
    answerCountResult,
    paymentsResult,
    crisisResult,
    reportsResult,
    sharesResult,
    beneficiariesResult,
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("id", id).maybeSingle(),
    admin
      .from("oracles")
      .select("id, name, mode, preferred_language, onboarding_completed, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: true }),
    admin
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id),
    admin
      .from("payments")
      .select("id, amount_cents, currency, purpose, status, created_at, paid_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("crisis_flags")
      .select("id, message_excerpt, triggered_keywords, flagged_at, resolved_at")
      .eq("user_id", id)
      .order("flagged_at", { ascending: false }),
    admin
      .from("message_reports")
      .select("id, message_content, reason, reported_at, resolved_at")
      .eq("user_id", id)
      .order("reported_at", { ascending: false }),
    admin
      .from("shares")
      .select("code, label, revoked_at, created_at")
      .eq("source_user_id", id)
      .order("created_at", { ascending: false }),
    admin
      .from("beneficiaries")
      .select("id, email, name, status, notified_at, activated_at, claimed_at, created_at")
      .eq("owner_user_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const profile = profileResult.data;
  const oracles = oraclesResult.data ?? [];
  const answersCount = answerCountResult.count ?? 0;
  const payments = paymentsResult.data ?? [];
  const crisis = crisisResult.data ?? [];
  const reports = reportsResult.data ?? [];
  const shares = sharesResult.data ?? [];
  const beneficiaries = beneficiariesResult.data ?? [];

  const totalPaidCents = payments
    .filter((p) => p.status === "paid")
    .reduce((acc, p) => acc + (p.amount_cents ?? 0), 0);

  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link
            href="/admin"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            chapter3five
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-warm-300">
            user detail
          </span>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
          <section className="space-y-3">
            <h1 className="font-serif text-3xl text-warm-50">
              {authUser.email ?? "(no email)"}
            </h1>
            <div className="text-xs text-warm-400 font-mono break-all">
              {authUser.id}
            </div>
            <div className="text-xs text-warm-400">
              Created {fmtDate(authUser.created_at)} · Last sign-in{" "}
              {fmtDate(authUser.last_sign_in_at)}
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-3">
              Active profile
            </h2>
            {profile ? (
              <div className="rounded-2xl border border-warm-700/60 bg-warm-700/15 p-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Active oracle name" value={profile.oracle_name ?? "—"} />
                <Field label="Mode" value={profile.mode ?? "—"} />
                <Field
                  label="Language"
                  value={profile.preferred_language ?? "—"}
                />
                <Field label="Timezone" value={profile.timezone ?? "—"} />
                <Field
                  label="Personality"
                  value={profile.personality_type ?? "—"}
                />
                <Field
                  label="Flavor"
                  value={profile.emotional_flavor ?? "—"}
                />
                <Field label="Answers recorded" value={answersCount.toLocaleString()} />
                <Field
                  label="Onboarding completed"
                  value={profile.onboarding_completed ? "yes" : "no"}
                />
                <Field
                  label="Randomize credits / count"
                  value={`${profile.randomize_credits ?? 0} / ${profile.randomize_count ?? 0}`}
                />
                <Field
                  label="Outreach enabled"
                  value={profile.outreach_enabled ? "yes" : "no"}
                />
                <Field
                  label="Last active"
                  value={fmtDate(profile.last_active_at)}
                />
                <Field
                  label="Last outreach"
                  value={fmtDate(profile.last_outreach_at)}
                />
              </div>
            ) : (
              <p className="text-sm text-warm-400">No profile row.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-3">
              Identities ({oracles.length})
            </h2>
            {oracles.length > 0 ? (
              <div className="space-y-1">
                {oracles.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <code className="font-mono text-xs text-warm-400">
                        {o.id.slice(0, 8)}
                      </code>
                      <span className="text-sm text-warm-100 truncate font-serif">
                        {o.name?.trim() || "(untitled)"}
                      </span>
                      <span className="text-xs text-warm-400">{o.mode}</span>
                      <span className="text-xs text-warm-400">
                        {o.preferred_language}
                      </span>
                    </div>
                    <div className="text-xs text-warm-400 whitespace-nowrap">
                      {o.onboarding_completed ? "✓" : "—"}{" "}
                      {fmtDate(o.created_at).split(",")[0]}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">None.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-3">
              Legacy status
            </h2>
            {profile?.deceased_at ? (
              <div className="rounded-2xl border border-red-300/30 bg-red-900/10 p-5 space-y-3">
                <div className="text-sm text-red-200">
                  Marked deceased {fmtDate(profile.deceased_at)}
                </div>
                <p className="text-xs text-warm-400">
                  Beneficiaries that hadn&rsquo;t already claimed received the
                  activation email at this point. Use unmark only if this was
                  done in error — already-claimed grants stay.
                </p>
                <form action={unmarkUserDeceased}>
                  <input type="hidden" name="user_id" value={id} />
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-full border border-warm-300/40 text-warm-100 hover:bg-warm-700/40 transition-colors text-xs"
                  >
                    Unmark deceased
                  </button>
                </form>
              </div>
            ) : (
              <div className="rounded-2xl border border-warm-700/60 bg-warm-700/15 p-5 space-y-3">
                <p className="text-sm text-warm-300">
                  Marking this user deceased activates all{" "}
                  {beneficiaries.filter((b) => b.status === "designated").length}{" "}
                  designated beneficiar
                  {beneficiaries.filter((b) => b.status === "designated").length === 1
                    ? "y"
                    : "ies"}{" "}
                  and emails them a claim link. Only do this with confirmation
                  (death certificate, obituary, family notification).
                </p>
                <form action={markUserDeceased}>
                  <input type="hidden" name="user_id" value={id} />
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-full border border-red-300/40 bg-red-900/20 text-red-200 hover:bg-red-900/30 transition-colors text-xs"
                  >
                    Mark deceased + activate beneficiaries
                  </button>
                </form>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-3">
              Beneficiaries ({beneficiaries.length})
            </h2>
            {beneficiaries.length > 0 ? (
              <div className="space-y-1">
                {beneficiaries.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-warm-100 truncate">
                        {b.name ?? b.email}
                      </span>
                      <span className="text-xs text-warm-400 truncate">
                        {b.name ? `${b.email} · ` : ""}
                        {b.status}
                        {b.claimed_at
                          ? ` · claimed ${fmtDate(b.claimed_at).split(",")[0]}`
                          : b.activated_at
                          ? ` · activated ${fmtDate(b.activated_at).split(",")[0]}`
                          : b.notified_at
                          ? ` · notified ${fmtDate(b.notified_at).split(",")[0]}`
                          : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">None.</p>
            )}
          </section>

          <section>
            <div className="flex items-end justify-between mb-3">
              <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300">
                Payments
              </h2>
              <p className="text-sm text-warm-200">
                Lifetime paid:{" "}
                <span className="text-warm-50 font-medium">
                  {fmtCents(totalPaidCents)}
                </span>
              </p>
            </div>
            {payments.length > 0 ? (
              <div className="space-y-1">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                  >
                    <div className="flex items-center gap-3 min-w-0 text-sm">
                      <span className="text-warm-100">{p.purpose}</span>
                      <span className="text-xs text-warm-400">{p.status}</span>
                      <span className="text-xs text-warm-400">
                        {fmtDate(p.paid_at ?? p.created_at).split(",")[0]}
                      </span>
                    </div>
                    <span className="font-serif text-warm-50 tabular-nums">
                      {fmtCents(p.amount_cents)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">No payments.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-3">
              Crisis flags ({crisis.length})
            </h2>
            {crisis.length > 0 ? (
              <div className="space-y-2">
                {crisis.map((f) => (
                  <div
                    key={f.id}
                    className={`rounded-lg border px-4 py-3 ${
                      f.resolved_at
                        ? "border-warm-700/60 bg-warm-700/10"
                        : "border-red-300/30 bg-red-900/10"
                    }`}
                  >
                    <div className="text-xs text-warm-400 mb-1">
                      {fmtDate(f.flagged_at)} ·{" "}
                      {f.resolved_at ? "resolved" : "open"}
                    </div>
                    <p className="text-sm text-warm-100 italic whitespace-pre-wrap">
                      {f.message_excerpt}
                    </p>
                    <div className="mt-1 text-xs text-warm-400 font-mono">
                      {(f.triggered_keywords ?? []).join(", ")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">None.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-3">
              Reported messages ({reports.length})
            </h2>
            {reports.length > 0 ? (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-lg border px-4 py-3 ${
                      r.resolved_at
                        ? "border-warm-700/60 bg-warm-700/10"
                        : "border-warm-300/30 bg-warm-700/20"
                    }`}
                  >
                    <div className="text-xs text-warm-400 mb-1">
                      {fmtDate(r.reported_at)} ·{" "}
                      {r.resolved_at ? "resolved" : "open"}
                    </div>
                    <p className="text-sm text-warm-100 italic whitespace-pre-wrap">
                      &ldquo;{r.message_content}&rdquo;
                    </p>
                    {r.reason && (
                      <p className="mt-1 text-xs text-warm-300">{r.reason}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">None.</p>
            )}
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-3">
              Share codes ({shares.length})
            </h2>
            {shares.length > 0 ? (
              <div className="space-y-1">
                {shares.map((s) => (
                  <div
                    key={s.code}
                    className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                  >
                    <code className="font-mono text-sm text-warm-100">
                      {s.code}
                    </code>
                    <div className="text-xs text-warm-400">
                      {s.label ?? "(no label)"} ·{" "}
                      {s.revoked_at ? "revoked" : "active"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-400">None.</p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm py-1">
      <span className="text-warm-400">{label}</span>
      <span className="text-warm-100 text-right truncate">{value}</span>
    </div>
  );
}
