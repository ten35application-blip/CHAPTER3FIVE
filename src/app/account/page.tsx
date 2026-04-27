import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateLanguage,
  updateTheme,
  toggleOutreach,
  deleteAccount,
  deleteAccountPermanently,
} from "../settings/actions";
import { Section, Row, HelpLink } from "@/components/SettingsBlocks";

export const metadata = {
  title: "Your account — chapter3five",
};

function isoDate(input: string | null | undefined): string {
  if (!input) return "—";
  return new Date(input).toISOString().slice(0, 10);
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "oracle_name, mode, preferred_language, created_at, outreach_enabled, theme",
    )
    .eq("id", user.id)
    .single();

  const { data: paymentRows } = await supabase
    .from("payments")
    .select(
      "amount_cents, currency, purpose, status, paid_at, refunded_at, created_at",
    )
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
        <div className="max-w-2xl mx-auto px-6 py-12">
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

          <Section title={t.accountTitle}>
            <Row label={t.email} value={user.email ?? "—"} />
            <Row label={t.created} value={createdIso} mono />
          </Section>

          <Section title={t.languageTitle}>
            <form action={updateLanguage} className="flex items-center gap-3">
              <div className="relative">
                <select
                  name="language"
                  defaultValue={language}
                  className="h-11 rounded-full bg-warm-700/40 border-2 border-warm-300/50 pl-5 pr-10 text-warm-50 focus:outline-none focus:border-warm-200 appearance-none cursor-pointer hover:bg-warm-700/60 transition-colors text-sm"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
                <svg
                  aria-hidden
                  viewBox="0 0 12 8"
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-3 h-2 text-warm-200 pointer-events-none"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="1 1.5 6 6.5 11 1.5" />
                </svg>
              </div>
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
              >
                {t.save}
              </button>
            </form>
          </Section>

          <Section title={t.themeTitle}>
            <p className="text-sm text-warm-300 mb-4 leading-relaxed">
              {t.themeHint}
            </p>
            <form
              action={updateTheme}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              <ThemeOption
                value="dusk"
                current={profile?.theme ?? "dusk"}
                title={t.themeDusk}
                body={t.themeDuskBody}
                swatchBg="#1a140f"
                swatchFg="#fff8ec"
                swatchAccent="#d8b27a"
              />
              <ThemeOption
                value="daylight"
                current={profile?.theme ?? "dusk"}
                title={t.themeDaylight}
                body={t.themeDaylightBody}
                swatchBg="#faf2dd"
                swatchFg="#2a1d10"
                swatchAccent="#785836"
              />
            </form>
          </Section>

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
                {profile?.outreach_enabled ? t.outreachOn : t.outreachOff}
              </button>
              <span className="text-xs text-warm-400">
                {profile?.outreach_enabled ? t.tapToDisable : t.tapToEnable}
              </span>
            </form>
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
                            : new Date(p.created_at).toLocaleDateString()}
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
            <a
              href="/api/user/export"
              download
              className="inline-flex h-11 items-center justify-center rounded-full border border-warm-300/40 px-5 text-sm text-warm-100 hover:bg-warm-700/40 transition-colors"
            >
              {t.exportCta}
            </a>
          </Section>

          <Section title={t.deleteAccountTitle} danger id="delete">
            <p className="text-sm text-warm-300 mb-2">{t.deleteAccountHint}</p>

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

            <p className="text-sm text-warm-300 mb-5">{t.deleteGracePeriod}</p>

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
                placeholder={oracleName ? t.namePlaceholder : t.emailPlaceholder}
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
                      oracleName ? t.namePlaceholder : t.emailPlaceholder
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
        </div>
      </main>
    </>
  );
}

function ThemeOption({
  value,
  current,
  title,
  body,
  swatchBg,
  swatchFg,
  swatchAccent,
}: {
  value: string;
  current: string;
  title: string;
  body: string;
  swatchBg: string;
  swatchFg: string;
  swatchAccent: string;
}) {
  const isCurrent = value === current;
  return (
    <button
      type="submit"
      name="theme"
      value={value}
      className={`text-left rounded-2xl border p-4 transition-colors ${
        isCurrent
          ? "border-warm-50 bg-warm-700/30"
          : "border-warm-700/60 bg-warm-700/15 hover:bg-warm-700/30 hover:border-warm-300/50"
      }`}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-xl border flex-shrink-0 overflow-hidden"
          style={{ background: swatchBg, borderColor: swatchAccent }}
          aria-hidden
        >
          <div className="h-1/2" style={{ background: swatchBg }} />
          <div className="h-px" style={{ background: swatchAccent }} />
          <div
            className="h-[calc(50%-1px)] flex items-center justify-center"
            style={{ background: swatchBg }}
          >
            <span style={{ color: swatchFg, fontSize: 10 }}>Aa</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-serif text-lg text-warm-50">
            {title}
            {isCurrent && (
              <span className="text-[10px] uppercase tracking-[0.2em] ml-2 text-warm-200">
                ✓
              </span>
            )}
          </p>
          <p className="text-xs text-warm-300 leading-relaxed mt-1">{body}</p>
        </div>
      </div>
    </button>
  );
}

