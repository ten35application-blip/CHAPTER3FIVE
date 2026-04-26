import Link from "next/link";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Support — chapter3five",
  description:
    "Common questions about chapter3five — how it works, what we do with your data, and how to reach us.",
};

export default function SupportPage() {
  return (
    <>
      <main className="flex-1">
        <header className="border-b border-warm-700/40">
          <div className="max-w-3xl mx-auto px-6 py-6 flex items-center justify-between">
            <Link
              href="/"
              className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors"
            >
              chapter3five
            </Link>
            <span className="text-xs uppercase tracking-[0.25em] text-warm-300">
              Support
            </span>
          </div>
        </header>

        <section className="px-6 pt-20 pb-10 max-w-2xl mx-auto text-center">
          <h1 className="font-serif text-5xl sm:text-6xl text-warm-50 leading-tight mb-4">
            <span className="italic font-light">How can we help?</span>
          </h1>
          <p className="text-warm-300 text-lg leading-relaxed max-w-lg mx-auto">
            Questions worth asking, before you ask us. If you don&rsquo;t see
            yours, write to{" "}
            <a
              href="mailto:care@chapter3five.app"
              className="text-warm-100 underline underline-offset-2 hover:text-warm-50"
            >
              care@chapter3five.app
            </a>{" "}
            — a real person reads every message.
          </p>
        </section>

        <section className="px-6 py-16 max-w-2xl mx-auto">
          <FaqGroup title="The basics">
            <Faq
              q="What is chapter3five?"
              a="A quiet place where someone records who they are — their answers, their voice, the texture of how they speak — while they're alive. The people they love can sit with the archive later."
            />
            <Faq
              q="How is this different from a chatbot?"
              a="The thirtyfive isn't pretending to be the person. It's a way to talk to what they actually wrote — every word in the archive came from them. We don't scrape, scan, or guess. The AI just helps you have a conversation with what they consciously left behind."
            />
            <Faq
              q="Who is this for?"
              a="Adults (18+) who want to leave something for the people they love, and adults who want to stay close to someone who's still here or who's gone. We're not a grief therapy app — we'll point you to the right number if you need one."
            />
          </FaqGroup>

          <FaqGroup title="Cost">
            <Faq
              q="Is it free?"
              a="Free to start. Your first thirtyfive — yours, real, built from your own answers — costs nothing. Add a randomized identity, and the first one is also free."
            />
            <Faq
              q="What costs $5?"
              a="Each additional thirtyfive after the first is $5. Each additional randomize after the first is $5. Beneficiary slots beyond the three free ones are $5 each. Restoring an account or thirtyfive within the 30-day grace period is $5. That's it. We don't sell subscriptions."
            />
            <Faq
              q="Can I get a refund?"
              a="Email care@chapter3five.app within 30 days of any payment and we'll refund it. No questions, no friction."
            />
          </FaqGroup>

          <FaqGroup title="Voice + photo answers">
            <Faq
              q="Can I record my voice answering the questions?"
              a="Yes. On the answers page, every question has a 'Record voice' button. Hit it, talk, hit stop. The audio uploads, gets transcribed by Whisper automatically, and the transcript is offered to you to use as your typed answer with one click. Recording an answer takes about 30 seconds versus a few minutes of typing."
            />
            <Faq
              q="Can I attach photos to specific answers?"
              a="Yes. Each of the 355 questions supports an image attachment. The photo lives alongside the text + voice — when family later browses the archive, they see all three: the question, what you wrote, what you said out loud, and what it looked like."
            />
            <Faq
              q="Do voice and photos cost extra?"
              a="No. They're included. Storage is around $0.004 per fully-recorded archive per month — we absorb it. You'll never see a bill for voice or photo features."
            />
            <Faq
              q="Does the AI 'hear' my voice?"
              a="Not yet. Right now Anthropic Claude (the model that responds in chat) reads the text answer + the Whisper transcript. The audio file is preserved as a parallel artifact for humans — your family hears your actual voice when they browse the archive. We may add voice-aware AI down the line as the technology matures."
            />
          </FaqGroup>

          <FaqGroup title="Your data">
            <Faq
              q="Where does my data live?"
              a="In Supabase (US), encrypted in transit and at rest. Conversations are processed by Anthropic at message time and OpenAI processes embeddings + image moderation + voice transcription. Both have default-no-retention and default-no-training policies on the API tier we use. We never train any model — ours or theirs — on your archive."
            />
            <Faq
              q="Can I download a copy?"
              a="Two options. Settings → Download all (JSON) gives you a complete developer-format dump of everything we store. Settings → Download conversation gives you a clean Markdown of every message between you and your active identity, formatted for reading and printing. Beneficiaries get the same conversation download for their own private thread."
            />
            <Faq
              q="Can I delete my account?"
              a="Yes. Settings → Delete account. We hold your data for 30 days in case you change your mind (you can restore it for $5 in that window). After 30 days, it's gone permanently — no copies, no backups. Or use 'delete forever now' under that section if you want immediate, irreversible erasure."
            />
            <Faq
              q="Do you sell my data or train models on it?"
              a="No. Your archive is yours. We don't sell to third parties, we don't train any model — ours, our processors', or anyone else's — on what you write. This is in our Terms and we hold ourselves to it."
            />
            <Faq
              q="What does the persona remember about me?"
              a="The persona builds up structured memories from your conversations — facts, relationships, preferences, events, recurring themes, feelings — and a weekly reflection job writes higher-order observations ('they've been preoccupied with their mother's diagnosis'). You can review and delete any memory at Settings → What they remember about you. Memories survive even if you delete the message history."
            />
          </FaqGroup>

          <FaqGroup title="Beneficiaries & sharing">
            <Faq
              q="What's a beneficiary?"
              a="Someone you designate who inherits access to your archive if something happens to you. They get an email when you choose them, and another with a claim link if your account is ever marked as deceased. You can have three free beneficiaries; additional slots are $5 each."
            />
            <Faq
              q="What's the difference between a share code and a beneficiary?"
              a="A share code lets someone import a copy of your archive into their own account — they get their own version. A beneficiary gets read-only access to your same archive — same answers, same photo, but with their own private conversation thread. Beneficiaries are for family who'll inherit; share codes are for letting someone else carry your thirtyfive forward independently."
            />
            <Faq
              q="What happens when I die?"
              a="Beneficiaries you designated each get an email with a link to claim access to your archive. They can sign up or sign in, then read + chat with what you left them, plus browse all 355 answers (text + voice + photo) in a quiet read-only archive view. They can download a Markdown of their conversation with you any time. We confirm the death with documentation before activating — we don't act on rumors."
            />
            <Faq
              q="Does the persona keep acting alive after I'm gone?"
              a="No. Once an account is marked deceased, the persona shifts into memorial mode for beneficiaries. Still themselves — same voice, same opinions, same texture — but they don't pretend to still be alive. No 'talk to you tomorrow,' no 'let's grab coffee.' If asked, they're honest about being an archive."
            />
          </FaqGroup>

          <FaqGroup title="Crisis & safety">
            <Faq
              q="What if I'm in crisis?"
              a="chapter3five is not therapy or crisis support. If you're in genuine crisis, please reach out to a real person — US: 988 (call or text), UK: Samaritans 116 123, Mexico: SAPTEL +52 55 5259-8121, or your local emergency services. The thirtyfives are designed to step out of character if your messages suggest you need real help."
            />
            <Faq
              q="What if I think someone else is in crisis?"
              a="Encourage them to use one of the numbers above, or 911 if it's immediate. Email us at care@chapter3five.app if you need to flag something we should look at."
            />
          </FaqGroup>

          <FaqGroup title="Still stuck?">
            <Faq
              q="How do I reach a human?"
              a="Email care@chapter3five.app. We aim to reply within 48 hours. For account or billing issues, include the email address on the account."
            />
          </FaqGroup>
        </section>

        <section className="px-6 pb-24 text-center">
          <a
            href="mailto:care@chapter3five.app"
            className="inline-flex h-12 items-center justify-center rounded-full bg-warm-50 px-10 text-sm font-medium text-ink hover:bg-warm-100 transition-colors"
          >
            Email us
          </a>
        </section>
      </main>

      <Footer />
    </>
  );
}

function FaqGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-14">
      <h2 className="text-xs uppercase tracking-[0.25em] text-warm-300 mb-6">
        {title}
      </h2>
      <div className="space-y-8">{children}</div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <h3 className="font-serif text-xl text-warm-50 mb-2">{q}</h3>
      <p className="text-warm-200 leading-relaxed">{a}</p>
    </div>
  );
}
