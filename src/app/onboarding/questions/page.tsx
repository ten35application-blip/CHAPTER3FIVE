import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { questions } from "@/content/questions";
import { saveAnswer, skipForNow } from "./actions";

export const metadata = {
  title: "Questions — chapter3five",
};

const DEPTH_LABEL: Record<string, { en: string; es: string }> = {
  surface: { en: "Surface", es: "Superficie" },
  texture: { en: "Texture", es: "Textura" },
  depth: { en: "Depth", es: "Profundidad" },
  soul: { en: "Soul", es: "Alma" },
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; qid?: string }>;
}) {
  const { error, qid } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "oracle_name, mode, preferred_language, onboarding_completed, active_oracle_id",
    )
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  if (profile.mode === "randomize") redirect("/onboarding/randomize");
  if (profile.onboarding_completed) redirect("/dashboard");

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const oracleId = profile.active_oracle_id;

  let existingQuery = supabase
    .from("answers")
    .select("question_id, body")
    .eq("variant", 1);
  if (oracleId) {
    existingQuery = existingQuery.eq("oracle_id", oracleId);
  } else {
    existingQuery = existingQuery.eq("user_id", user.id);
  }
  const { data: existing } = await existingQuery;

  const answered = new Set((existing ?? []).map((a) => a.question_id));
  const answersByQid = new Map(
    (existing ?? []).map((a) => [a.question_id, a.body ?? ""]),
  );

  // If the user navigated here with ?qid=X (typically via the
  // ← Previous link), honor that and show the requested question
  // — even if it's already been answered (so they can edit it).
  // Otherwise auto-find the next unanswered question.
  const explicitQid = qid ? Number(qid) : null;
  const explicit =
    explicitQid && Number.isFinite(explicitQid)
      ? questions.find((q) => q.id === explicitQid)
      : null;
  const next = explicit ?? questions.find((q) => !answered.has(q.id));

  if (!next) {
    redirect("/agreements");
  }

  // Find the previous question in the canonical order — used to
  // wire a "← Previous question" link.
  const currentIndex = questions.findIndex((q) => q.id === next.id);
  const prevQuestion =
    currentIndex > 0 ? questions[currentIndex - 1] : null;
  const existingBody = answersByQid.get(next.id) ?? "";

  const total = questions.length;
  const answeredCount = answered.size;
  const progress = Math.round((answeredCount / total) * 100);
  const depthLabel = DEPTH_LABEL[next.depth]?.[language] ?? next.depth;

  const promptText = language === "es" ? next.es : next.en;
  const placeholder =
    language === "es"
      ? "Tómate tu tiempo. No hay respuesta correcta."
      : "Take your time. There's no right answer.";
  const continueLabel = language === "es" ? "Guardar y continuar" : "Save & continue";
  const laterLabel = language === "es" ? "Continuar después" : "Continue later";
  const ofLabel = language === "es" ? "de" : "of";
  const writeAsYouSpeak =
    language === "es"
      ? "Escríbelo como lo dirías. Tu identidad va a sonar como tú escribes aquí — minúsculas, abreviaciones, emojis, puntuación, todo. Mejor resultado: sé tú mismo."
      : "Write it the way you'd actually say it. Your identity will sound exactly like how you write here — lowercase, abbreviations, emojis, punctuation, all of it. Best results: be yourself.";

  return (
    <main className="flex-1 flex flex-col px-6 py-8">
      <header className="max-w-3xl mx-auto w-full flex items-center justify-between mb-12">
        <Link
          href="/"
          className="font-serif text-lg tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
        >
          chapter3five
        </Link>
        <div className="text-xs uppercase tracking-[0.2em] text-warm-300">
          {answeredCount + 1} {ofLabel} {total}
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full">
        <div className="h-px bg-warm-700 relative mb-16">
          <div
            className="absolute inset-y-0 left-0 bg-warm-300/60 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2 mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-warm-300">
            {depthLabel}
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl text-warm-50 leading-snug max-w-2xl mx-auto">
            {promptText}
          </h1>
        </div>

        <p className="text-sm text-warm-300 italic text-center mb-6 max-w-xl mx-auto leading-relaxed">
          {writeAsYouSpeak}
        </p>

        <form action={saveAnswer} className="space-y-6">
          <input type="hidden" name="question_id" value={next.id} />
          <textarea
            name="body"
            required
            rows={8}
            defaultValue={existingBody}
            placeholder={placeholder}
            className="w-full rounded-2xl bg-warm-700/30 border border-warm-400/30 px-5 py-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors resize-y leading-relaxed font-sans text-base"
          />

          {error && (
            <p className="text-sm text-red-300/80 text-center">{error}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-4">
            <button
              type="submit"
              className="h-12 px-8 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors order-2 sm:order-1"
            >
              {continueLabel}
            </button>
            <span className="text-xs text-warm-400 order-1 sm:order-2">
              {language === "es"
                ? `Llevas ${answeredCount} respondida${answeredCount === 1 ? "" : "s"}.`
                : `You've answered ${answeredCount} so far.`}
            </span>
          </div>
        </form>

        <div className="mt-12 flex items-center justify-between gap-4">
          {prevQuestion ? (
            <Link
              href={`/onboarding/questions?qid=${prevQuestion.id}`}
              className="text-sm text-warm-400 hover:text-warm-200 transition-colors"
            >
              ← {language === "es" ? "Pregunta anterior" : "Previous question"}
            </Link>
          ) : (
            <span />
          )}

          <form action={skipForNow}>
            <button
              type="submit"
              className="text-sm text-warm-400 hover:text-warm-200 transition-colors"
            >
              {laterLabel} →
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
