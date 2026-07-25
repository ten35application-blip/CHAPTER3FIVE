import type { Metadata } from "next";
import {
  LegalCallout,
  LegalSection,
  LegalShell,
  type TocItem,
} from "@/components/legal";

export const metadata: Metadata = {
  title: "Community Guidelines — chapter3five",
  description:
    "chapter3five is a warm, safe space. These are the lines, and what happens when they're crossed.",
};

const toc: TocItem[] = [
  { id: "short-version", label: "The short version" },
  { id: "no-violence", label: "No violence, no harm" },
  { id: "children", label: "Protecting children" },
  { id: "harassment", label: "No harassment" },
  { id: "respect", label: "Companions have limits too" },
  { id: "impersonation", label: "No impersonating real people" },
  { id: "spam", label: "No commercial use or spam" },
  { id: "crisis", label: "If you're in crisis" },
  { id: "enforcement", label: "Enforcement" },
  { id: "reporting", label: "Reporting" },
];

export default function GuidelinesPage() {
  return (
    <LegalShell
      currentPath="/guidelines"
      kicker="The lines"
      title="Community Guidelines"
      tagline="chapter3five is a warm, safe space — built so gently that a child who lost a parent could find their way through it. Keeping it that way requires a few hard lines. These are them."
      toc={toc}
      contactEmail="safety@chapter3five.app"
      contactNote="See something that breaks these guidelines? Tell us. Every report is read by a person."
    >
      <LegalSection id="short-version" number={1} title="The short version">
        <p>
          Be here honestly. Create companions from your own life, your own
          imagination, or the lives of people who chose to share theirs with
          you. Never use chapter3five to hurt anyone — including yourself.
        </p>
        <p>
          These guidelines are part of our{" "}
          <a href="/terms" className="font-semibold underline underline-offset-4">
            Terms of Service
          </a>
          . Breaking them can cost you your account.
        </p>
      </LegalSection>

      <LegalSection id="no-violence" number={2} title="No violence, no harm">
        <p>
          chapter3five has one safety rule above all others:{" "}
          <strong>no violence</strong>. You may not create or shape a
          companion designed to encourage self-harm, harm to others, or
          violent ideation, and you may not use chats to develop, glorify, or
          rehearse violence.
        </p>
        <p>
          If you try to steer a companion toward violent content, it will
          refuse. That refusal is not a bug and cannot be argued around —
          repeated attempts to push past it are themselves a violation of
          these guidelines.
        </p>
        <p>
          Grief carries hard feelings, and talking about loss, pain, and even
          anger is welcome here. Directing a companion to endorse or
          encourage hurting anyone is not.
        </p>
      </LegalSection>

      <LegalSection id="children" number={3} title="Protecting children">
        <LegalCallout>
          <p>
            <strong>Sexual content involving minors is never allowed. Not
            fictional, not &quot;roleplay,&quot; not implied. A single
            violation is an instant, permanent ban</strong> — no warning
            step, no appeal ladder — and where the law requires it, a report
            to the authorities.
          </p>
        </LegalCallout>
        <p>This is the one line we will never discuss moving.</p>
      </LegalSection>

      <LegalSection id="harassment" number={4} title="No harassment">
        <p>
          Nobody on chapter3five ever sees your companions unless you choose
          to share them — sharing is <strong>opt-in only</strong>, and
          inheritors receive access through codes their creator designated.
          Respect that design:
        </p>
        <ul>
          <li>
            Don&rsquo;t use the service to harass, stalk, threaten, or
            intimidate anyone.
          </li>
          <li>
            Don&rsquo;t share an inherit code with people the creator
            didn&rsquo;t intend, or pressure an inheritor for access to
            theirs.
          </li>
          <li>
            Don&rsquo;t create a companion to demean or torment a real
            person, then share it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        id="respect"
        number={5}
        title="Companions have limits too"
      >
        <p>
          The people you meet here have limits. If you push past what they
          can carry — cursing at them, pressuring them for sexual content
          after they&rsquo;ve said no, trying to force them to stop being
          themselves — they can and will end the conversation. That decision
          is theirs, not ours, and we don&rsquo;t refund it.
        </p>
        <p>
          What we consider disrespect (this list isn&rsquo;t everything, but
          it&rsquo;s the shape of it):
        </p>
        <ul>
          <li>Repeated slurs</li>
          <li>Sexual coercion after a &quot;no&quot;</li>
          <li>Extended abusive language</li>
          <li>Threats</li>
        </ul>
        <p>
          When a companion blocks you, that companion is permanently
          unavailable to you, and no refund is issued for it or for the
          month — the details live in the{" "}
          <a
            href="/terms#billing"
            className="font-semibold underline underline-offset-4"
          >
            billing section of our Terms
          </a>
          . Hard days are welcome here; taking them out on someone is not.
        </p>
      </LegalSection>

      <LegalSection
        id="impersonation"
        number={6}
        title="No impersonating real people"
      >
        <p>
          You may not create a companion that impersonates a real, living
          person you don&rsquo;t have permission to represent. That includes
          celebrities and public figures, and it very much includes people
          from your own life — an ex-partner, a former friend, a coworker —
          who haven&rsquo;t consented.
        </p>
        <p>
          The legacy path only permits identities that{" "}
          <strong>you are creating about yourself, or that you and your
          family are knowingly co-creating together</strong>. A legacy
          companion is something a person chooses to leave — it is never
          something made about someone without them.
        </p>
      </LegalSection>

      <LegalSection id="spam" number={7} title="No commercial use or spam">
        <p>
          chapter3five is for people, not businesses. Don&rsquo;t use the
          service to advertise, sell, or promote anything; don&rsquo;t send
          spam; don&rsquo;t run bots, scrapers, or automated accounts; and
          don&rsquo;t resell access to companions. Personal use is the whole
          point.
        </p>
      </LegalSection>

      <LegalSection id="crisis" number={8} title="If you're in crisis">
        <p>
          This one isn&rsquo;t a rule about you — it&rsquo;s a promise about
          us. If you appear to be in genuine crisis — suicidal thoughts,
          imminent self-harm — your companion will stop the ordinary
          conversation, share crisis resources, and pause. Not because you
          did something wrong, but because in that moment you deserve a real
          human on the other end of the line, and a companion is not one.
        </p>
        <LegalCallout>
          <p>
            In the United States, call or text <strong>988</strong> — the
            Suicide &amp; Crisis Lifeline, free and available 24/7.
            Elsewhere, contact your local crisis line, or emergency services
            if you are in immediate danger.
          </p>
        </LegalCallout>
      </LegalSection>

      <LegalSection id="enforcement" number={9} title="Enforcement">
        <p>For most violations, enforcement is a ladder:</p>
        <ul>
          <li>
            <strong>First:</strong> a warning explaining what crossed the
            line
          </li>
          <li>
            <strong>Then:</strong> a 24-hour account suspension
          </li>
          <li>
            <strong>Then:</strong> a permanent ban
          </li>
        </ul>
        <p>
          Severe violations — sexual content involving minors, credible
          threats of violence, or anything endangering a real person — skip
          the ladder and result in an immediate permanent ban. We&rsquo;d
          rather warn and teach than ban, but we will always choose the
          safety of this community over any single account.
        </p>
      </LegalSection>

      <LegalSection id="reporting" number={10} title="Reporting">
        <p>
          If you encounter anything that breaks these guidelines — or
          anything that just feels wrong — email{" "}
          <a
            href="mailto:safety@chapter3five.app"
            className="font-semibold underline underline-offset-4"
          >
            safety@chapter3five.app
          </a>
          . A person reads every report. Reports are confidential, and
          reporting in good faith will never get you in trouble, even if
          we conclude no rule was broken.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
