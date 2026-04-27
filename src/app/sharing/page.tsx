import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createShareCode,
  revokeShareCode,
  revokeArchiveInvite,
  revokeArchiveGrant,
  removeBeneficiary,
  buyBeneficiarySlot,
  addFamilyMember,
} from "../settings/actions";

export const metadata = {
  title: "Share & inherit — chapter3five",
};

export default async function SharingPage({
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
      "oracle_name, preferred_language, active_oracle_id, paid_beneficiary_slots, texting_style, mode",
    )
    .eq("id", user.id)
    .single();

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];
  const oracleName = profile?.oracle_name ?? null;
  const activeOracleId = profile?.active_oracle_id ?? null;
  // (mode no longer matters here — texting style was removed from
  // sharing; it's now derived from the archive prose itself.)

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

  const { data: grantRows } = activeOracleId
    ? await supabase
        .from("archive_grants")
        .select("id, user_id, granted_at")
        .eq("oracle_id", activeOracleId)
        .order("granted_at", { ascending: false })
    : { data: [] };

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

  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <Link
            href="/"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            chapter3five
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
          <h1 className="font-serif text-4xl text-warm-50 mb-2">{t.title}</h1>
          <p className="text-warm-300 mb-12 leading-relaxed">{t.intro}</p>

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

          {/* Texting style is derived from how the user actually
              writes their archive answers — no separate field. The
              answer UI prompts users to write the way they'd
              actually say it. */}

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
            <Section title={t.familyTitle}>
              <p className="text-sm text-warm-300 mb-2 leading-relaxed">
                {t.familyIntro}
              </p>
              <p className="text-sm text-warm-400 mb-5">
                {t.beneficiarySlots(beneficiarySlotsUsed, beneficiarySlotsTotal)}{" "}
                {activeOracleId && (
                  <Link
                    href={`/preview/${activeOracleId}`}
                    className="text-warm-200 underline underline-offset-2 hover:text-warm-50"
                  >
                    {t.beneficiaryPreview}
                  </Link>
                )}
              </p>

              {justCreatedInvite && (
                <div className="rounded-lg border border-warm-300/40 bg-warm-700/40 px-4 py-3 mb-4 text-sm">
                  <p className="text-warm-200 mb-2">{t.inviteJustCreated}</p>
                  <code className="font-mono text-warm-50 text-base tracking-wide break-all">
                    chapter3five.app/invite/{justCreatedInvite}
                  </code>
                </div>
              )}

              {beneficiarySlotsLeft > 0 ? (
                <form action={addFamilyMember} className="space-y-3 mb-6">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder={t.familyEmailPlaceholder}
                      className="flex-1 h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                    />
                    <input
                      type="text"
                      name="name"
                      maxLength={80}
                      placeholder={t.familyNamePlaceholder}
                      className="sm:w-48 h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer text-sm text-warm-100 leading-relaxed">
                      <input
                        type="checkbox"
                        name="access_now"
                        defaultChecked
                        className="mt-1 h-4 w-4 accent-warm-300 flex-shrink-0"
                      />
                      <span>
                        <strong className="text-warm-50">{t.familyAccessNow}</strong>{" "}
                        — {t.familyAccessNowHint}
                      </span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer text-sm text-warm-100 leading-relaxed">
                      <input
                        type="checkbox"
                        name="access_after"
                        className="mt-1 h-4 w-4 accent-warm-300 flex-shrink-0"
                      />
                      <span>
                        <strong className="text-warm-50">
                          {t.familyAccessAfter}
                        </strong>{" "}
                        — {t.familyAccessAfterHint}
                      </span>
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
                  >
                    {t.familyAddCta}
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

              {/* Active live-access invites (pending or accepted). */}
              {inviteRows && inviteRows.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-warm-400 mb-1">
                    {t.invitesHeading}
                  </p>
                  {inviteRows.map((iv) => (
                    <div
                      key={iv.code}
                      className="flex items-center justify-between gap-3 px-4 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-warm-100 truncate">
                          {iv.invitee_email ?? t.noEmail}
                        </span>
                        <span className="text-xs text-warm-400 truncate">
                          {t.familyAccessNowBadge} ·{" "}
                          {iv.status === "pending"
                            ? t.invitePending
                            : iv.status === "accepted"
                              ? t.inviteAccepted
                              : t.revoked}
                          {" · "}
                          <code className="font-mono">{iv.code}</code>
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

              {/* Currently has access (already accepted invites). */}
              {grantRows && grantRows.length > 0 && (
                <div className="space-y-2 mb-3">
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

              {/* Beneficiaries (will inherit on death). */}
              {beneficiaries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-warm-400 mb-1">
                    {t.beneficiariesHeading}
                  </p>
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
                    {(b.status === "designated" || b.status === "activated") && (
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

              {/* Honest explainer of the death-notification path so
                  users know the inheritance email isn't magic. */}
              <details className="mt-8 rounded-xl border border-warm-700/60 bg-warm-700/15 px-4 py-3">
                <summary className="text-sm text-warm-200 cursor-pointer hover:text-warm-50 transition-colors">
                  {t.familyTriggerTitle}
                </summary>
                <p className="mt-3 text-sm text-warm-300 leading-relaxed">
                  {t.familyTriggerBody}
                </p>
              </details>
            </Section>
          )}
        </div>
      </main>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10 pb-10 border-b border-warm-700/40">
      <h2 className="font-serif text-2xl text-warm-50 mb-4">{title}</h2>
      {children}
    </section>
  );
}

const COPY = {
  en: {
    title: "Share & inherit.",
    intro:
      "Storing your answers and texting style for friends and family — and choosing who carries the archive forward when you can't.",
    back: "Settings",
    saved: "Saved.",
    save: "Save",
    styleTitle: "Texting style (optional)",
    styleHint:
      "Describe how you actually text — punctuation, emojis, length, tone. Your identity will match it. This is part of what gets passed forward.",
    stylePlaceholder:
      "lowercase, no periods, lol when funny, never emojis, short replies",
    styleRandomNote:
      "This identity was randomly generated and comes pre-installed with its own texting style. Nothing to edit here.",
    shareTitle: "Share this archive",
    shareHint:
      "Generate a code that lets someone else import a copy of your archive into their own account. Useful when you want family to carry your identity forward. Codes can be revoked at any time.",
    labelPlaceholder: 'Label (e.g. "for my daughter")',
    shareCta: "Generate code",
    justCreated: "Code generated:",
    unlabeled: "(unlabeled)",
    active: "active",
    revoked: "revoked",
    revoke: "Revoke",
    familyTitle: "Family who can access this archive",
    familyIntro:
      "The people who can talk to your identity now — or step into it after you're gone. Three included; $5 for each beyond that.",
    familyEmailPlaceholder: "Their email",
    familyNamePlaceholder: "Name (optional)",
    familyAccessNow: "Talk to it now",
    familyAccessNowHint:
      "We send an invite link. They sign up (or in), open this same identity in their own private thread. They don't see your conversations; you don't see theirs.",
    familyAccessAfter: "Inherit when I'm gone",
    familyAccessAfterHint:
      "When something happens to you, they get an email with a claim link to the whole archive — every answer, voice clip, photo. The identity stays in your voice but no longer pretends to still be alive.",
    familyAddCta: "Add",
    familyAccessNowBadge: "Live access",
    familyTriggerTitle: "How does the inheritance email get sent?",
    familyTriggerBody:
      "It triggers the moment your account is marked deceased. The honest current path: a family member or friend writes to care@chapter3five.app with your account email, we verify, and flip it. Every designated beneficiary then gets their claim link automatically — no logging in, no password, just the link. (We're building a periodic \"still here?\" check-in so the archive isn't dependent on someone remembering chapter3five exists. Coming soon.)",
    inviteJustCreated: "Invite link created:",
    invitesHeading: "Live access (talk to me now)",
    grantsHeading: "Currently has access",
    invitePending: "pending",
    inviteAccepted: "accepted",
    noEmail: "(no email)",
    grantedOn: "Granted",
    revokeAccess: "Revoke access",
    beneficiariesHeading: "Inheritance (when I'm gone)",
    beneficiarySlots: (used: number, total: number) =>
      `${used} of ${total} slots used.`,
    beneficiaryPreview: "Preview what they'll see →",
    beneficiaryBuyMore: "Add a slot — $5",
    beneficiaryDesignated: "designated",
    beneficiaryNotified: "designated · email sent",
    beneficiaryActivated: "activated · awaiting claim",
    beneficiaryClaimed: "claimed",
    beneficiaryDeclined: "declined",
    remove: "Remove",
  },
  es: {
    title: "Compartir y heredar.",
    intro:
      "Guardar tus respuestas y estilo para amigos y familia — y elegir quién carga el archivo adelante cuando ya no puedas.",
    back: "Ajustes",
    saved: "Guardado.",
    save: "Guardar",
    styleTitle: "Estilo al escribir (opcional)",
    styleHint:
      "Describe cómo escribes realmente — puntuación, emojis, largo, tono. Tu identidad lo igualará. Es parte de lo que se pasa adelante.",
    stylePlaceholder:
      "minúsculas, sin puntos, jaja cuando es chistoso, sin emojis, respuestas cortas",
    styleRandomNote:
      "Esta identidad se generó aleatoriamente y viene con su propio estilo al escribir. Nada que editar aquí.",
    shareTitle: "Compartir este archivo",
    shareHint:
      "Genera un código que permite que otra persona importe una copia de tu archivo en su propia cuenta. Útil cuando quieres que la familia cargue tu identidad adelante. Los códigos se pueden revocar cuando quieras.",
    labelPlaceholder: 'Etiqueta (p. ej. "para mi hija")',
    shareCta: "Generar código",
    justCreated: "Código generado:",
    unlabeled: "(sin etiqueta)",
    active: "activo",
    revoked: "revocado",
    revoke: "Revocar",
    familyTitle: "Familia con acceso a este archivo",
    familyIntro:
      "Las personas que pueden hablar con tu identidad ahora — o entrar en ella cuando ya no estés. Tres incluidas; $5 por cada una adicional.",
    familyEmailPlaceholder: "Su correo",
    familyNamePlaceholder: "Nombre (opcional)",
    familyAccessNow: "Hablarme ahora",
    familyAccessNowHint:
      "Le enviamos un enlace de invitación. Se registra (o inicia sesión), abre esta misma identidad en su propio hilo privado. No ven tus conversaciones; tú no ves las suyas.",
    familyAccessAfter: "Heredar cuando ya no esté",
    familyAccessAfterHint:
      "Cuando algo te suceda, reciben un correo con un enlace de reclamo al archivo completo — cada respuesta, audio, foto. La identidad mantiene tu voz pero ya no finge seguir viva.",
    familyAddCta: "Agregar",
    familyAccessNowBadge: "Acceso en vida",
    familyTriggerTitle: "¿Cómo se envía el correo de herencia?",
    familyTriggerBody:
      "Se dispara en el momento que tu cuenta se marca como fallecida. El camino honesto actual: un familiar o amigo escribe a care@chapter3five.app con el correo de tu cuenta, verificamos, y lo activamos. Cada beneficiario designado recibe su enlace de reclamo automáticamente — sin iniciar sesión, sin contraseña, solo el enlace. (Estamos construyendo un check-in periódico de \"¿sigues aquí?\" para que el archivo no dependa de que alguien recuerde que chapter3five existe. Pronto.)",
    inviteJustCreated: "Enlace creado:",
    invitesHeading: "Acceso en vida (hablarme ahora)",
    grantsHeading: "Tiene acceso actualmente",
    invitePending: "pendiente",
    inviteAccepted: "aceptada",
    noEmail: "(sin correo)",
    grantedOn: "Otorgado",
    revokeAccess: "Revocar acceso",
    beneficiariesHeading: "Herencia (cuando ya no esté)",
    beneficiarySlots: (used: number, total: number) =>
      `${used} de ${total} espacios usados.`,
    beneficiaryPreview: "Ver lo que verán →",
    beneficiaryBuyMore: "Agregar un espacio — $5",
    beneficiaryDesignated: "designado",
    beneficiaryNotified: "designado · correo enviado",
    beneficiaryActivated: "activado · esperando reclamo",
    beneficiaryClaimed: "reclamado",
    beneficiaryDeclined: "declinó",
    remove: "Quitar",
  },
};
