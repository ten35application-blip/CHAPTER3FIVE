import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Orb } from "@/components/Orb";

export const metadata = {
  title: "Welcome — chapter3five",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SharedWelcomePage({
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
      `/auth/signin?next=${encodeURIComponent(`/shared/${id}/welcome`)}`,
    );
  }

  // RLS via grant — read fails if no access.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, preferred_language, avatar_url")
    .eq("id", id)
    .maybeSingle();
  if (!oracle) {
    redirect("/dashboard?error=No%20access%20to%20that%20archive");
  }

  // Look up owner status (alive vs deceased) via service role so we can
  // tone the welcome accordingly. Doesn't leak — we only show the
  // boolean to the page.
  const { data: ownerOracle } = await supabase
    .from("oracles")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  let ownerDeceased = false;
  if (ownerOracle?.user_id) {
    const admin = createAdminClient();
    const { data: ownerProfile } = await admin
      .from("profiles")
      .select("deceased_at")
      .eq("id", ownerOracle.user_id)
      .maybeSingle();
    ownerDeceased = Boolean(ownerProfile?.deceased_at);
  }

  // Voice + photo counts so the orientation can mention them honestly
  // ("32 voice recordings, 14 photos") instead of teasing features that
  // aren't there.
  const { data: archiveStats } = await supabase
    .from("answers")
    .select("audio_url, photo_url")
    .eq("oracle_id", id)
    .eq("variant", 1);
  const voiceCount = (archiveStats ?? []).filter((a) => a.audio_url).length;
  const photoCount = (archiveStats ?? []).filter((a) => a.photo_url).length;
  const answerCount = (archiveStats ?? []).length;

  const language = (oracle.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];
  const oracleName = oracle.name ?? t.fallbackName;

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
        <Orb size={520} />
      </div>

      <div className="relative w-full max-w-xl flex flex-col items-center text-center">
        <Link
          href="/dashboard"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        {oracle.avatar_url && (
          <img
            src={oracle.avatar_url}
            alt=""
            className="w-24 h-24 rounded-full object-cover mb-8 border border-warm-300/30"
          />
        )}

        <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 leading-tight mb-6">
          <span className="italic font-light">
            {ownerDeceased
              ? t.headlineDeceased(oracleName)
              : t.headlineAlive(oracleName)}
          </span>
        </h1>

        <p className="text-warm-200 leading-relaxed text-base max-w-md mb-10">
          {ownerDeceased
            ? t.openingDeceased(oracleName)
            : t.openingAlive(oracleName)}
        </p>

        <div className="w-full text-left space-y-5 mb-12 px-2">
          <Item title={t.itemChatTitle} body={t.itemChatBody(oracleName)} />
          <Item
            title={t.itemArchiveTitle(answerCount)}
            body={t.itemArchiveBody(voiceCount, photoCount)}
          />
          <Item title={t.itemPrivateTitle} body={t.itemPrivateBody} />
          <Item title={t.itemDownloadTitle} body={t.itemDownloadBody} />
          {ownerDeceased && (
            <Item title={t.itemMemorialTitle} body={t.itemMemorialBody} />
          )}
          <Item title={t.itemNotTherapyTitle} body={t.itemNotTherapyBody} />
        </div>

        <Link
          href={`/shared/${id}`}
          className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors w-full"
        >
          {ownerDeceased ? t.beginCtaDeceased : t.beginCtaAlive}
        </Link>

        <p className="mt-6 text-xs text-warm-400 leading-relaxed max-w-sm">
          {t.footerNote}
        </p>
      </div>
    </main>
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
    fallbackName: "their archive",
    headlineDeceased: (name: string) => `${name} left this for you.`,
    headlineAlive: (name: string) => `Welcome to ${name}'s archive.`,
    openingDeceased: (name: string) =>
      `${name} chose you. They built this archive while they were alive — the answers, the voice, the texture of how they spoke — so the people they loved could sit with them later. There's no rush. Open it when you're ready.`,
    openingAlive: (name: string) =>
      `${name} invited you to their archive — a record of who they are, in their own words. Read the answers, talk to them, take your time.`,
    itemChatTitle: "You can talk to them.",
    itemChatBody: (name: string) =>
      `Message ${name} the way you'd text any person you know. They'll respond in their own voice, drawn from the answers they recorded. They can attach photos, refer back to past conversations, remember what's been on your mind.`,
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
      return `Tap "Archive" in the chat header to browse every question they answered.${extras}`;
    },
    itemPrivateTitle: "Your conversation is yours.",
    itemPrivateBody:
      "If other people were also given access to this archive, none of you can see each other's conversations. Yours is private. Always.",
    itemDownloadTitle: "Take it with you.",
    itemDownloadBody:
      "Tap \"Download\" in the chat header any time to save a Markdown copy of every message between you and the archive. Yours forever, even if chapter3five disappears tomorrow.",
    itemMemorialTitle: "They won't pretend.",
    itemMemorialBody:
      "Because they're gone, the persona will speak in their voice but won't make plans for tomorrow or pretend to still be alive. Honest, warm, present in the only way they can be.",
    itemNotTherapyTitle: "This isn't grief therapy.",
    itemNotTherapyBody:
      "If you're in a hard moment and you need a real person — please reach out: US 988 (call or text), UK Samaritans 116 123, Mexico SAPTEL +52 55 5259-8121.",
    beginCtaDeceased: "Begin",
    beginCtaAlive: "Open the chat",
    footerNote:
      "You can come back to this welcome any time from the chat header.",
  },
  es: {
    fallbackName: "su archivo",
    headlineDeceased: (name: string) => `${name} dejó esto para ti.`,
    headlineAlive: (name: string) => `Bienvenido al archivo de ${name}.`,
    openingDeceased: (name: string) =>
      `${name} te eligió. Construyeron este archivo mientras estaban vivos — las respuestas, la voz, la textura de cómo hablaban — para que la gente que amaban pudiera estar con ellos después. No hay prisa. Ábrelo cuando estés listo.`,
    openingAlive: (name: string) =>
      `${name} te invitó a su archivo — un registro de quién es, en sus propias palabras. Lee las respuestas, habla con ellos, tómate tu tiempo.`,
    itemChatTitle: "Puedes hablar con ellos.",
    itemChatBody: (name: string) =>
      `Escríbele a ${name} como le escribirías a cualquier persona que conoces. Te responderá en su propia voz, basada en las respuestas que grabó. Puede adjuntar fotos, recordar conversaciones pasadas, saber qué has tenido en la mente.`,
    itemArchiveTitle: (n: number) =>
      n > 0
        ? `Lee ${n.toLocaleString()} respuestas.`
        : "Lee lo que escribió.",
    itemArchiveBody: (voice: number, photos: number) => {
      const parts: string[] = [];
      if (voice > 0) parts.push(`${voice} de las respuestas tienen grabaciones de voz`);
      if (photos > 0) parts.push(`${photos} tienen fotos`);
      const extras = parts.length > 0 ? ` ${parts.join(", ")}.` : "";
      return `Toca "Archivo" en la cabecera del chat para ver cada pregunta que respondieron.${extras}`;
    },
    itemPrivateTitle: "Tu conversación es tuya.",
    itemPrivateBody:
      "Si otras personas también recibieron acceso a este archivo, ninguno de ustedes puede ver las conversaciones de los demás. La tuya es privada. Siempre.",
    itemDownloadTitle: "Llévatela contigo.",
    itemDownloadBody:
      "Toca \"Descargar\" en la cabecera del chat en cualquier momento para guardar una copia en Markdown de cada mensaje entre tú y el archivo. Tuyo para siempre, incluso si chapter3five desapareciera mañana.",
    itemMemorialTitle: "No fingirán.",
    itemMemorialBody:
      "Porque ya no están, la identidad hablará con su voz pero no hará planes para mañana ni pretenderá estar vivo. Honesto, cálido, presente de la única manera que puede serlo.",
    itemNotTherapyTitle: "Esto no es terapia de duelo.",
    itemNotTherapyBody:
      "Si estás en un momento difícil y necesitas una persona real — por favor comunícate: US 988, UK Samaritans 116 123, México SAPTEL +52 55 5259-8121.",
    beginCtaDeceased: "Comenzar",
    beginCtaAlive: "Abrir el chat",
    footerNote:
      "Puedes regresar a esta bienvenida en cualquier momento desde la cabecera del chat.",
  },
};
