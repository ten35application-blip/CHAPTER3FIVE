import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateLanguage,
  updateTextingStyle,
  deleteOracle,
  deleteAccount,
  createShareCode,
  revokeShareCode,
  toggleOutreach,
  createArchiveInvite,
  revokeArchiveInvite,
  revokeArchiveGrant,
  addBeneficiary,
  removeBeneficiary,
  buyBeneficiarySlot,
  deletePersonaMemory,
  restoreOracle,
  deleteAccountPermanently,
} from "./actions";
import { AvatarUpload } from "@/components/AvatarUpload";
import { questions } from "@/content/questions";

export const metadata = {
  title: "Settings — chapter3five",
};

function isoDate(input: string | null | undefined): string {
  if (!input) return "—";
  return new Date(input).toISOString().slice(0, 10);
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
    code?: string;
    invite?: string;
  }>;
}) {
  const { saved, error, code: justCreatedCode, invite: justCreatedInvite } =
    await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "oracle_name, mode, preferred_language, texting_style, created_at, outreach_enabled, randomize_credits, randomize_count, avatar_url, active_oracle_id, paid_beneficiary_slots",
    )
    .eq("id", user.id)
    .single();

  const { count: answeredCount } = profile?.active_oracle_id
    ? await supabase
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("oracle_id", profile.active_oracle_id)
        .eq("variant", 1)
    : { count: 0 };

  const totalQuestions = questions.length;
  const progressPct = Math.round(((answeredCount ?? 0) / totalQuestions) * 100);

  const { data: shareRows } = await supabase
    .from("shares")
    .select("code, label, revoked_at, created_at")
    .eq("source_user_id", user.id)
    .order("created_at", { ascending: false });

  const { data: inviteRows } = await supabase
    .from("archive_invites")
    .select("code, invitee_email, status, created_at")
    .eq("inviter_user_id", user.id)
    .order("created_at", { ascending: false });

  const activeOracleId = profile?.active_oracle_id ?? null;
  const { data: grantRows } = activeOracleId
    ? await supabase
        .from("archive_grants")
        .select("id, user_id, granted_at")
        .eq("oracle_id", activeOracleId)
        .order("granted_at", { ascending: false })
    : { data: [] };

  // Memories the active thirtyfive has formed about you (per-relationship).
  const { data: memoryRows } = activeOracleId
    ? await supabase
        .from("persona_memories")
        .select("id, kind, content, weight, created_at")
        .eq("oracle_id", activeOracleId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] };
  const memories = memoryRows ?? [];

  // Soft-deleted thirtyfives owned by this user that are still inside
  // the 30-day grace window. Restorable for $5 each.
  const { data: trashedRows } = await supabase
    .from("oracles")
    .select("id, name, deleted_at, scheduled_purge_at")
    .eq("user_id", user.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  const trashed = (trashedRows ?? []).filter((o) => {
    if (!o.scheduled_purge_at) return true;
    return new Date(o.scheduled_purge_at).getTime() > Date.now();
  });

  const { data: beneficiaryRows } = await supabase
    .from("beneficiaries")
    .select("id, email, name, status, notified_at, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });
  const beneficiaries = beneficiaryRows ?? [];
  const FREE_BENEFICIARIES = 3;
  const beneficiarySlotsTotal =
    FREE_BENEFICIARIES + (profile?.paid_beneficiary_slots ?? 0);
  const beneficiarySlotsUsed = beneficiaries.length;
  const beneficiarySlotsLeft = Math.max(
    0,
    beneficiarySlotsTotal - beneficiarySlotsUsed,
  );

  const { data: paymentRows } = await supabase
    .from("payments")
    .select("amount_cents, currency, purpose, status, paid_at, refunded_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];
  const createdIso = isoDate(profile?.created_at);
  const oracleName = profile?.oracle_name ?? null;

  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            chapter3five
          </Link>
          <Link
            href="/dashboard"
            className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
          >
            ← {t.back}
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-12">
          <h1 className="font-serif text-4xl text-warm-50 mb-2">{t.title}</h1>
          <p className="text-warm-300 mb-12">{t.intro}</p>

          {saved && (
            <div className="rounded-lg bg-warm-700/30 border border-warm-300/30 px-4 py-3 mb-8 text-sm text-warm-100">
              {t.saved}
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-300/30 px-4 py-3 mb-8 text-sm text-red-200">
              {error}
            </div>
          )}

          {profile?.active_oracle_id && (
            <Section title={t.photoTitle}>
              <p className="text-sm text-warm-300 mb-4 leading-relaxed">
                {t.photoHint}
              </p>
              <AvatarUpload
                initialUrl={profile.avatar_url ?? null}
                oracleId={profile.active_oracle_id}
                userId={user.id}
                language={language}
              />
            </Section>
          )}

          {trashed.length > 0 && (
            <Section title={t.trashTitle}>
              <p className="text-sm text-warm-300 mb-5 leading-relaxed">
                {t.trashHint}
              </p>
              <div className="space-y-2">
                {trashed.map((o) => {
                  const purgeAt = o.scheduled_purge_at
                    ? new Date(o.scheduled_purge_at)
                    : null;
                  const daysLeft = purgeAt
                    ? Math.max(
                        0,
                        Math.ceil(
                          (purgeAt.getTime() - Date.now()) /
                            (24 * 60 * 60 * 1000),
                        ),
                      )
                    : 0;
                  return (
                    <div
                      key={o.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border border-amber-300/30 bg-amber-900/10"
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-serif text-warm-50 text-base truncate">
                          {o.name?.trim() || t.untitled}
                        </span>
                        <span className="text-xs text-amber-300 mt-1">
                          {t.daysLeft(daysLeft)}
                          {purgeAt && (
                            <>
                              {" "}
                              <span className="text-warm-400">
                                ·{" "}
                                {t.permanentlyOn}{" "}
                                {purgeAt.toLocaleDateString()}
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      <form action={restoreOracle}>
                        <input type="hidden" name="oracle_id" value={o.id} />
                        <button
                          type="submit"
                          className="h-9 px-4 rounded-full bg-warm-50 text-ink text-xs font-medium hover:bg-warm-100 transition-colors whitespace-nowrap"
                        >
                          {t.bringItBack}
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {profile?.mode !== "randomize" && (
            <Section title={t.progressTitle}>
              <div className="flex items-baseline justify-between mb-2">
                <p className="text-sm text-warm-200">
                  {t.progressLabel(answeredCount ?? 0, totalQuestions)}
                </p>
                <p className="text-warm-300 text-xs">{progressPct}%</p>
              </div>
              <div className="h-1 bg-warm-700/60 rounded-full overflow-hidden">
                <div
                  className="h-full bg-warm-300/80 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <Link
                href="/onboarding/questions"
                className="inline-block mt-4 text-sm text-warm-200 underline underline-offset-2 hover:text-warm-50"
              >
                {t.continueAnswering}
              </Link>{" "}
              <span className="text-warm-400 text-sm">·</span>{" "}
              <Link
                href="/answers"
                className="inline-block mt-4 text-sm text-warm-200 underline underline-offset-2 hover:text-warm-50"
              >
                {t.editAnswers}
              </Link>
            </Section>
          )}

          <Section title={t.accountTitle}>
            <Row label={t.email} value={user.email ?? "—"} />
            <Row label={t.oracle} value={oracleName ?? "—"} />
            <Row
              label={t.mode}
              value={
                profile?.mode === "randomize"
                  ? t.modeRandomize
                  : t.modeReal
              }
            />
            <Row label={t.created} value={createdIso} mono />
          </Section>

          <Section title={t.languageTitle}>
            <form action={updateLanguage} className="flex items-center gap-3">
              <select
                name="language"
                defaultValue={language}
                className="h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 focus:outline-none focus:border-warm-200"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
              >
                {t.save}
              </button>
            </form>
          </Section>

          <Section title={t.styleTitle}>
            <p className="text-sm text-warm-300 mb-3">{t.styleHint}</p>
            <form action={updateTextingStyle} className="space-y-3">
              <textarea
                name="texting_style"
                rows={3}
                defaultValue={profile?.texting_style ?? ""}
                placeholder={t.stylePlaceholder}
                className="w-full rounded-2xl bg-warm-700/30 border border-warm-400/30 px-4 py-3 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors leading-relaxed"
              />
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
              >
                {t.save}
              </button>
            </form>
          </Section>

          {oracleName && (
            <Section title={t.shareTitle}>
              <p className="text-sm text-warm-300 mb-4 leading-relaxed">
                {t.shareHint}
              </p>

              {justCreatedCode && (
                <div className="rounded-lg border border-warm-300/40 bg-warm-700/40 px-4 py-3 mb-4 text-sm">
                  <p className="text-warm-200 mb-2">{t.justCreated}</p>
                  <code className="font-mono text-warm-50 text-base tracking-wide">
                    {justCreatedCode}
                  </code>
                </div>
              )}

              <form action={createShareCode} className="flex gap-2 mb-6">
                <input
                  type="text"
                  name="label"
                  maxLength={80}
                  placeholder={t.labelPlaceholder}
                  className="flex-1 h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                />
                <button
                  type="submit"
                  className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm whitespace-nowrap"
                >
                  {t.shareCta}
                </button>
              </form>

              {shareRows && shareRows.length > 0 && (
                <div className="space-y-2">
                  {shareRows.map((s) => (
                    <div
                      key={s.code}
                      className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                    >
                      <div className="flex flex-col min-w-0">
                        <code className="font-mono text-sm text-warm-100 truncate">
                          {s.code}
                        </code>
                        <span className="text-xs text-warm-400 truncate">
                          {s.label ?? t.unlabeled} ·{" "}
                          {s.revoked_at ? t.revoked : t.active}
                        </span>
                      </div>
                      {!s.revoked_at && (
                        <form action={revokeShareCode}>
                          <input type="hidden" name="code" value={s.code} />
                          <button
                            type="submit"
                            className="text-xs text-warm-400 hover:text-warm-200 transition-colors whitespace-nowrap"
                          >
                            {t.revoke}
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          {oracleName && (
            <Section title={t.inviteTitle}>
              <p className="text-sm text-warm-300 mb-4 leading-relaxed">
                {t.inviteHint}
              </p>

              {justCreatedInvite && (
                <div className="rounded-lg border border-warm-300/40 bg-warm-700/40 px-4 py-3 mb-4 text-sm">
                  <p className="text-warm-200 mb-2">{t.inviteJustCreated}</p>
                  <code className="font-mono text-warm-50 text-base tracking-wide break-all">
                    chapter3five.app/invite/{justCreatedInvite}
                  </code>
                </div>
              )}

              <form action={createArchiveInvite} className="flex gap-2 mb-6">
                <input
                  type="email"
                  name="invitee_email"
                  maxLength={120}
                  placeholder={t.inviteEmailPlaceholder}
                  className="flex-1 h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                />
                <button
                  type="submit"
                  className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm whitespace-nowrap"
                >
                  {t.inviteCta}
                </button>
              </form>

              {inviteRows && inviteRows.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-warm-400 mb-1">
                    {t.invitesHeading}
                  </p>
                  {inviteRows.map((iv) => (
                    <div
                      key={iv.code}
                      className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                    >
                      <div className="flex flex-col min-w-0">
                        <code className="font-mono text-sm text-warm-100 truncate">
                          {iv.code}
                        </code>
                        <span className="text-xs text-warm-400 truncate">
                          {iv.invitee_email ?? t.noEmail} ·{" "}
                          {iv.status === "pending"
                            ? t.invitePending
                            : iv.status === "accepted"
                            ? t.inviteAccepted
                            : t.revoked}
                        </span>
                      </div>
                      {iv.status === "pending" && (
                        <form action={revokeArchiveInvite}>
                          <input type="hidden" name="code" value={iv.code} />
                          <button
                            type="submit"
                            className="text-xs text-warm-400 hover:text-warm-200 transition-colors whitespace-nowrap"
                          >
                            {t.revoke}
                          </button>
                        </form>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {grantRows && grantRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-warm-400 mb-1">
                    {t.grantsHeading}
                  </p>
                  {grantRows.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-warm-100 truncate">
                          {t.grantedOn}{" "}
                          {new Date(g.granted_at).toLocaleDateString()}
                        </span>
                      </div>
                      <form action={revokeArchiveGrant}>
                        <input type="hidden" name="grant_id" value={g.id} />
                        <button
                          type="submit"
                          className="text-xs text-warm-400 hover:text-warm-200 transition-colors whitespace-nowrap"
                        >
                          {t.revokeAccess}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title={t.outreachTitle}>
            <p className="text-sm text-warm-300 mb-4 leading-relaxed">
              {t.outreachHint}
            </p>
            <form action={toggleOutreach} className="flex items-center gap-3">
              <input
                type="hidden"
                name="enabled"
                value={profile?.outreach_enabled ? "false" : "true"}
              />
              <button
                type="submit"
                className={`h-11 px-5 rounded-full text-sm font-medium transition-colors ${
                  profile?.outreach_enabled
                    ? "bg-warm-50 text-ink hover:bg-warm-100"
                    : "border border-warm-300/40 text-warm-100 hover:bg-warm-700/40"
                }`}
              >
                {profile?.outreach_enabled
                  ? t.outreachOn
                  : t.outreachOff}
              </button>
              <span className="text-xs text-warm-400">
                {profile?.outreach_enabled ? t.tapToDisable : t.tapToEnable}
              </span>
            </form>
          </Section>

          {oracleName && memories.length > 0 && (
            <Section title={t.memoriesTitle}>
              <p className="text-sm text-warm-300 mb-4 leading-relaxed">
                {t.memoriesHint(oracleName)}
              </p>
              <div className="space-y-2">
                {memories.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start justify-between gap-3 px-4 py-3 rounded-lg border border-warm-700/60 bg-warm-700/15"
                  >
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-xs uppercase tracking-[0.15em] text-warm-400 mb-1">
                        {t.memoryKinds[m.kind as keyof typeof t.memoryKinds] ??
                          m.kind}
                      </span>
                      <span className="text-sm text-warm-100 leading-relaxed">
                        {m.content}
                      </span>
                    </div>
                    <form action={deletePersonaMemory}>
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        className="text-xs text-warm-400 hover:text-warm-200 transition-colors whitespace-nowrap"
                      >
                        {t.forget}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title={t.beneficiaryTitle}>
            <p className="text-sm text-warm-300 mb-2 leading-relaxed">
              {t.beneficiaryHint}
            </p>
            <p className="text-sm text-warm-400 mb-5">
              {t.beneficiarySlots(
                beneficiarySlotsUsed,
                beneficiarySlotsTotal,
              )}
            </p>

            {beneficiarySlotsLeft > 0 ? (
              <form
                action={addBeneficiary}
                className="flex flex-col sm:flex-row gap-2 mb-6"
              >
                <input
                  type="email"
                  name="email"
                  required
                  placeholder={t.beneficiaryEmailPlaceholder}
                  className="flex-1 h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                />
                <input
                  type="text"
                  name="name"
                  maxLength={80}
                  placeholder={t.beneficiaryNamePlaceholder}
                  className="sm:w-48 h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                />
                <button
                  type="submit"
                  className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm whitespace-nowrap"
                >
                  {t.beneficiaryAdd}
                </button>
              </form>
            ) : (
              <form action={buyBeneficiarySlot} className="mb-6">
                <button
                  type="submit"
                  className="h-11 px-5 rounded-full border border-warm-300/40 text-warm-100 hover:bg-warm-700/40 transition-colors text-sm"
                >
                  {t.beneficiaryBuyMore}
                </button>
              </form>
            )}

            {beneficiaries.length > 0 && (
              <div className="space-y-2">
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
                        {b.status === "designated"
                          ? b.notified_at
                            ? t.beneficiaryNotified
                            : t.beneficiaryDesignated
                          : b.status === "activated"
                          ? t.beneficiaryActivated
                          : b.status === "claimed"
                          ? t.beneficiaryClaimed
                          : b.status === "declined"
                          ? t.beneficiaryDeclined
                          : t.revoked}
                      </span>
                    </div>
                    {(b.status === "designated" ||
                      b.status === "activated") && (
                      <form action={removeBeneficiary}>
                        <input type="hidden" name="id" value={b.id} />
                        <button
                          type="submit"
                          className="text-xs text-warm-400 hover:text-warm-200 transition-colors whitespace-nowrap"
                        >
                          {t.remove}
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {paymentRows && paymentRows.length > 0 && (
            <Section title={t.paymentsTitle}>
              <div className="space-y-2">
                {paymentRows.map((p, i) => {
                  const isRefunded = p.status === "refunded";
                  const purposeLabel =
                    p.purpose === "randomize"
                      ? t.purposeRandomize
                      : p.purpose === "oracle"
                      ? t.purposeOracle
                      : p.purpose === "beneficiary_slot"
                      ? t.purposeBeneficiarySlot
                      : p.purpose;
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between gap-3 px-4 py-2 rounded-lg border ${
                        isRefunded
                          ? "border-amber-300/30 bg-amber-900/10"
                          : "border-warm-700/60 bg-warm-700/15"
                      }`}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-warm-100">
                          {purposeLabel}
                        </span>
                        <span className="text-xs text-warm-400">
                          {p.paid_at
                            ? new Date(p.paid_at).toLocaleDateString()
                            : new Date(p.created_at).toLocaleDateString()}{" "}
                          ·{" "}
                          <span
                            className={
                              isRefunded ? "text-amber-300" : "text-warm-400"
                            }
                          >
                            {p.status === "paid"
                              ? t.statusPaid
                              : p.status === "pending"
                              ? t.statusPending
                              : p.status === "refunded"
                              ? t.statusRefunded
                              : t.statusFailed}
                          </span>
                          {isRefunded && p.refunded_at && (
                            <>
                              {" "}
                              <span className="text-warm-400">
                                ({new Date(p.refunded_at).toLocaleDateString()})
                              </span>
                            </>
                          )}
                        </span>
                      </div>
                      <span
                        className={`font-serif tabular-nums ${
                          isRefunded
                            ? "text-warm-300 line-through"
                            : "text-warm-50"
                        }`}
                      >
                        ${(p.amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          <Section title={t.exportTitle}>
            <p className="text-sm text-warm-300 mb-4 leading-relaxed">
              {t.exportHint}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href="/api/user/export"
                download
                className="inline-flex h-11 items-center justify-center rounded-full border border-warm-300/40 px-5 text-sm text-warm-100 hover:bg-warm-700/40 transition-colors"
              >
                {t.exportCta}
              </a>
              {profile?.active_oracle_id && (
                <a
                  href={`/api/conversation/export?oracle_id=${profile.active_oracle_id}`}
                  download
                  className="inline-flex h-11 items-center justify-center rounded-full border border-warm-300/40 px-5 text-sm text-warm-100 hover:bg-warm-700/40 transition-colors"
                >
                  {t.exportConversation}
                </a>
              )}
            </div>
          </Section>

          <Section title={t.helpTitle}>
            <p className="text-sm text-warm-300 mb-5 leading-relaxed">
              {t.helpHint}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <HelpLink href="/how" label={t.helpHowItWorks} />
              <HelpLink href="/support" label={t.helpFaq} />
              <HelpLink href="/about" label={t.helpAbout} />
              <HelpLink
                href="mailto:care@chapter3five.app"
                label={t.helpContact}
                external
              />
              <HelpLink href="/terms" label={t.helpTerms} />
              <HelpLink href="/privacy" label={t.helpPrivacy} />
              <HelpLink href="/cookies" label={t.helpCookies} />
            </div>
          </Section>

          {oracleName && (
            <Section title={t.deleteOracleTitle} danger>
              <p className="text-sm text-warm-300 mb-2">
                {t.deleteOracleHint}
              </p>
              <p className="text-sm text-warm-300 mb-5">
                {t.confirmInstruction}{" "}
                <span className="text-warm-100 font-medium">{oracleName}</span>{" "}
                {t.and}{" "}
                <span className="text-warm-100 font-mono text-[0.95em]">
                  {createdIso}
                </span>
                .
              </p>
              <form action={deleteOracle} className="space-y-3">
                <input
                  type="text"
                  name="confirm_name"
                  required
                  autoComplete="off"
                  placeholder={t.oraclePlaceholder}
                  className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors"
                />
                <input
                  type="text"
                  name="confirm_date"
                  required
                  autoComplete="off"
                  placeholder="YYYY-MM-DD"
                  className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors font-mono text-sm"
                />
                <button
                  type="submit"
                  className="h-11 px-5 rounded-full border border-red-300/40 bg-red-900/20 text-red-200 hover:bg-red-900/30 transition-colors text-sm"
                >
                  {t.deleteOracleCta}
                </button>
              </form>
            </Section>
          )}

          <Section title={t.deleteAccountTitle} danger id="delete">
            <p className="text-sm text-warm-300 mb-2">
              {t.deleteAccountHint}
            </p>

            <div className="rounded-2xl border border-warm-300/30 bg-warm-700/30 px-5 py-4 mb-5">
              <p className="text-sm text-warm-100 mb-3 leading-relaxed">
                {t.beforeYouDelete}
              </p>
              <a
                href="/api/user/export"
                download
                className="inline-flex h-10 items-center justify-center rounded-full border border-warm-300/40 px-4 text-xs text-warm-100 hover:bg-warm-700/40 transition-colors"
              >
                {t.exportFirstCta}
              </a>
            </div>

            <p className="text-sm text-warm-300 mb-5">
              {t.deleteGracePeriod}
            </p>

            <p className="text-sm text-warm-300 mb-5">
              {t.confirmInstruction}{" "}
              <span className="text-warm-100 font-medium">
                {oracleName ?? user.email}
              </span>{" "}
              {t.and}{" "}
              <span className="text-warm-100 font-mono text-[0.95em]">
                {createdIso}
              </span>
              .
            </p>
            <form action={deleteAccount} className="space-y-3">
              <input
                type="text"
                name="confirm_name"
                required
                autoComplete="off"
                placeholder={
                  oracleName ? t.oraclePlaceholder : t.emailPlaceholder
                }
                className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors"
              />
              <input
                type="text"
                name="confirm_date"
                required
                autoComplete="off"
                placeholder="YYYY-MM-DD"
                className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors font-mono text-sm"
              />
              <button
                type="submit"
                className="h-11 px-5 rounded-full border border-red-300/40 bg-red-900/20 text-red-200 hover:bg-red-900/30 transition-colors text-sm"
              >
                {t.deleteAccountCta}
              </button>
            </form>

            <details className="mt-8 group">
              <summary className="text-xs text-warm-400 cursor-pointer hover:text-warm-200 transition-colors">
                {t.permanentDeleteToggle}
              </summary>
              <div className="mt-4 rounded-2xl border border-red-300/40 bg-red-900/10 px-5 py-4">
                <p className="text-sm text-red-200 mb-3 leading-relaxed">
                  {t.permanentDeleteHint}
                </p>
                <form action={deleteAccountPermanently} className="space-y-3">
                  <input
                    type="text"
                    name="confirm_name"
                    required
                    autoComplete="off"
                    placeholder={
                      oracleName ? t.oraclePlaceholder : t.emailPlaceholder
                    }
                    className="w-full h-11 rounded-full bg-warm-700/30 border border-red-300/40 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-red-200 transition-colors"
                  />
                  <input
                    type="text"
                    name="confirm_date"
                    required
                    autoComplete="off"
                    placeholder="YYYY-MM-DD"
                    className="w-full h-11 rounded-full bg-warm-700/30 border border-red-300/40 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-red-200 transition-colors font-mono text-sm"
                  />
                  <button
                    type="submit"
                    className="h-11 px-5 rounded-full border border-red-300/60 bg-red-900/40 text-red-100 hover:bg-red-900/60 transition-colors text-sm"
                  >
                    {t.permanentDeleteCta}
                  </button>
                </form>
              </div>
            </details>
          </Section>
        </div>
      </main>
    </>
  );
}

function Section({
  title,
  children,
  danger,
  id,
}: {
  title: string;
  children: React.ReactNode;
  danger?: boolean;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`mb-10 pb-10 ${danger ? "border-t border-red-300/20 pt-10" : "border-b border-warm-700/40"}`}
    >
      <h2 className="font-serif text-2xl text-warm-50 mb-4">{title}</h2>
      {children}
    </section>
  );
}

function HelpLink({
  href,
  label,
  external,
}: {
  href: string;
  label: string;
  external?: boolean;
}) {
  const className =
    "flex items-center justify-between px-4 py-3 rounded-xl border border-warm-700/60 bg-warm-700/15 text-sm text-warm-100 hover:bg-warm-700/40 transition-colors";
  if (external) {
    return (
      <a href={href} className={className}>
        <span>{label}</span>
        <span className="text-warm-400">→</span>
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      <span>{label}</span>
      <span className="text-warm-400">→</span>
    </Link>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-warm-700/30 last:border-b-0">
      <span className="text-sm text-warm-300">{label}</span>
      <span className={mono ? "text-warm-100 font-mono text-sm" : "text-warm-100"}>
        {value}
      </span>
    </div>
  );
}

const COPY = {
  en: {
    title: "Settings",
    intro: "Manage your account, language, and how chapter3five sounds.",
    back: "Back",
    saved: "Saved.",
    accountTitle: "Account",
    email: "Email",
    oracle: "Thirtyfive name",
    mode: "Mode",
    modeReal: "Real",
    modeRandomize: "Randomize",
    created: "Created",
    languageTitle: "Language",
    styleTitle: "Texting style (optional)",
    styleHint:
      "Describe how you actually text — punctuation, emojis, length, tone. Your thirtyfive will match it.",
    stylePlaceholder:
      "lowercase, no periods, lol when funny, never emojis, short replies",
    save: "Save",
    trashTitle: "Removed thirtyfives",
    trashHint:
      "These are thirtyfives you deleted recently. They’re held safely for 30 days. To bring one back, $5 — it returns exactly as it was. After the countdown, they’re gone for good.",
    daysLeft: (d: number) =>
      d === 0
        ? "Less than a day left"
        : d === 1
          ? "1 day left"
          : `${d} days left`,
    permanentlyOn: "permanently deleted on",
    bringItBack: "Bring it back — $5",
    untitled: "(untitled)",
    photoTitle: "A photo",
    photoHint:
      "Upload one photo of the person you&rsquo;re preserving — shown beside their name. Helps it feel real. JPG/PNG/WEBP, under 5MB.",
    progressTitle: "Progress",
    progressLabel: (a: number, t: number) =>
      `${a} of ${t} answered`,
    continueAnswering: "Continue answering",
    editAnswers: "View / edit answers",
    outreachTitle: "Quiet-week nudges",
    outreachHint:
      "When you haven't messaged your thirtyfive in about a week, we'll send a gentle email reminding you they're there. Off by default if you'd rather we stay out of your inbox.",
    outreachOn: "On",
    outreachOff: "Off",
    tapToDisable: "Tap to disable",
    tapToEnable: "Tap to enable",
    paymentsTitle: "Payments",
    purposeRandomize: "Randomize generation",
    purposeOracle: "New thirtyfive",
    purposeBeneficiarySlot: "Extra beneficiary slot",
    exportTitle: "Download your data",
    exportHint:
      "Get a complete JSON copy of everything chapter3five stores about you — your profile, archives, answers, conversations, payments, beneficiaries, memories. Or just the conversation, formatted for reading.",
    exportCta: "Download all (JSON)",
    exportConversation: "Download conversation",
    statusPaid: "paid",
    statusPending: "pending",
    statusFailed: "failed",
    statusRefunded: "refunded",
    shareTitle: "Share this archive",
    shareHint:
      "Generate a code that lets someone else import a copy of your archive into their own account. Useful when you want family to carry your thirtyfive forward. Codes can be revoked at any time.",
    labelPlaceholder: "Label (e.g. \"For my daughter\")",
    shareCta: "Generate code",
    justCreated:
      "Share this with the person you want to give a copy to. Each recipient signs up and enters this code at onboarding.",
    unlabeled: "no label",
    active: "active",
    revoked: "revoked",
    revoke: "Revoke",
    inviteTitle: "Invite family to this archive",
    inviteHint:
      "Send a link that lets a family member talk to the SAME thirtyfive — same answers, same photo. Each person gets their own private conversation. Different from share codes (those copy the archive into someone else's account).",
    inviteEmailPlaceholder: "Their email (optional, just a reminder for you)",
    inviteCta: "Create invite link",
    inviteJustCreated:
      "Send this link to the person you want to invite. They'll create or sign in to their own account, then can talk to your thirtyfive.",
    invitesHeading: "Invite links",
    invitePending: "pending",
    inviteAccepted: "accepted",
    noEmail: "no email",
    grantsHeading: "People with access",
    grantedOn: "Joined",
    revokeAccess: "Remove access",
    memoriesTitle: "What they remember about you",
    memoriesHint: (name: string) =>
      `Things ${name} has picked up across your conversations and now keeps as part of who you are to them. These persist even if you delete the messages — that's what makes them feel like someone who knows you, not a chatbot that resets. You can forget any of these.`,
    memoryKinds: {
      fact: "Fact",
      relationship: "Person",
      preference: "Preference",
      event: "Event",
      topic: "On their mind",
      feeling: "Feeling",
    },
    forget: "Forget this",
    beneficiaryTitle: "Beneficiaries",
    beneficiaryHint:
      "Choose who inherits this archive. If something happens to you, they'll get an email with a link to access what you've left — your answers, your texture, your voice. Three free beneficiaries; $5 per additional one.",
    beneficiarySlots: (used: number, total: number) =>
      `${used} of ${total} slots used.`,
    beneficiaryEmailPlaceholder: "Email",
    beneficiaryNamePlaceholder: "Name (optional)",
    beneficiaryAdd: "Add beneficiary",
    beneficiaryBuyMore: "Add a slot — $5",
    beneficiaryDesignated: "designated",
    beneficiaryNotified: "designated · email sent",
    beneficiaryActivated: "activated · awaiting claim",
    beneficiaryClaimed: "claimed",
    beneficiaryDeclined: "declined",
    remove: "Remove",
    legalTitle: "Legal",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    cookies: "Cookie Policy",
    deleteOracleTitle: "Delete this thirtyfive",
    deleteOracleHint:
      "Removes the character, every answer recorded, and all conversations. Your account stays. You can create a new thirtyfive from a clean slate.",
    deleteOracleCta: "Delete thirtyfive",
    deleteAccountTitle: "Delete account",
    deleteAccountHint:
      "Removes your account from chapter3five. Your archive — answers, conversations, memories, beneficiaries — is hidden from you and from anyone you've shared with.",
    beforeYouDelete:
      "Before you go — your archive is yours. Download a copy of everything you've built. You won't be able to once it's deleted.",
    exportFirstCta: "Download my data first",
    deleteGracePeriod:
      "You'll have 30 days to bring it back if you change your mind. Restoration is $5 — covers the cost of keeping your data warm in the meantime. After 30 days, it's gone for good.",
    deleteAccountCta: "Delete account",
    permanentDeleteToggle: "Or — skip the 30-day grace, delete immediately",
    permanentDeleteHint:
      "This irreversibly removes everything right now. No grace period, no recovery, no $5 to bring it back. The auth row, your archive, every photo, every conversation — gone the moment you click. Use this only if you genuinely want immediate erasure (e.g. for a privacy-sensitive reason).",
    permanentDeleteCta: "Delete forever now",
    helpTitle: "Help & legal",
    helpHint:
      "Everything you might want to revisit, in one place.",
    helpHowItWorks: "How chapter3five works",
    helpFaq: "FAQ & support",
    helpTerms: "Terms of Service",
    helpPrivacy: "Privacy Policy",
    helpCookies: "Cookie Policy",
    helpAbout: "About",
    helpContact: "Email us",
    confirmInstruction: "To confirm, type",
    and: "and",
    oraclePlaceholder: "Type the name exactly",
    emailPlaceholder: "Type your email exactly",
  },
  es: {
    title: "Ajustes",
    intro: "Administra tu cuenta, idioma, y cómo suena chapter3five.",
    back: "Atrás",
    saved: "Guardado.",
    accountTitle: "Cuenta",
    email: "Correo",
    oracle: "Nombre del thirtyfive",
    mode: "Modo",
    modeReal: "Real",
    modeRandomize: "Aleatorio",
    created: "Creada",
    languageTitle: "Idioma",
    styleTitle: "Estilo al escribir (opcional)",
    styleHint:
      "Describe cómo escribes realmente — puntuación, emojis, largo, tono. Tu thirtyfive lo igualará.",
    stylePlaceholder:
      "minúsculas, sin puntos, jaja cuando es chistoso, sin emojis, respuestas cortas",
    save: "Guardar",
    trashTitle: "Thirtyfives eliminados",
    trashHint:
      "Estos son thirtyfives que eliminaste recientemente. Los guardamos por 30 días. Para recuperar uno, $5 — vuelve exactamente como estaba. Después de la cuenta regresiva, se eliminan permanentemente.",
    daysLeft: (d: number) =>
      d === 0
        ? "Menos de un día"
        : d === 1
          ? "1 día"
          : `${d} días`,
    permanentlyOn: "eliminado permanentemente el",
    bringItBack: "Recuperarlo — $5",
    untitled: "(sin título)",
    photoTitle: "Una foto",
    photoHint:
      "Sube una foto de la persona que estás preservando — se muestra junto a su nombre. Ayuda a que se sienta real. JPG/PNG/WEBP, menos de 5MB.",
    progressTitle: "Progreso",
    progressLabel: (a: number, t: number) =>
      `${a} de ${t} respondidas`,
    continueAnswering: "Continuar respondiendo",
    editAnswers: "Ver / editar respuestas",
    outreachTitle: "Recordatorios después de una semana",
    outreachHint:
      "Cuando no le hayas escrito a tu thirtyfive por una semana más o menos, te mandamos un correo gentil para recordarte que está ahí. Apágalo si prefieres que no lleguemos a tu bandeja de entrada.",
    outreachOn: "Activado",
    outreachOff: "Apagado",
    tapToDisable: "Toca para desactivar",
    tapToEnable: "Toca para activar",
    paymentsTitle: "Pagos",
    purposeRandomize: "Generación de personaje",
    purposeOracle: "Nuevo thirtyfive",
    purposeBeneficiarySlot: "Espacio de beneficiario adicional",
    exportTitle: "Descargar tus datos",
    exportHint:
      "Obtén una copia completa en JSON de todo lo que chapter3five almacena sobre ti — tu perfil, archivos, respuestas, conversaciones, pagos, beneficiarios, memorias. O solo la conversación, formateada para leer.",
    exportCta: "Descargar todo (JSON)",
    exportConversation: "Descargar conversación",
    statusPaid: "pagado",
    statusPending: "pendiente",
    statusFailed: "fallido",
    statusRefunded: "reembolsado",
    shareTitle: "Compartir este archivo",
    shareHint:
      "Genera un código que permite que otra persona importe una copia de tu archivo en su propia cuenta. Útil cuando quieres que la familia cargue tu thirtyfive adelante. Los códigos se pueden revocar cuando quieras.",
    labelPlaceholder: "Etiqueta (p. ej. \"Para mi hija\")",
    shareCta: "Generar código",
    justCreated:
      "Compártelo con la persona a quien quieres dar una copia. El destinatario crea su cuenta y entra este código al onboarding.",
    unlabeled: "sin etiqueta",
    active: "activo",
    revoked: "revocado",
    revoke: "Revocar",
    inviteTitle: "Invitar a la familia a este archivo",
    inviteHint:
      "Envía un enlace para que un familiar hable con el MISMO thirtyfive — mismas respuestas, misma foto. Cada persona tiene su propia conversación privada. Diferente a los códigos para compartir (esos copian el archivo a la cuenta de otra persona).",
    inviteEmailPlaceholder: "Su correo (opcional, solo un recordatorio para ti)",
    inviteCta: "Crear enlace de invitación",
    inviteJustCreated:
      "Envía este enlace a la persona que quieres invitar. Creará o iniciará sesión en su propia cuenta, y luego podrá hablar con tu thirtyfive.",
    invitesHeading: "Enlaces de invitación",
    invitePending: "pendiente",
    inviteAccepted: "aceptado",
    noEmail: "sin correo",
    grantsHeading: "Personas con acceso",
    grantedOn: "Se unió",
    revokeAccess: "Quitar acceso",
    memoriesTitle: "Lo que recuerdan de ti",
    memoriesHint: (name: string) =>
      `Cosas que ${name} ha aprendido a lo largo de sus conversaciones y ahora son parte de quién eres para ellos. Esto persiste aunque borres los mensajes — eso es lo que los hace sentir como alguien que te conoce, no un chatbot que se reinicia. Puedes olvidar cualquiera de estas.`,
    memoryKinds: {
      fact: "Hecho",
      relationship: "Persona",
      preference: "Preferencia",
      event: "Evento",
      topic: "En su mente",
      feeling: "Sentimiento",
    },
    forget: "Olvidar esto",
    beneficiaryTitle: "Beneficiarios",
    beneficiaryHint:
      "Elige quién hereda este archivo. Si algo te sucede, recibirán un correo con un enlace para acceder a lo que dejaste — tus respuestas, tu textura, tu voz. Tres beneficiarios gratis; $5 por cada uno adicional.",
    beneficiarySlots: (used: number, total: number) =>
      `${used} de ${total} espacios usados.`,
    beneficiaryEmailPlaceholder: "Correo",
    beneficiaryNamePlaceholder: "Nombre (opcional)",
    beneficiaryAdd: "Agregar beneficiario",
    beneficiaryBuyMore: "Agregar un espacio — $5",
    beneficiaryDesignated: "designado",
    beneficiaryNotified: "designado · correo enviado",
    beneficiaryActivated: "activado · esperando reclamo",
    beneficiaryClaimed: "reclamado",
    beneficiaryDeclined: "declinó",
    remove: "Quitar",
    legalTitle: "Legal",
    terms: "Términos del Servicio",
    privacy: "Política de Privacidad",
    cookies: "Política de Cookies",
    deleteOracleTitle: "Eliminar este thirtyfive",
    deleteOracleHint:
      "Elimina al personaje, cada respuesta grabada y todas las conversaciones. Tu cuenta queda. Puedes crear un nuevo thirtyfive desde cero.",
    deleteOracleCta: "Eliminar thirtyfive",
    deleteAccountTitle: "Eliminar cuenta",
    deleteAccountHint:
      "Elimina tu cuenta de chapter3five. Tu archivo — respuestas, conversaciones, memorias, beneficiarios — se oculta para ti y para quien lo hayas compartido.",
    beforeYouDelete:
      "Antes de irte — tu archivo es tuyo. Descarga una copia de todo lo que has construido. No podrás hacerlo después de eliminarlo.",
    exportFirstCta: "Descargar mis datos primero",
    deleteGracePeriod:
      "Tendrás 30 días para recuperarlo si cambias de opinión. Restaurar cuesta $5 — cubre mantener tus datos. Después de 30 días, se elimina permanentemente.",
    deleteAccountCta: "Eliminar cuenta",
    permanentDeleteToggle: "O — omitir el período de 30 días, eliminar inmediatamente",
    permanentDeleteHint:
      "Esto elimina todo de forma irreversible ahora mismo. Sin período de gracia, sin recuperación, sin $5 para traerlo de vuelta. La cuenta, tu archivo, cada foto, cada conversación — desaparece en cuanto presiones. Úsalo solo si genuinamente quieres borrado inmediato.",
    permanentDeleteCta: "Eliminar para siempre ahora",
    helpTitle: "Ayuda y legal",
    helpHint:
      "Todo lo que quizás quieras revisar, en un solo lugar.",
    helpHowItWorks: "Cómo funciona chapter3five",
    helpFaq: "FAQ y soporte",
    helpTerms: "Términos del Servicio",
    helpPrivacy: "Política de Privacidad",
    helpCookies: "Política de Cookies",
    helpAbout: "Acerca de",
    helpContact: "Escríbenos",
    confirmInstruction: "Para confirmar, escribe",
    and: "y",
    oraclePlaceholder: "Escribe el nombre exacto",
    emailPlaceholder: "Escribe tu correo exacto",
  },
};
