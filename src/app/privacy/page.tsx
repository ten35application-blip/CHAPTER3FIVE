import type { Metadata } from "next";
import {
  LegalCallout,
  LegalSection,
  LegalShell,
  type TocItem,
} from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — chapter3five",
  description:
    "What chapter3five collects, what we never collect, who we share it with, and the rights you have over your data.",
};

const toc: TocItem[] = [
  { id: "plain-words", label: "In plain words" },
  { id: "what-we-collect", label: "What we collect" },
  { id: "what-we-dont", label: "What we don't collect" },
  { id: "how-we-use", label: "How we use it" },
  { id: "third-parties", label: "Who we share it with" },
  { id: "anthropic", label: "How AI inference works" },
  { id: "retention", label: "How long we keep it" },
  { id: "your-rights", label: "Your rights" },
  { id: "cookies", label: "Cookies" },
  { id: "children", label: "Children" },
  { id: "international", label: "Where your data lives" },
  { id: "breach", label: "If something goes wrong" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "How to reach us" },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      currentPath="/privacy"
      kicker="Your data"
      title="Privacy Policy"
      toc={toc}
    >
      <LegalSection id="plain-words" number={1} title="In plain words">
        <p>
          chapter3five stores what it needs to run your companions and
          nothing more. We don&rsquo;t sell your data, we don&rsquo;t run
          third-party ad trackers, and your conversations are never used to
          train AI models. The rest of this policy is the detailed version of
          those three sentences.
        </p>
        <p>
          This policy applies to chapter3five.app and covers everyone who
          uses the service — creators, inheritors, and visitors.
        </p>
      </LegalSection>

      <LegalSection id="what-we-collect" number={2} title="What we collect">
        <ul>
          <li>
            <strong>Account basics</strong> — your email address and
            authentication data (a hashed password or sign-in tokens).
          </li>
          <li>
            <strong>Date of birth</strong> — captured once at signup so
            we can verify you&rsquo;re 18 or older. We store the date
            you gave us (not your government-issued ID) and use it to
            gate access to the app; we don&rsquo;t use it for
            marketing, birthday emails, or anywhere outside age
            verification.
          </li>
          <li>
            <strong>Your answers</strong> — the responses you write to
            identity questions, including legacy answers you record for
            someone to inherit.
          </li>
          <li>
            <strong>Chat messages</strong> — what you and your companions say
            to each other, so your conversations persist and your companions
            can remember them.
          </li>
          <li>
            <strong>Photos you choose to share</strong> — a photo you upload
            to create a photo-based identity, or a photo you send in a chat.
            They are stored in our database&rsquo;s storage (Supabase
            Storage) and treated as content you own, like your answers and
            messages. See Section 6 for how photos are processed by our AI
            provider.
          </li>
          <li>
            <strong>Payment metadata</strong> — your subscription status,
            plan, and billing history. Payments are processed by Stripe;{" "}
            <strong>we never see or store your card number</strong>.
          </li>
          <li>
            <strong>Device and browser info</strong> — IP address, browser
            type, and basic device information, collected automatically for
            security, abuse prevention, and error diagnosis.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="what-we-dont"
        number={3}
        title="What we don't collect"
      >
        <p>Just as important. chapter3five does not collect:</p>
        <ul>
          <li>Government ID or identity documents</li>
          <li>Your precise location</li>
          <li>Your contacts or address book</li>
          <li>
            Camera or microphone data, ever, without an explicit action you
            take — uploading a photo or tapping the microphone to dictate a
            message are such actions; nothing is captured in the background
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="how-we-use" number={4} title="How we use it">
        <p>We use your data only to:</p>
        <ul>
          <li>
            <strong>Generate your companions</strong> — your answers and
            traits are what a companion is synthesized from
          </li>
          <li>
            <strong>Run your chats</strong> — storing history and sending
            messages to our AI provider to generate replies
          </li>
          <li>
            <strong>Bill you</strong> — managing your subscription through
            Stripe
          </li>
          <li>
            <strong>Keep the service safe</strong> — preventing abuse,
            enforcing our Community Guidelines, and diagnosing errors
          </li>
          <li>
            <strong>Comply with law</strong> — when we are legally required
            to
          </li>
        </ul>
        <p>
          We do not sell your personal information, and we do not share it
          with anyone for their own advertising or marketing.
        </p>
      </LegalSection>

      <LegalSection
        id="third-parties"
        number={5}
        title="Who we share it with"
      >
        <p>
          We use a small set of service providers, each bound by their own
          privacy commitments, and each receiving only what their job
          requires:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — our database and authentication.
            Stores your account, answers, and chat history.
          </li>
          <li>
            <strong>Anthropic</strong> — our primary AI provider. Receives
            chat content to generate companion replies (see Section 6 — this
            one deserves its own section).
          </li>
          <li>
            <strong>OpenAI</strong> — narrow supporting uses only, each
            covered in more detail in Section 6:
            <ul>
              <li>
                Content moderation on messages you send and photos you
                upload (their &ldquo;Moderations&rdquo; endpoint — checks
                for CSAM, graphic violence, self-harm, hate).
              </li>
              <li>
                Embeddings that power the semantic-memory search inside
                your identities (numerical vectors of short memory notes).
              </li>

            </ul>
            OpenAI processes these under its API terms, which by default
            allow up to 30 days of retention for abuse-monitoring purposes.
            Content sent via the API is not used to train OpenAI models
            unless you opt in — we do not opt in.
          </li>
          <li>
            <strong>Replicate</strong> — image generation. Used in two
            ways: (a) creating an identity&rsquo;s initial avatar from
            a text prompt (no reference photo sent), and (b) generating
            in-chat photos an identity might &ldquo;send you&rdquo; mid-
            conversation, where we send that identity&rsquo;s existing
            avatar as a reference so the generated photo preserves the
            face, plus a short text prompt describing the scene.
            Replicate processes these to produce the output; per their
            terms of service, API traffic isn&rsquo;t used to train
            their models. Payloads may transit third-party model hosts
            that Replicate proxies to (e.g. Black Forest Labs for Flux
            models) under Replicate&rsquo;s own privacy contract.
          </li>
          <li>
            <strong>Stripe</strong> — payments on the web. Handles your card
            and billing details; we receive only subscription metadata.
          </li>
          <li>
            <strong>RevenueCat</strong> — purchases in the iPhone and
            Android apps. In-app subscriptions are processed by Apple or
            Google; RevenueCat sits in front of them to tell us whether
            your subscription is active. It receives your chapter3five
            account ID, the purchase receipt from the store, and basic
            device information. It does not receive your card details,
            your messages, or anything your identities have said to you.
          </li>
          <li>
            <strong>Resend</strong> — transactional email. Receives your
            email address to deliver account and notice emails.
          </li>
          <li>
            <strong>Vercel</strong> — hosting. Serves the app and processes
            requests, including IP addresses, as any web host does.
          </li>
          <li>
            <strong>Sentry</strong> — error monitoring. If something breaks,
            it receives technical error reports (browser, device, what
            failed) so we can fix it. It is not an analytics or ad tracker.
          </li>
          <li>
            <strong>Expo</strong> — push-notification delivery. When you
            opt into push, we send your device push token, notification
            title, and message excerpt (typically the first 140 characters
            of a companion reply or a system prompt) to Expo&rsquo;s Push
            API so Apple and Google can route the notification to your
            device. Expo processes the payload for delivery and does not
            use it for any other purpose.
          </li>
        </ul>
        <p>
          Beyond these providers, we disclose personal data only if required
          by law or to protect someone&rsquo;s safety, and we&rsquo;ll tell
          you when we&rsquo;re legally allowed to.
        </p>
      </LegalSection>

      <LegalSection id="anthropic" number={6} title="How AI inference works">
        <p>
          When you chat with a companion, your messages and relevant identity
          content are sent to <strong>Anthropic</strong>, whose Claude models
          generate the companion&rsquo;s replies. This is the only way an AI
          conversation can work, and we want you to understand it clearly:
        </p>
        <LegalCallout>
          <p>
            Chat content sent to Anthropic runs under a{" "}
            <strong>zero-data-retention configuration</strong>: Anthropic
            processes it to generate the reply and does not retain it
            afterward, and your messages are{" "}
            <strong>never used to train AI models</strong>.
          </p>
        </LegalCallout>
        <p>
          The same applies to photos <em>sent to Anthropic&rsquo;s vision
          capability</em>. A photo you upload to create a photo-based
          identity, or send in a chat conversation, is stored in Supabase
          Storage as content you own, and when it&rsquo;s sent to Anthropic
          for vision inference it runs under the{" "}
          <strong>same zero-data-retention terms as your chat text</strong>:
          used to generate the response or the identity, retained by
          Anthropic no longer than that, and never used to train AI models.
        </p>
        <p>
          Your conversations are stored only in our own database (Supabase),
          under your account, where you can delete them.
        </p>
        <h3 className="mt-8 text-xl font-semibold text-warm-100">
          What OpenAI actually receives
        </h3>
        <p>
          OpenAI does <strong>not</strong> generate your companion&rsquo;s
          replies. Its use is limited to three narrow supporting jobs, each
          on a separate endpoint:
        </p>
        <ul>
          <li>
            <strong>Moderation.</strong> Text messages and any photo you
            upload are checked against OpenAI&rsquo;s Moderations endpoint
            for CSAM, graphic violence, self-harm, and hate. This is a
            required App Store surface and it&rsquo;s how we keep the
            product safe.
          </li>
          <li>
            <strong>Embeddings.</strong> Short memory notes we store about
            your identities (e.g. &ldquo;prefers being called Grandpa,&rdquo;
            &ldquo;grew up in Detroit&rdquo;) are sent to OpenAI&rsquo;s
            embeddings endpoint to produce numerical vectors that power
            semantic search. The embedding is a hash-like number, not the
            text.
          </li>
          <li>
            <strong>Dictation stays on your device.</strong> The microphone
            button uses your browser&rsquo;s own speech recognition to turn
            speech into text in the message box, which you can edit before
            sending. We never record, receive, or store audio, and no audio
            is sent to us or to anyone else &mdash; only the text you choose
            to send.
          </li>
        </ul>
        <p>
          Unlike our Anthropic path, we are not on an OpenAI zero-retention
          agreement — their API default allows retention for up to 30 days
          for abuse-monitoring purposes, after which the data is deleted.
          API traffic is not used to train OpenAI models unless the
          developer opts in; we do not opt in.
        </p>
      </LegalSection>

      <LegalSection id="retention" number={7} title="How long we keep it">
        <ul>
          <li>
            <strong>While your account is active</strong> — we keep your data
            so the service works.
          </li>
          <li>
            <strong>After you delete your account</strong> — everything is
            permanently deleted within <strong>30 days</strong>, except
            records we&rsquo;re legally required to keep (for example,
            billing records).
          </li>
          <li>
            <strong>Legacy identities are different, on purpose.</strong>{" "}
            When an inheritor redeems an inherit code, they receive their
            own <strong>independent copy</strong> of the identity in their
            account. Each redeemed copy is kept until{" "}
            <strong>the inheritor who holds it deletes it, or 100 years
            have passed</strong> — whichever comes first. A legacy identity
            is a gift meant to outlive its creator: the creator deleting
            their account removes the creator&rsquo;s own archive and any
            codes that were never redeemed, but it does <strong>not</strong>{" "}
            remove copies inheritors have already redeemed.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="your-rights" number={8} title="Your rights">
        <p>
          Wherever you live, we extend you the rights in GDPR and the
          California Consumer Privacy Act:
        </p>
        <ul>
          <li>
            <strong>Access</strong> — ask for a copy of the personal data we
            hold about you
          </li>
          <li>
            <strong>Correction</strong> — fix anything that&rsquo;s wrong
          </li>
          <li>
            <strong>Deletion</strong> — delete your account and data, from
            settings or by emailing us
          </li>
          <li>
            <strong>Export</strong> — receive your answers and chat history
            in a portable format
          </li>
          <li>
            <strong>No discrimination</strong> — exercising these rights
            never costs you features or service quality
          </li>
        </ul>
        <p>
          Email{" "}
          <a
            href="mailto:privacy@chapter3five.app"
            className="font-semibold underline underline-offset-4"
          >
            privacy@chapter3five.app
          </a>{" "}
          and we&rsquo;ll respond within 30 days. We may need to verify you
          own the account first — that verification protects you. EU/EEA
          residents also have the right to lodge a complaint with their
          supervisory authority; Californians may exercise CCPA rights
          through an authorized agent.
        </p>
      </LegalSection>

      <LegalSection id="cookies" number={9} title="Cookies">
        <p>
          We use only the <strong>strictly necessary cookies</strong> that
          keep you signed in. No third-party advertising cookies, no
          cross-site tracking pixels, no product analytics, no marketing
          tags.
        </p>
        <p>
          Because these cookies are essential rather than optional,
          there&rsquo;s no cookie banner to click through — there&rsquo;s
          nothing to opt out of.
        </p>
      </LegalSection>

      <LegalSection id="children" number={10} title="Children">
        <p>
          chapter3five is for adults. You must be 18 or older to have an
          account, and we do not knowingly collect personal information from
          anyone under 18. If we learn we have, we will delete it. If you
          believe a minor has an account, tell us at
          privacy@chapter3five.app.
        </p>
      </LegalSection>

      <LegalSection
        id="international"
        number={11}
        title="Where your data lives"
      >
        <p>
          Your data is stored and processed in the{" "}
          <strong>United States</strong>. If you use chapter3five from
          elsewhere, you&rsquo;re transferring your data to the US, where
          privacy laws may differ from your country&rsquo;s. For users in
          regions with data-transfer requirements (like the EU/EEA and UK),
          we rely on appropriate safeguards such as our providers&rsquo;
          standard contractual clauses.
        </p>
      </LegalSection>

      <LegalSection id="breach" number={12} title="If something goes wrong">
        <p>
          If a data breach affects your personal information, we will notify
          you by email <strong>within 72 hours</strong> of confirming it,
          tell you plainly what happened and what data was involved, and what
          we&rsquo;re doing about it. We will also notify regulators where
          the law requires.
        </p>
      </LegalSection>

      <LegalSection id="changes" number={13} title="Changes to this policy">
        <p>
          If we change this policy in any material way, we&rsquo;ll email you
          at least 30 days before the change takes effect and update the date
          at the top of this page. We will never quietly reduce your privacy
          protections.
        </p>
      </LegalSection>

      <LegalSection id="contact" number={14} title="How to reach us">
        <p>
          For any privacy question or data request:{" "}
          <a
            href="mailto:privacy@chapter3five.app"
            className="font-semibold underline underline-offset-4"
          >
            privacy@chapter3five.app
          </a>
          . For everything else:{" "}
          <a
            href="mailto:hello@chapter3five.app"
            className="font-semibold underline underline-offset-4"
          >
            hello@chapter3five.app
          </a>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
