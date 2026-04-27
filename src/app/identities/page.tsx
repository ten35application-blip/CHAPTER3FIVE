import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  deleteOracle,
  deletePersonaMemory,
  restoreOracle,
} from "../settings/actions";
import { newOracle } from "../oracles/actions";
import { Section } from "@/components/SettingsBlocks";
import { AvatarUpload } from "@/components/AvatarUpload";
import { questions } from "@/content/questions";

export const metadata = {
  title: "Identities — chapter3five",
};

function isoDate(input: string | null | undefined): string {
  if (!input) return "—";
  return new Date(input).toISOString().slice(0, 10);
}

export default async function IdentitiesPage({
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
      "oracle_name, mode, preferred_language, created_at, avatar_url, active_oracle_id",
    )
    .eq("id", user.id)
    .single();

  const activeOracleId = profile?.active_oracle_id ?? null;

  const { count: answeredCount } = activeOracleId
    ? await supabase
        .from("answers")
        .select("id", { count: "exact", head: true })
        .eq("oracle_id", activeOracleId)
        .eq("variant", 1)
    : { count: 0 };

  const totalQuestions = questions.length;
  const progressPct = Math.round(((answeredCount ?? 0) / totalQuestions) * 100);

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

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];
  const oracleName = profile?.oracle_name ?? null;
  const createdIso = isoDate(profile?.created_at);
  const isRandom = profile?.mode === "randomize";

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
            href="/settings"
            className="text-xs uppercase tracking-[0.2em] text-warm-300 hover:text-warm-100 transition-colors"
          >
            ← {t.back}
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

          {activeOracleId && (
            <Section title={t.activeTitle}>
              <div className="rounded-2xl border border-warm-300/30 bg-warm-700/15 px-5 py-4 mb-5">
                <div className="text-xs uppercase tracking-[0.2em] text-warm-300 mb-1">
                  {t.activeLabel}
                </div>
                <div className="font-serif text-2xl text-warm-50 mb-2">
                  {oracleName ?? t.untitled}
                </div>
                <div className="text-xs text-warm-400">
                  {isRandom ? t.modeRandomize : t.modeReal} ·{" "}
                  {t.created} {createdIso}
                </div>
              </div>
            </Section>
          )}

          {activeOracleId && (
            <Section title={t.photoTitle}>
              <p className="text-sm text-warm-300 mb-4 leading-relaxed">
                {isRandom ? t.photoHintRandom : t.photoHintReal}
              </p>
              <AvatarUpload
                initialUrl={profile?.avatar_url ?? null}
                oracleId={activeOracleId}
                userId={user.id}
                language={language}
              />
            </Section>
          )}

          {!isRandom && activeOracleId && (
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
                        {m.kind}
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

          <Section title={t.createTitle}>
            <p className="text-sm text-warm-300 mb-4 leading-relaxed">
              {t.createHint}
            </p>
            <form action={newOracle}>
              <button
                type="submit"
                className="h-11 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
              >
                {t.createCta}
              </button>
            </form>
          </Section>

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
                                · {t.permanentlyOn}{" "}
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

          {oracleName && activeOracleId && (
            <Section title={t.deleteTitle(oracleName)} danger>
              <p className="text-sm text-warm-300 mb-2">{t.deleteHint}</p>
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
                  placeholder={t.namePlaceholder}
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
                  {t.deleteCta(oracleName)}
                </button>
              </form>
            </Section>
          )}
        </div>
      </main>
    </>
  );
}

