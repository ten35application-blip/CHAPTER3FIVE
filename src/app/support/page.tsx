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
              a="The identity isn't pretending to be the person. It's a way to talk to what they actually wrote — every word in the archive came from them. We don't scrape, scan, or guess. The AI just helps you have a conversation with what they consciously left behind."
            />
            <Faq
              q="Who is this for?"
              a="Adults (18+) who want to leave something for the people they love, and adults who want to stay close to someone who's still here or who's gone. We're not a grief therapy app — we'll point you to the right number if you need one."
            />
          </FaqGroup>

          <FaqGroup title="Cost">
            <Faq
              q="Is it free?"
              a="Free to start. Your first identity — yours, real, built from your own answers — costs nothing. Add a randomized identity, and the first one is also free."
            />
            <Faq
              q="What costs $5?"
              a="Each additional identity after the first is $5. Each additional randomize after the first is $5. Beneficiary slots beyond the three free ones are $5 each. Restoring an account or identity within the 30-day grace period is $5. That's it. We don't sell subscriptions."
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
              a="Someone you designate who inherits access to your archive if something happens to you. They get an email when you choose them — and you can also pre-share their personal claim link directly (text it, drop it in your will), so they have a path even if your email account is unreachable later. Three free beneficiary slots; additional slots $5 each."
            />
            <Faq
              q="There are three kinds of codes — which is which?"
              a="Invite code (12 chars, XXXX-XXXX-XXXX). The owner is alive; you read + chat with their archive, owner keeps it. Paste from + New → Connect with their code, or open the /invite link they sent. Claim link (32-char URL like /legacy/…). The post-passing inheritance link. Hold onto it; only activates 72 hours after a passing is reported, and only if the owner doesn't cancel that report. Import code (12 chars, same format as invite). For starting a brand-new account with a copy of someone's archive — sign out and sign up, paste it on the second step."
            />
            <Faq
              q="What happens when I pass away?"
              a="A beneficiary opens their claim link and submits a passing report (date + optional notes). We don't activate the archive immediately — instead, we email you with a one-click link to cancel the report. You have 72 hours. If you cancel, the report is dismissed and the archive stays private. If you don't cancel, after 72 hours the archive transitions to inheritance mode: each beneficiary gets their own claim link by email, can sign in, and read + chat with what you left. The 72-hour window is the safety net against false reports — accidents, drama, fraud."
            />
            <Faq
              q="What if a beneficiary submits a passing report and I'm fine?"
              a="Open the email we send you (subject: 'Are you there? Action needed within 72 hours.') and click the cancel link. One tap, no sign-in required — the cancel link itself is your authorization. The reporter gets a polite 'we couldn't verify' note; we don't share who reported."
            />
            <Faq
              q="Does the persona keep acting alive after I'm gone?"
              a="No. Once an account is marked deceased — only after the 72-hour window has elapsed without a veto — the persona shifts into memorial mode for beneficiaries. Still themselves — same voice, same opinions, same texture — but they don't pretend to still be alive. No 'talk to you tomorrow,' no 'let's grab coffee.' If asked, they're honest about being an archive."
            />
          </FaqGroup>

          <FaqGroup title="Using the dashboard">
            <Faq
              q="How do I delete a conversation?"
              a="Swipe LEFT on the row in your conversation list. A red Delete button appears on the right; tap it, or swipe past the commit threshold and let go for a one-motion delete. We always show a confirmation that's specific to what's happening — for an identity, it's clear you're deleting the IDENTITY (with a 30-day grace window), not just clearing the chat. For a group, the room disappears for everyone in it. For a shared archive, you just lose access; the original isn't touched."
            />
            <Faq
              q="How do I mark something unread again?"
              a="Swipe RIGHT on the row, or long-press → Mark as unread. The amber dot comes back so you remember to revisit it. Just opening a conversation marks it read again, even if you didn't reply."
            />
            <Faq
              q="Hide alerts / mute — what does that do?"
              a="Long-press a row → Hide alerts. The conversation stays in your list but the proactive 'haven't heard from you' pings, the daily question, and outreach emails for that conversation stop. A small bell-with-slash icon shows next to the timestamp so you remember it's silenced. Long-press again → Show alerts to undo it."
            />
            <Faq
              q="Can I rename an identity?"
              a="Yes — for identities you named yourself (real mode). Settings → Identities, tap one to expand, change the name, hit Save. The new name appears everywhere immediately: dashboard, chat, beneficiary view. Randomized identities keep the name we generated for them — the name is part of the persona."
            />
            <Faq
              q="What's pinning?"
              a="Long-press a row → Pin. The conversation moves into the favorites strip at the top of your dashboard as a small oval tile, always one tap away. New activity on a pinned conversation shows an amber dot on the tile. Long-press the tile → Unfavorite to drop it back into the main list."
            />
          </FaqGroup>

          <FaqGroup title="Crisis & safety">
            <Faq
              q="What if I'm in crisis?"
              a="chapter3five is not therapy or crisis support. If you're in genuine crisis, please reach out to a real person — US: 988 (call or text), UK: Samaritans 116 123, Mexico: SAPTEL +52 55 5259-8121, or your local emergency services. The identities are designed to step out of character if your messages suggest you need real help."
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
