import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptAgreements } from "./actions";

export const metadata = {
  title: "Agreements — chapter3five",
};

export default async function AgreementsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  const language = (profile?.preferred_language ?? "en") as "en" | "es";
  const t = COPY[language];

  return (
    <main className="flex-1 flex items-start justify-center px-6 py-16">
      <div className="w-full max-w-2xl">
        <Link
          href="/"
          className="block text-center font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <div className="text-center mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl text-warm-50 mb-3">
            {t.title}
          </h1>
          <p className="text-warm-200 leading-relaxed max-w-lg mx-auto">
            {t.intro}
          </p>
        </div>

        <form
          action={acceptAgreements}
          className="space-y-3 rounded-2xl border border-warm-400/30 bg-warm-700/20 p-5 sm:p-6"
        >
          <Disclosure
            name="terms"
            title={t.termsTitle}
            body={t.termsBody}
            link={{ href: "/terms", text: t.readFull }}
          />
          <Disclosure
            name="privacy"
            title={t.privacyTitle}
            body={t.privacyBody}
            link={{ href: "/privacy", text: t.readFull }}
          />
          <Disclosure
            name="ai_processing"
            title={t.aiTitle}
            body={t.aiBody}
            link={{ href: "/privacy", text: t.readFull }}
          />
          <Disclosure
            name="cookies"
            title={t.cookiesTitle}
            body={t.cookiesBody}
            link={{ href: "/cookies", text: t.readFull }}
          />
          <Disclosure
            name="age_18plus"
            title={t.ageTitle}
            body={t.ageBody}
          />
          <Disclosure
            name="not_therapy"
            title={t.notTherapyTitle}
            body={t.notTherapyBody}
          />

          {error && (
            <p className="text-sm text-red-300/80 text-center pt-2">
              {error}
            </p>
          )}

          <div className="pt-3">
            <button
              type="submit"
              className="w-full h-12 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors"
            >
              {t.cta}
            </button>
            <p className="text-xs text-warm-400 text-center mt-3 leading-relaxed">
              {t.recordNote}
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}

function Disclosure({
  name,
  title,
  body,
  link,
}: {
  name: string;
  title: string;
  body: string;
  link?: { href: string; text: string };
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer text-warm-100 rounded-xl p-3 hover:bg-warm-700/30 transition-colors">
      <input
        type="checkbox"
        name={name}
        className="mt-1 h-4 w-4 rounded border-warm-300/60 bg-warm-700/40 accent-warm-200 flex-shrink-0"
      />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-warm-50">{title}</p>
        <p className="text-xs text-warm-200 leading-relaxed">
          {body}
          {link && (
            <>
              {" "}
              <Link
                href={link.href}
                target="_blank"
                className="text-warm-100 underline underline-offset-2 hover:text-warm-50"
              >
                {link.text}
              </Link>
              .
            </>
          )}
        </p>
      </div>
    </label>
  );
}

