import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  deleteOracle,
  deletePersonaMemory,
  restoreOracle,
} from "../settings/actions";
import { newOracle, switchOracle, renameOracle } from "../oracles/actions";
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
    .select("preferred_language, active_oracle_id")
    .eq("id", user.id)
    .single();

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];
  const activeOracleId = profile?.active_oracle_id ?? null;

  // Every identity the user owns that isn't soft-deleted, oldest first.
  const { data: oracleRows } = await supabase
    .from("oracles")
    .select(
      "id, name, mode, avatar_url, created_at, preferred_language",
    )
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  const oracles = oracleRows ?? [];

  // Soft-deleted identities still in the 30-day grace window.
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

  // Memories per (oracle, user) for whatever's currently active.
  const { data: memoryRows } = activeOracleId
    ? await supabase
        .from("persona_memories")
        .select("id, kind, content, created_at, oracle_id")
        .in("oracle_id", oracles.map((o) => o.id))
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };
  const memoriesByOracle = new Map<string, typeof memoryRows>();
  for (const m of memoryRows ?? []) {
    const list = memoriesByOracle.get(m.oracle_id) ?? [];
    list.push(m);
    memoriesByOracle.set(m.oracle_id, list);
  }

  // Per-identity answer counts (for the progress widget on real-mode
  // identities). One query, group in JS.
  const { data: answerRows } = oracles.length
    ? await supabase
        .from("answers")
        .select("oracle_id")
        .in(
          "oracle_id",
          oracles.map((o) => o.id),
        )
        .eq("variant", 1)
    : { data: [] };
  const answeredByOracle = new Map<string, number>();
  for (const a of answerRows ?? []) {
    answeredByOracle.set(
      a.oracle_id,
      (answeredByOracle.get(a.oracle_id) ?? 0) + 1,
    );
  }
  const totalQuestions = questions.length;

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

          {/* List every identity. Each one is a collapsible card; open
              to see photo + actions (set active, view memories,
              delete). */}
          <div className="space-y-4 mb-10">
            {oracles.map((o) => {
              const isActive = o.id === activeOracleId;
              const isRandom = o.mode === "randomize";
              const created = isoDate(o.created_at);
              const memories = memoriesByOracle.get(o.id) ?? [];
              const answered = answeredByOracle.get(o.id) ?? 0;
              const progressPct = Math.round(
                (answered / totalQuestions) * 100,
              );
              return (
                <details
                  key={o.id}
                  open={isActive}
                  className="group rounded-2xl border border-warm-700/60 bg-warm-700/15 overflow-hidden"
                >
                  <summary className="cursor-pointer px-5 py-4 flex items-center gap-4 hover:bg-warm-700/30 transition-colors list-none">
                    {o.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.avatar_url}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover border border-warm-300/30 flex-shrink-0"
                      />
                    ) : (
                      <span className="w-12 h-12 rounded-full bg-warm-700/40 border border-warm-300/30 flex-shrink-0 inline-block" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-xl text-warm-50 truncate">
                          {o.name?.trim() || t.unnamed}
                        </span>
                        {isActive && (
                          <span className="text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full bg-warm-50 text-ink font-medium flex-shrink-0">
                            {t.active}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-warm-400 mt-0.5">
                        {isRandom ? t.modeRandomize : t.modeReal} · {t.created}{" "}
                        {created}
                      </div>
                    </div>
                    <span className="text-warm-300 transition-transform group-open:rotate-180 text-sm">
                      ▾
                    </span>
                  </summary>

                  <div className="border-t border-warm-700/60 px-5 py-5 space-y-6 bg-warm-700/10">
                    {/* Photo */}
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-warm-300 mb-3">
                        {t.photoLabel}
                      </p>
                      <p className="text-sm text-warm-300 mb-3 leading-relaxed">
                        {isRandom ? t.photoHintRandom : t.photoHintReal}
                      </p>
                      <AvatarUpload
                        initialUrl={o.avatar_url}
                        oracleId={o.id}
                        userId={user.id}
                        language={language}
                      />
                    </div>

                    {/* Rename — only for identities you named (not random). */}
                    {!isRandom && (
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-warm-300 mb-2">
                          {t.renameLabel}
                        </p>
                        <p className="text-sm text-warm-300 mb-3 leading-relaxed">
                          {t.renameHint}
                        </p>
                        <form
                          action={renameOracle}
                          className="flex gap-2 items-center"
                        >
                          <input
                            type="hidden"
                            name="oracle_id"
                            value={o.id}
                          />
                          <input
                            type="text"
                            name="name"
                            defaultValue={o.name ?? ""}
                            maxLength={60}
                            required
                            className="flex-1 h-10 rounded-full bg-warm-700/30 border border-warm-400/30 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                          />
                          <button
                            type="submit"
                            className="h-10 px-4 rounded-full bg-warm-50 text-ink text-sm font-medium hover:bg-warm-100 transition-colors flex-shrink-0"
                          >
                            {t.renameCta}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* Set active (if not already) */}
                    {!isActive && (
                      <div>
                        <form action={switchOracle}>
                          <input
                            type="hidden"
                            name="oracle_id"
                            value={o.id}
                          />
                          <button
                            type="submit"
                            className="h-10 px-4 rounded-full bg-warm-50 text-ink text-sm font-medium hover:bg-warm-100 transition-colors"
                          >
                            {t.setActive}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* Progress (real mode) */}
                    {!isRandom && (
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-warm-300 mb-2">
                          {t.progressLabel}
                        </p>
                        <div className="flex items-baseline justify-between mb-2">
                          <p className="text-sm text-warm-200">
                            {t.progressText(answered, totalQuestions)}
                          </p>
                          <p className="text-warm-300 text-xs">
                            {progressPct}%
                          </p>
                        </div>
                        <div className="h-1 bg-warm-700/60 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-warm-300/80 transition-all"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        {isActive && (
                          <div className="mt-3 flex flex-wrap gap-3 text-sm">
                            <Link
                              href="/onboarding/questions"
                              className="text-warm-200 underline underline-offset-2 hover:text-warm-50"
                            >
                              {t.continueAnswering}
                            </Link>
                            <Link
                              href="/answers"
                              className="text-warm-200 underline underline-offset-2 hover:text-warm-50"
                            >
                              {t.editAnswers}
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Memories this identity has formed about you */}
                    {memories.length > 0 && (
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-warm-300 mb-3">
                          {t.memoriesLabel}
                        </p>
                        <div className="space-y-2">
                          {memories.slice(0, 8).map((m) => (
                            <div
                              key={m.id}
                              className="flex items-start justify-between gap-3 px-3 py-2 rounded-lg border border-warm-700/60 bg-warm-700/15"
                            >
                              <span className="text-sm text-warm-100 leading-relaxed flex-1">
                                {m.content}
                              </span>
                              <form action={deletePersonaMemory}>
                                <input
                                  type="hidden"
                                  name="id"
                                  value={m.id}
                                />
                                <button
                                  type="submit"
                                  className="text-xs text-warm-400 hover:text-warm-200 transition-colors whitespace-nowrap"
                                >
                                  {t.forget}
                                </button>
                              </form>
                            </div>
                          ))}
                          {memories.length > 8 && (
                            <p className="text-xs text-warm-400 italic">
                              {t.moreMemories(memories.length - 8)}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Delete this identity */}
                    <details className="border-t border-warm-700/60 pt-5">
                      <summary className="cursor-pointer text-sm text-red-300/80 hover:text-red-200 transition-colors">
                        {t.deleteToggle(o.name?.trim() || t.unnamed)}
                      </summary>
                      <div className="mt-4 rounded-2xl border border-red-300/30 bg-red-900/10 px-4 py-4">
                        <p className="text-sm text-warm-300 mb-2">
                          {t.deleteHint}
                        </p>
                        <p className="text-sm text-warm-300 mb-4">
                          {t.confirmInstruction}{" "}
                          <span className="text-warm-100 font-medium">
                            {o.name?.trim() || t.unnamed}
                          </span>{" "}
                          {t.and}{" "}
                          <span className="text-warm-100 font-mono text-[0.95em]">
                            {created}
                          </span>
                          .
                        </p>
                        <form action={deleteOracle} className="space-y-3">
                          <input type="hidden" name="oracle_id" value={o.id} />
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
                            {t.deleteCta(o.name?.trim() || t.unnamed)}
                          </button>
                        </form>
                      </div>
                    </details>
                  </div>
                </details>
              );
            })}

            {oracles.length === 0 && (
              <p className="text-warm-300 italic text-center py-8">
                {t.empty}
              </p>
            )}
          </div>

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
                          {o.name?.trim() || t.unnamed}
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
        </div>
      </main>
    </>
  );
}

const COPY = {
  en: {
    title: "Identities.",
    intro:
      "Every identity you've created. Tap one to expand — change its photo, set it active, see what it remembers about you, or delete it.",
    back: "Settings",
    saved: "Saved.",
    unnamed: "(unnamed)",
    active: "Active",
    modeReal: "Real",
    modeRandomize: "Randomized",
    created: "created",
    photoLabel: "Photo",
    photoHintReal:
      "A photo for this identity — shown beside their name. Helps it feel real.",
    photoHintRandom:
      "A photo for this randomized identity — shown beside their name in chats. Optional.",
    setActive: "Set as active",
    renameLabel: "Name",
    renameHint:
      "Rename this identity. The new name shows up everywhere — dashboard, chats, beneficiary view.",
    renameCta: "Save",
    progressLabel: "Progress",
    progressText: (n: number, total: number) =>
      `${n.toLocaleString()} of ${total.toLocaleString()} answers recorded.`,
    continueAnswering: "Answer the next question →",
    editAnswers: "Edit answers →",
    memoriesLabel: "What they remember about you",
    forget: "Forget",
    moreMemories: (n: number) => `+ ${n} more`,
    deleteToggle: (name: string) => `Delete ${name}…`,
    deleteHint:
      "Soft-delete with 30-day grace. Held safely so you can restore for $5.",
    confirmInstruction: "To confirm, type:",
    and: "and",
    namePlaceholder: "Type the name exactly",
    deleteCta: (name: string) => `Delete ${name}`,
    empty: "No identities yet.",
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
  },
  es: {
    title: "Identidades.",
    intro:
      "Cada identidad que has creado. Toca una para expandir — cambia su foto, hazla activa, ve lo que recuerda de ti, o elimínala.",
    back: "Ajustes",
    saved: "Guardado.",
    unnamed: "(sin nombre)",
    active: "Activa",
    modeReal: "Real",
    modeRandomize: "Aleatoria",
    created: "creada",
    photoLabel: "Foto",
    photoHintReal:
      "Una foto para esta identidad — se muestra junto a su nombre. Ayuda a que se sienta real.",
    photoHintRandom:
      "Una foto para esta identidad aleatoria — se muestra junto a su nombre en los chats. Opcional.",
    setActive: "Hacerla activa",
    renameLabel: "Nombre",
    renameHint:
      "Renombra esta identidad. El nuevo nombre aparece en todos lados — dashboard, chats, vista de beneficiarios.",
    renameCta: "Guardar",
    progressLabel: "Progreso",
    progressText: (n: number, total: number) =>
      `${n.toLocaleString()} de ${total.toLocaleString()} respuestas grabadas.`,
    continueAnswering: "Responder la siguiente pregunta →",
    editAnswers: "Editar respuestas →",
    memoriesLabel: "Lo que recuerda de ti",
    forget: "Olvidar",
    moreMemories: (n: number) => `+ ${n} más`,
    deleteToggle: (name: string) => `Eliminar a ${name}…`,
    deleteHint:
      "Eliminación suave con 30 días de gracia. Se guarda para que puedas restaurar por $5.",
    confirmInstruction: "Para confirmar, escribe:",
    and: "y",
    namePlaceholder: "Escribe el nombre exacto",
    deleteCta: (name: string) => `Eliminar a ${name}`,
    empty: "Aún no hay identidades.",
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
  },
};
