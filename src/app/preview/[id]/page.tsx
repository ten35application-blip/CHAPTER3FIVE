import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";

export const metadata = {
  title: "Preview — chapter3five",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OwnerPreviewWelcomePage({
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
    redirect(`/auth/signin?next=${encodeURIComponent(`/preview/${id}`)}`);
  }

  // Owner-only: this is YOUR own oracle — preview what your
  // beneficiaries will see when they open it.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, preferred_language, avatar_url, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!oracle || oracle.user_id !== user.id) {
    redirect("/dashboard?error=Not%20your%20archive");
  }

  const { data: stats } = await supabase
    .from("answers")
    .select("audio_url, photo_url")
    .eq("oracle_id", id)
    .eq("variant", 1);
  const voiceCount = (stats ?? []).filter((a) => a.audio_url).length;
  const photoCount = (stats ?? []).filter((a) => a.photo_url).length;
  const answerCount = (stats ?? []).length;

  const language = (oracle.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];
  const oracleName = oracle.name ?? t.fallbackName;

  return (
    <>
      <PreviewBanner language={language} />

      <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
          <Orb size={520} />
        </div>

        <div className="relative w-full max-w-xl flex flex-col items-center text-center">
          <span className="font-serif text-xl tracking-tight text-warm-100 mb-12">
            chapter3five
          </span>

          {oracle.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={oracle.avatar_url}
              alt=""
              className="w-24 h-24 rounded-full object-cover mb-8 border border-warm-300/30"
            />
          )}

          <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 leading-tight mb-6">
            <span className="italic font-light">
              {t.headline(oracleName)}
            </span>
          </h1>

          <p className="text-warm-200 leading-relaxed text-base max-w-md mb-10">
            {t.opening(oracleName)}
          </p>

          <div className="w-full text-left space-y-5 mb-12 px-2">
            <Item title={t.itemChatTitle} body={t.itemChatBody(oracleName)} />
            <Item
              title={t.itemArchiveTitle(answerCount)}
              body={t.itemArchiveBody(voiceCount, photoCount)}
            />
            <Item title={t.itemPrivateTitle} body={t.itemPrivateBody} />
            <Item title={t.itemDownloadTitle} body={t.itemDownloadBody} />
            <Item title={t.itemNotTherapyTitle} body={t.itemNotTherapyBody} />
          </div>

          <Link
            href={`/preview/${id}/archive`}
            className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors w-full"
          >
            {t.previewArchive}
          </Link>

          <Link
            href="/settings"
            className="mt-4 text-sm text-warm-300 hover:text-warm-100 transition-colors"
          >
            {t.backToSettings}
          </Link>
        </div>
      </main>
    </>
  );
}

function PreviewBanner({ language }: { language: "en" | "es" }) {
  const text =
    language === "es"
      ? "VISTA PREVIA — esto es exactamente lo que verán tus beneficiarios."
      : "PREVIEW — this is exactly what your beneficiaries will see.";
  return (
    <div className="bg-warm-50 text-ink py-2 px-4 text-center text-xs uppercase tracking-[0.25em] font-medium">
      {text}
    </div>
  );
}

function Item({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-warm-700/60 bg-warm-700/15 px-5 py-4">
      <p className="text-sm font-medium text-warm-50 mb-1">{title}</p>
      <p className="text-xs text-warm-200 leading-relaxed">{body}</p>
    </div>
  );
}

const COPY = {
  en: {
    fallbackName: "your archive",
    headline: (name: string) => `Welcome to ${name}'s archive.`,
    opening: (name: string) =>
      `${name} invited you to their archive — a record of who they are, in their own words. Read the answers, talk to them, take your time.`,
    itemChatTitle: "You can talk to them.",
    itemChatBody: (name: string) =>
      `Message ${name} the way you'd text any person you know. They'll respond in their own voice, drawn from the answers they recorded.`,
    itemArchiveTitle: (n: number) =>
      n > 0
        ? `Read ${n.toLocaleString()} answers.`
        : "Read what they wrote.",
    itemArchiveBody: (voice: number, photos: number) => {
      const parts: string[] = [];
      if (voice > 0)
        parts.push(`${voice} of the answers have voice recordings`);
      if (photos > 0) parts.push(`${photos} have photos`);
      const extras = parts.length > 0 ? ` ${parts.join(", ")}.` : "";
      return `Tap "Archive" to browse every question they answered.${extras}`;
    },
    itemPrivateTitle: "Their conversation is theirs.",
    itemPrivateBody:
      "Each beneficiary's conversation with you is private — they can't see each other's messages, and you (as owner) can't see theirs either. Each one talks to you alone.",
    itemDownloadTitle: "Take it with them.",
    itemDownloadBody:
      "Anyone you give access to can download a Markdown copy of every message they exchanged with the archive. Theirs forever.",
    itemNotTherapyTitle: "Not therapy.",
    itemNotTherapyBody:
      "Beneficiaries see this disclaimer too — that the archive isn't medical or therapeutic care, plus crisis hotlines.",
    previewArchive: "Preview the archive view",
    backToSettings: "← back to settings",
  },
  es: {
    fallbackName: "tu archivo",
    headline: (name: string) => `Bienvenido al archivo de ${name}.`,
    opening: (name: string) =>
      `${name} te invitó a su archivo — un registro de quién es, en sus propias palabras. Lee las respuestas, habla con ellos, tómate tu tiempo.`,
    itemChatTitle: "Puedes hablar con ellos.",
    itemChatBody: (name: string) =>
      `Escríbele a ${name} como le escribirías a cualquier persona que conoces. Te responderá en su propia voz, basada en las respuestas que grabó.`,
    itemArchiveTitle: (n: number) =>
      n > 0
        ? `Lee ${n.toLocaleString()} respuestas.`
        : "Lee lo que escribió.",
    itemArchiveBody: (voice: number, photos: number) => {
      const parts: string[] = [];
      if (voice > 0)
        parts.push(`${voice} de las respuestas tienen grabaciones de voz`);
      if (photos > 0) parts.push(`${photos} tienen fotos`);
      const extras = parts.length > 0 ? ` ${parts.join(", ")}.` : "";
      return `Toca "Archivo" para ver cada pregunta que respondieron.${extras}`;
    },
    itemPrivateTitle: "Su conversación es de ellos.",
    itemPrivateBody:
      "La conversación de cada beneficiario contigo es privada — no pueden verse los mensajes entre sí, y tú (como dueño) tampoco puedes ver los suyos.",
    itemDownloadTitle: "Pueden llevárselo.",
    itemDownloadBody:
      "Cualquier persona a la que des acceso puede descargar una copia en Markdown de cada mensaje que intercambió con el archivo. Suyo para siempre.",
    itemNotTherapyTitle: "No es terapia.",
    itemNotTherapyBody:
      "Los beneficiarios también ven este descargo — que el archivo no es atención médica ni terapéutica, más números de crisis.",
    previewArchive: "Ver vista previa del archivo",
    backToSettings: "← volver a configuración",
  },
};
