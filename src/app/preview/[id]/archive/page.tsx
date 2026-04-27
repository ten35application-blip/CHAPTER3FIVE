import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { questions, type Depth } from "@/content/questions";
import { SharedArchiveSearch } from "@/components/SharedArchiveSearch";

export const metadata = {
  title: "Preview archive — chapter3five",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEPTH_LABEL: Record<Depth, { en: string; es: string }> = {
  surface: { en: "Surface", es: "Superficie" },
  texture: { en: "Texture", es: "Textura" },
  depth: { en: "Depth", es: "Profundidad" },
  soul: { en: "Soul", es: "Alma" },
};

export default async function OwnerPreviewArchivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(
      `/auth/signin?next=${encodeURIComponent(`/preview/${id}/archive`)}`,
    );
  }

  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, preferred_language, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!oracle || oracle.user_id !== user.id) {
    redirect("/dashboard?error=Not%20your%20archive");
  }

  const language = (oracle.preferred_language ?? "en") as "en" | "es";

  const { data: answerRows } = await supabase
    .from("answers")
    .select(
      "question_id, body, audio_url, audio_duration_seconds, photo_url",
    )
    .eq("oracle_id", id)
    .eq("variant", 1);

  type Entry = {
    body: string;
    audioUrl: string | null;
    audioDuration: number | null;
    photoUrl: string | null;
  };
  const answersByQ = new Map<number, Entry>();
  for (const row of answerRows ?? []) {
    answersByQ.set(row.question_id, {
      body: row.body,
      audioUrl: row.audio_url ?? null,
      audioDuration: row.audio_duration_seconds ?? null,
      photoUrl: row.photo_url ?? null,
    });
  }

  const ownerName = oracle.name ?? (language === "es" ? "Tú" : "You");

  const entries = questions
    .filter((q) => answersByQ.has(q.id))
    .map((q) => {
      const a = answersByQ.get(q.id)!;
      return {
        id: q.id,
        question: language === "es" ? q.es : q.en,
        depthLabel: DEPTH_LABEL[q.depth][language],
        depth: q.depth,
        body: a.body,
        audioUrl: a.audioUrl,
        audioDuration: a.audioDuration,
        photoUrl: a.photoUrl,
      };
    });

  const banner =
    language === "es"
      ? "VISTA PREVIA — esto es exactamente lo que verán tus beneficiarios."
      : "PREVIEW — this is exactly what your beneficiaries will see.";

  return (
    <>
      <div className="bg-warm-50 text-ink py-2 px-4 text-center text-xs uppercase tracking-[0.25em] font-medium">
        {banner}
      </div>

      <header className="border-b border-warm-700/40">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link
            href={`/preview/${id}`}
            className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
          >
            {oracle.name ?? "your archive"}
          </Link>
          <span className="text-xs uppercase tracking-[0.2em] text-warm-300">
            {language === "es" ? "Archivo" : "Archive"}
          </span>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <h1 className="font-serif text-4xl text-warm-50 mb-2">
            <span className="italic font-light">
              {language === "es"
                ? `Lo que ${oracle.name ?? "tú"} dejó.`
                : `What ${oracle.name ?? "you"} left.`}
            </span>
          </h1>
          <p className="text-warm-300 mb-8 leading-relaxed">
            {language === "es"
              ? `${entries.length} de ${questions.length} respuestas.`
              : `${entries.length} of ${questions.length} answers.`}
          </p>

          <SharedArchiveSearch
            entries={entries}
            language={language}
            ownerName={ownerName}
          />
        </div>
      </main>
    </>
  );
}
