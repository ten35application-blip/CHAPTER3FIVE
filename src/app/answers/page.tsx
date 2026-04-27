import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { questions, type Depth } from "@/content/questions";
import { updateAnswer } from "./actions";
import { VoiceAnswer } from "@/components/VoiceAnswer";
import { PhotoAnswer } from "@/components/PhotoAnswer";

export const metadata = {
  title: "Your answers — chapter3five",
};

const DEPTH_LABEL: Record<Depth, { en: string; es: string }> = {
  surface: { en: "Surface", es: "Superficie" },
  texture: { en: "Texture", es: "Textura" },
  depth: { en: "Depth", es: "Profundidad" },
  soul: { en: "Soul", es: "Alma" },
};

export default async function AnswersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; filter?: string }>;
}) {
  const { saved, error, filter } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, mode, preferred_language, active_oracle_id")
    .eq("id", user.id)
    .single();

  if (!profile?.active_oracle_id) redirect("/onboarding");

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const oracleId = profile.active_oracle_id;
  const t = COPY[language];

  const { data: answerRows } = await supabase
    .from("answers")
    .select(
      "question_id, body, audio_url, audio_duration_seconds, photo_url",
    )
    .eq("oracle_id", oracleId)
    .eq("variant", 1);

  type AnswerEntry = {
    body: string;
    audioUrl: string | null;
    audioDuration: number | null;
    photoUrl: string | null;
  };
  const answersByQ = new Map<number, AnswerEntry>();
  for (const row of answerRows ?? []) {
    answersByQ.set(row.question_id, {
      body: row.body,
      audioUrl: row.audio_url ?? null,
      audioDuration: row.audio_duration_seconds ?? null,
      photoUrl: row.photo_url ?? null,
    });
  }

  const totalAnswered = answersByQ.size;
  const totalQuestions = questions.length;

  const view = filter === "answered" ? "answered" : filter === "unanswered" ? "unanswered" : "all";
  const visible = questions.filter((q) => {
    const has = answersByQ.has(q.id);
    if (view === "answered") return has;
    if (view === "unanswered") return !has;
    return true;
  });

  return (
    <>
      <header className="border-b border-warm-700/40">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            chapter3five
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="font-serif text-4xl text-warm-50 mb-2">
            {t.title}
          </h1>
          <p className="text-warm-300 mb-2">
            {t.subtitle(profile.oracle_name ?? "your identity")}
          </p>
          <p className="text-warm-200 mb-8 text-sm">
            {totalAnswered} {t.of} {totalQuestions} {t.answered}.
          </p>

          {saved && (
            <div className="rounded-lg bg-warm-700/30 border border-warm-300/30 px-4 py-3 mb-6 text-sm text-warm-100">
              {t.saved}
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-300/30 px-4 py-3 mb-6 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-2 mb-10">
            <FilterChip
              href="/answers"
              label={t.allFilter}
              active={view === "all"}
            />
            <FilterChip
              href="/answers?filter=answered"
              label={t.answeredFilter}
              active={view === "answered"}
            />
            <FilterChip
              href="/answers?filter=unanswered"
              label={t.unansweredFilter}
              active={view === "unanswered"}
            />
          </div>

          <div className="space-y-8">
            {visible.map((q) => {
              const entry = answersByQ.get(q.id);
              const body = entry?.body ?? "";
              return (
                <div key={q.id} id={`q${q.id}`} className="space-y-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-warm-300">
                    {DEPTH_LABEL[q.depth][language]} · #{q.id}
                  </p>
                  <h2 className="font-serif text-xl text-warm-50 leading-snug">
                    {language === "es" ? q.es : q.en}
                  </h2>
                  <form action={updateAnswer} className="space-y-3">
                    <input type="hidden" name="question_id" value={q.id} />
                    <textarea
                      name="body"
                      rows={3}
                      defaultValue={body}
                      placeholder={
                        body
                          ? ""
                          : language === "es"
                            ? "Aún sin responder."
                            : "Not answered yet."
                      }
                      className="w-full rounded-2xl bg-warm-700/30 border border-warm-400/30 px-4 py-3 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors leading-relaxed font-sans text-base resize-y"
                    />
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="h-10 px-5 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors text-sm"
                      >
                        {body ? t.save : t.add}
                      </button>
                    </div>
                  </form>
                  <VoiceAnswer
                    oracleId={oracleId}
                    questionId={q.id}
                    initialAudioUrl={entry?.audioUrl ?? null}
                    initialDurationSeconds={entry?.audioDuration ?? null}
                    language={language}
                  />
                  <PhotoAnswer
                    oracleId={oracleId}
                    questionId={q.id}
                    initialPhotoUrl={entry?.photoUrl ?? null}
                    language={language}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`text-xs px-4 h-8 rounded-full inline-flex items-center transition-colors ${
        active
          ? "bg-warm-50 text-ink"
          : "border border-warm-400/30 bg-warm-700/30 text-warm-100 hover:bg-warm-700/50"
      }`}
    >
      {label}
    </Link>
  );
}

const COPY = {
  en: {
    title: "Your answers",
    subtitle: (name: string) => `Everything ${name} has on record. Edit anything, anytime.`,
    of: "of",
    answered: "answered",
    saved: "Saved.",
    back: "Back",
    save: "Save",
    add: "Add answer",
    allFilter: "All",
    answeredFilter: "Answered",
    unansweredFilter: "Unanswered",
  },
  es: {
    title: "Tus respuestas",
    subtitle: (name: string) =>
      `Todo lo que ${name} tiene registrado. Edita lo que quieras, cuando quieras.`,
    of: "de",
    answered: "respondidas",
    saved: "Guardado.",
    back: "Atrás",
    save: "Guardar",
    add: "Agregar respuesta",
    allFilter: "Todas",
    answeredFilter: "Respondidas",
    unansweredFilter: "Sin responder",
  },
};