const COPY = {
  en: {
    title: "One more thing.",
    intro:
      "Before you go in — chapter3five works only because you've consented to a few specific things. Read each, check the box. We record what you agreed to and when.",
    termsTitle: "Terms of Service.",
    termsBody:
      "How you use chapter3five — your account, your content, our limits, refunds, the dispute-resolution process, and the platform-specific provisions for the Apple App Store and Google Play.",
    privacyTitle: "Privacy Policy.",
    privacyBody:
      "What we collect (your archive content, voice recordings, photos, persona memories, payment metadata, device tokens, etc.), how we use it, who processes it on our behalf, and how to delete it.",
    aiTitle: "AI processing — Anthropic + OpenAI.",
    aiBody:
      "Your archive, your messages, your attached photos, your voice recordings, your persona memories, and a set of structured anchors we extract from your archive (orientation, openness, identity quirks, sports fandom, location, the people in your life, plus a rotating mood + week-context seed) are sent to Anthropic and OpenAI to power chat, group chats with your own identities, beneficiary group rooms (multiple people sitting with one deceased archive together — messages there are visible to everyone in the room), the persona's occasional 2-3 message reply bursts, memory retrieval, image moderation, voice transcription, tone-judging on hostile messages, and persona realism. Both have default-no-retention and default-no-training-on-customer-data policies. We never train any model — ours or theirs — on your data.",
    cookiesTitle: "Cookie Policy.",
    cookiesBody:
      "We use cookies (and on mobile, equivalent device storage) to keep you signed in, remember preferences, and run light aggregate analytics. No advertising cookies; no third-party tracking SDKs.",
    ageTitle: "I am 18 or older.",
    ageBody:
      "chapter3five is an adults-only product. We've already taken your date of birth at the previous step; this is your final confirmation that the date you entered is true and that you are at least 18.",
    notTherapyTitle: "This is not therapy or crisis support.",
    notTherapyBody:
      "chapter3five is not medical, psychological, or therapeutic care. The identity is built to step out of character if your messages suggest you need a real person — but if you're in crisis right now, please reach out: US 988 (call/text), UK Samaritans 116 123, Mexico SAPTEL +52 55 5259-8121, or your local emergency number.",
    readFull: "Read full",
    cta: "I agree — let me in.",
    recordNote:
      "We save a record of these acknowledgments tagged with the version of this page you saw, so we always know exactly what you agreed to.",
  },
  es: {
    title: "Una cosa más.",
    intro:
      "Antes de entrar — chapter3five funciona solo porque consientes a unas cosas específicas. Lee cada una, marca la casilla. Guardamos un registro de lo que aceptaste y cuándo.",
    termsTitle: "Términos del Servicio.",
    termsBody:
      "Cómo usas chapter3five — tu cuenta, tu contenido, nuestros límites, reembolsos, el proceso de resolución de disputas, y las cláusulas específicas para Apple App Store y Google Play.",
    privacyTitle: "Política de Privacidad.",
    privacyBody:
      "Qué recopilamos (el contenido de tu archivo, grabaciones de voz, fotos, memorias del persona, metadatos de pagos, tokens de dispositivo, etc.), cómo lo usamos, quién lo procesa por nosotros, y cómo eliminarlo.",
    aiTitle: "Procesamiento de IA — Anthropic + OpenAI.",
    aiBody:
      "Tu archivo, tus mensajes, las fotos que adjuntas, tus grabaciones de voz, las memorias del persona, y un conjunto de anclas estructuradas que extraemos de tu archivo (orientación, apertura, peculiaridades, equipo deportivo, ubicación, las personas en tu vida, más una semilla rotativa de ánimo + contexto semanal) se envían a Anthropic y OpenAI para impulsar el chat, los chats grupales con tus propias identidades, los cuartos grupales de beneficiarios (varias personas estando con un archivo fallecido juntos — los mensajes ahí son visibles para todos en el cuarto), las ráfagas ocasionales de 2-3 mensajes del persona, la recuperación de memoria, la moderación de imágenes, la transcripción de voz, el juicio de tono ante mensajes hostiles, y el realismo del persona. Ambos tienen políticas predeterminadas de no retención y no entrenamiento sobre datos del cliente. Nunca entrenamos a ningún modelo — nuestro ni de ellos — con tu información.",
    cookiesTitle: "Política de Cookies.",
    cookiesBody:
      "Usamos cookies (y en móvil, almacenamiento equivalente del dispositivo) para mantenerte conectado, recordar preferencias, y ejecutar analítica agregada. Sin cookies publicitarias; sin SDKs de terceros.",
    ageTitle: "Tengo 18 años o más.",
    ageBody:
      "chapter3five es solo para adultos. Ya tomamos tu fecha de nacimiento en el paso anterior; esta es tu confirmación final de que la fecha que entraste es verdadera y que tienes al menos 18 años.",
    notTherapyTitle: "Esto no es terapia ni soporte para crisis.",
    notTherapyBody:
      "chapter3five no es atención médica, psicológica, ni terapéutica. La identidad está diseñada para salir del personaje si tus mensajes sugieren que necesitas una persona real — pero si estás en crisis ahora, por favor comunícate: US 988, UK Samaritans 116 123, México SAPTEL +52 55 5259-8121, o tu número local de emergencias.",
    readFull: "Leer completo",
    cta: "Acepto — déjame entrar.",
    recordNote:
      "Guardamos un registro de estos consentimientos etiquetado con la versión de esta página que viste, para saber exactamente qué aceptaste.",
  },
};
