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
      tagline="You trust us with some of the most personal words you'll ever write. Here is exactly what we collect, why, who touches it, and how you take it back."
      toc={toc}
      contactEmail="privacy@chapter3five.app"
      contactNote="Data requests and privacy questions go here. A person reads every one."
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
            take (and today the service doesn&rsquo;t use either at all)
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
            <strong>Anthropic</strong> — our AI provider. Receives chat
            content to generate companion replies (see Section 6 — this one
            deserves its own section).
          </li>
          <li>
            <strong>Stripe</strong> — payments. Handles your card and billing
            details; we receive only subscription metadata.
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
            Chat content is sent to Anthropic under a{" "}
            <strong>zero-data-retention configuration</strong>: Anthropic
            processes it to generate the reply and does not retain it
            afterward, and your messages are{" "}
            <strong>never used to train AI models</strong>.
          </p>
        </LegalCallout>
        <p>
          Your conversations are stored only in our own database (Supabase),
          under your account, where you can delete them.
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
            <strong>Legacy identities are different, on purpose.</strong> An
            identity someone recorded for inheritance is kept until{" "}
            <strong>every designated inheritor has deleted it, or 100 years
            have passed</strong> — whichever comes first. A legacy identity
            is a gift meant to outlive its creator, so it does not die with
            the creator&rsquo;s account.
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