const COPY = {
  en: {
    title: "Your account.",
    intro: "Your email, language, billing, and the data you put into chapter3five.",
    back: "Settings",
    saved: "Saved.",
    save: "Save",
    accountTitle: "Account",
    email: "Email",
    created: "Created",
    languageTitle: "Language",
    themeTitle: "Theme",
    themeHint:
      "Pick how the app reads. Dusk is the default — warm and dark, made for reading at night. Daylight inverts it for bright rooms while keeping the warm tone.",
    themeDusk: "Dusk",
    themeDuskBody: "Warm-dark. Default.",
    themeDaylight: "Daylight",
    themeDaylightBody: "Warm parchment, deep sepia text.",
    outreachTitle: "Quiet-week nudges",
    outreachHint:
      "When you haven't messaged your identity in about a week, we'll send a gentle email reminding you they're there. Off by default if you'd rather we stay out of your inbox.",
    outreachOn: "On",
    outreachOff: "Off",
    tapToEnable: "Tap to enable",
    tapToDisable: "Tap to disable",
    paymentsTitle: "Payments",
    purposeRandomize: "Randomized identity",
    purposeOracle: "Additional identity",
    purposeBeneficiarySlot: "Beneficiary slot",
    exportTitle: "Your data",
    exportHint:
      "Get a complete JSON copy of everything chapter3five stores about you — your profile, archives, answers, conversations, payments, beneficiaries, memories.",
    exportCta: "Download my data",
    deleteAccountTitle: "Delete account",
    deleteAccountHint:
      "Removes your account from chapter3five. Your archive — answers, conversations, memories, beneficiaries — is hidden from you and from anyone you've shared with.",
    beforeYouDelete:
      "Before you go — your archive is yours. Download a copy of everything you've built. You won't be able to once it's deleted.",
    exportFirstCta: "Download my data first",
    deleteGracePeriod:
      "Held safely for 30 days in case you change your mind. After that, permanently erased.",
    confirmInstruction: "To confirm, type:",
    and: "and",
    namePlaceholder: "Type the name exactly",
    emailPlaceholder: "Type your email exactly",
    deleteAccountCta: "Delete my account",
    permanentDeleteToggle: "Or — delete forever now (no 30-day grace)",
    permanentDeleteHint:
      "This skips the grace period. Account, all identities, every message, every memory — gone immediately. Cannot be undone.",
    permanentDeleteCta: "Delete everything forever, now",
    helpTitle: "Help & legal",
    helpHint: "Documentation, support, and the legal stuff.",
    helpHowItWorks: "How chapter3five works",
    helpFaq: "FAQ & support",
    helpAbout: "About",
    helpContact: "Email us",
    helpTerms: "Terms of Service",
    helpPrivacy: "Privacy Policy",
    helpCookies: "Cookie Policy",
  },
  es: {
    title: "Tu cuenta.",
    intro:
      "Tu correo, idioma, pagos, y los datos que pones en chapter3five.",
    back: "Ajustes",
    saved: "Guardado.",
    save: "Guardar",
    accountTitle: "Cuenta",
    email: "Correo",
    created: "Creada",
    languageTitle: "Idioma",
    themeTitle: "Tema",
    themeHint:
      "Elige cómo se lee la app. Dusk es lo predeterminado — cálido y oscuro, hecho para leer de noche. Daylight lo invierte para cuartos con luz manteniendo el tono cálido.",
    themeDusk: "Dusk",
    themeDuskBody: "Cálido y oscuro. Predeterminado.",
    themeDaylight: "Daylight",
    themeDaylightBody: "Pergamino cálido, texto sepia profundo.",
    outreachTitle: "Recordatorios de la semana",
    outreachHint:
      "Cuando no le hayas escrito a tu identidad por una semana más o menos, te mandamos un correo gentil para recordarte que está ahí. Apágalo si prefieres que no lleguemos a tu bandeja de entrada.",
    outreachOn: "Activado",
    outreachOff: "Apagado",
    tapToEnable: "Toca para activar",
    tapToDisable: "Toca para apagar",
    paymentsTitle: "Pagos",
    purposeRandomize: "Identidad aleatoria",
    purposeOracle: "Identidad adicional",
    purposeBeneficiarySlot: "Espacio de beneficiario",
    exportTitle: "Tus datos",
    exportHint:
      "Descarga una copia completa de todo lo que chapter3five guarda de ti — tu perfil, archivos, respuestas, conversaciones, pagos, beneficiarios, memorias.",
    exportCta: "Descargar mis datos",
    deleteAccountTitle: "Eliminar cuenta",
    deleteAccountHint:
      "Elimina tu cuenta de chapter3five. Tu archivo — respuestas, conversaciones, memorias, beneficiarios — se oculta para ti y para quien lo hayas compartido.",
    beforeYouDelete:
      "Antes de irte — tu archivo es tuyo. Descarga una copia de todo lo que construiste. No podrás una vez eliminado.",
    exportFirstCta: "Descargar mis datos primero",
    deleteGracePeriod:
      "Guardado por 30 días por si cambias de opinión. Después se borra permanentemente.",
    confirmInstruction: "Para confirmar, escribe:",
    and: "y",
    namePlaceholder: "Escribe el nombre exacto",
    emailPlaceholder: "Escribe tu correo exacto",
    deleteAccountCta: "Eliminar mi cuenta",
    permanentDeleteToggle: "O — eliminar para siempre ya (sin gracia)",
    permanentDeleteHint:
      "Esto salta el periodo de gracia. Cuenta, todas las identidades, cada mensaje, cada memoria — desaparecen inmediatamente. No se puede deshacer.",
    permanentDeleteCta: "Eliminar todo para siempre, ya",
    helpTitle: "Ayuda y legal",
    helpHint: "Documentación, soporte, y lo legal.",
    helpHowItWorks: "Cómo funciona chapter3five",
    helpFaq: "FAQ y soporte",
    helpAbout: "Acerca de",
    helpContact: "Escríbenos",
    helpTerms: "Términos del Servicio",
    helpPrivacy: "Política de Privacidad",
    helpCookies: "Política de Cookies",
  },
};