const COPY = {
  en: {
    title: "Identities.",
    intro:
      "The identity you're talking to right now, plus tools to add new ones, recover deleted ones, or remove this one.",
    back: "Settings",
    saved: "Saved.",
    activeTitle: "This identity",
    activeLabel: "Active",
    untitled: "(unnamed)",
    modeReal: "Real",
    modeRandomize: "Randomized",
    created: "created",
    photoTitle: "Photo",
    photoHintReal:
      "A photo for this identity — shown beside their name. Helps it feel real. JPG/PNG/WEBP, under 5MB.",
    photoHintRandom:
      "A photo for this randomized identity — shown beside their name in chats. Optional. JPG/PNG/WEBP, under 5MB.",
    progressTitle: "Progress",
    progressLabel: (n: number, total: number) =>
      `${n.toLocaleString()} of ${total.toLocaleString()} answers recorded.`,
    continueAnswering: "Answer the next question",
    editAnswers: "Edit answers",
    memoriesTitle: "What they remember about you",
    memoriesHint: (name: string) =>
      `Specific things ${name} has picked up about you across conversations. Tap "forget" to remove any.`,
    forget: "Forget this",
    createTitle: "Create another identity",
    createHint:
      "First identity is free. Each additional identity is $5. Admin emails create unlimited.",
    createCta: "+ New identity",
    trashTitle: "Removed identities",
    trashHint:
      "These are identities you deleted recently. They're held safely for 30 days. To bring one back, $5 — it returns exactly as it was.",
    daysLeft: (d: number) =>
      d === 1 ? "1 day left" : `${d} days left`,
    permanentlyOn: "Permanently erased",
    bringItBack: "Bring it back",
    deleteTitle: (name: string) =>
      name ? `Delete ${name}` : "Delete this identity",
    deleteHint:
      "Removes this identity, every answer recorded, and all conversations with them. Your account stays. Held safely for 30 days.",
    deleteCta: (name: string) => (name ? `Delete ${name}` : "Delete identity"),
    confirmInstruction: "To confirm, type:",
    and: "and",
    namePlaceholder: "Type the name exactly",
  },
  es: {
    title: "Identidades.",
    intro:
      "La identidad con la que estás hablando ahora, más herramientas para agregar nuevas, recuperar eliminadas, o quitar esta.",
    back: "Ajustes",
    saved: "Guardado.",
    activeTitle: "Esta identidad",
    activeLabel: "Activa",
    untitled: "(sin nombre)",
    modeReal: "Real",
    modeRandomize: "Aleatoria",
    created: "creada",
    photoTitle: "Foto",
    photoHintReal:
      "Una foto para esta identidad — se muestra junto a su nombre. Ayuda a que se sienta real. JPG/PNG/WEBP, menos de 5MB.",
    photoHintRandom:
      "Una foto para esta identidad aleatoria — se muestra junto a su nombre en los chats. Opcional. JPG/PNG/WEBP, menos de 5MB.",
    progressTitle: "Progreso",
    progressLabel: (n: number, total: number) =>
      `${n.toLocaleString()} de ${total.toLocaleString()} respuestas grabadas.`,
    continueAnswering: "Responder la siguiente pregunta",
    editAnswers: "Editar respuestas",
    memoriesTitle: "Lo que recuerda de ti",
    memoriesHint: (name: string) =>
      `Cosas específicas que ${name} ha aprendido de ti a través de las conversaciones. Toca "olvidar" para quitarlas.`,
    forget: "Olvidar esto",
    createTitle: "Crear otra identidad",
    createHint:
      "La primera identidad es gratis. Cada una adicional es $5. Los correos admin crean sin límite.",
    createCta: "+ Nueva identidad",
    trashTitle: "Identidades eliminadas",
    trashHint:
      "Estas son identidades que eliminaste recientemente. Se guardan por 30 días. Para traerla de vuelta, $5 — regresa exactamente como estaba.",
    daysLeft: (d: number) =>
      d === 1 ? "1 día restante" : `${d} días restantes`,
    permanentlyOn: "Eliminada permanentemente",
    bringItBack: "Traerla de vuelta",
    deleteTitle: (name: string) =>
      name ? `Eliminar a ${name}` : "Eliminar esta identidad",
    deleteHint:
      "Elimina a esta identidad, cada respuesta grabada y todas las conversaciones con ella. Tu cuenta queda. Guardada por 30 días.",
    deleteCta: (name: string) =>
      name ? `Eliminar a ${name}` : "Eliminar identidad",
    confirmInstruction: "Para confirmar, escribe:",
    and: "y",
    namePlaceholder: "Escribe el nombre exacto",
  },
};
