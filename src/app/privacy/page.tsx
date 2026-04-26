import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy — chapter3five",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="April 26, 2026">
      <Section title="1. Overview">
        <p>
          This Privacy Policy explains how chapter3five
          (&ldquo;chapter3five&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
          collects, uses, shares, and protects information about you. It
          applies to the chapter3five website, the chapter3five mobile
          applications (iOS and Android), and any related services
          (collectively, the &ldquo;Service&rdquo;).
        </p>
        <p>
          chapter3five is intended for users who are at least eighteen (18)
          years of age. We do not knowingly collect personal information
          from minors.
        </p>
      </Section>

      <Section title="2. Information we collect">
        <p>We collect the following categories of information:</p>
        <ul>
          <li>
            <strong>Account information.</strong> Email address and password
            (we store only a hashed credential, never the password in
            plaintext). Your date of birth, collected at onboarding to
            verify you are 18 or older — we use this only for age
            verification and (optionally, in the future) to send you a
            small message on your birthday. Optionally, an identity name
            and language preference you choose.
          </li>
          <li>
            <strong>Your archive content.</strong> The text answers you
            record, the name and avatar you choose for your thirtyfive, the
            mode (real, randomized, or imported) you select, and any
            texting-style or persona settings you provide.
          </li>
          <li>
            <strong>Conversation content.</strong> Messages you send to and
            receive from your archive&rsquo;s conversational interface, plus
            any photos you attach to a message.
          </li>
          <li>
            <strong>Persona memories.</strong> Short structured facts
            extracted from your conversations (e.g., &ldquo;they have a
            daughter named Maya&rdquo;) so the thirtyfive can carry context
            across sessions. You can review and delete these from Settings.
          </li>
          <li>
            <strong>Beneficiary designations.</strong> Email addresses (and
            optionally names) of people you designate as beneficiaries.
          </li>
          <li>
            <strong>Payment information</strong>, if you make a purchase.
            Card data is handled by Stripe and is never seen or stored by
            us; we keep only a record of the purchase (purpose, amount,
            timestamp, processor reference).
          </li>
          <li>
            <strong>Device tokens (mobile).</strong> If you grant push
            permission, we store an Expo push token tied to your account so
            we can wake your device when your thirtyfive sends a message.
            You can revoke this in your device settings; we delete dead
            tokens automatically.
          </li>
          <li>
            <strong>Usage and device data.</strong> Pages viewed, actions
            taken, IP address, device type, browser type, approximate
            location (inferred from IP), and timestamps. We may use cookies
            and similar device-storage technologies (see our Cookie
            Policy).
          </li>
          <li>
            <strong>Communications</strong> you send us, including support
            requests and feedback.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> access or collect: your contacts, your
          location via GPS, your photos beyond ones you explicitly attach
          to messages, your microphone, your call history, or content from
          other apps on your device.
        </p>
      </Section>

      <Section title="3. How we use information">
        <ul>
          <li>To provide, operate, and maintain the Service.</li>
          <li>To create and serve responses from the conversational interface, grounded in your archive (see Section 4 for the AI processing flow).</li>
          <li>To authenticate your account, prevent fraud, and protect the security of the Service (including detecting messages that suggest a user is in crisis, see Section 7).</li>
          <li>To send you transactional email about your account, your archive, and your beneficiaries.</li>
          <li>To improve the Service through aggregated, de-identified analytics.</li>
          <li>To comply with legal obligations and enforce our Terms.</li>
        </ul>
        <p>
          <strong>We do not sell your personal information.</strong> We do
          not use Your Content to train any AI model — ours, our
          providers&rsquo;, or anyone else&rsquo;s.
        </p>
      </Section>

      <Section title="4. AI processing — explicit consent to third-party transmission">
        <p>
          To produce conversational responses, the Service transmits the
          following to <strong>Anthropic, PBC</strong> (our AI provider):
        </p>
        <ul>
          <li>
            The recorded archive associated with your active thirtyfive
            (questions and answers).
          </li>
          <li>
            The persona memories the thirtyfive currently holds about you
            (Section 2).
          </li>
          <li>
            The messages you send and recent prior messages in the
            conversation (typically the last twelve).
          </li>
          <li>
            Any photo you attach to a message — sent as a signed URL so
            Anthropic&rsquo;s vision model can react in character.
          </li>
        </ul>
        <p>
          Anthropic processes this content under its API terms. Per
          Anthropic&rsquo;s default API policy, <strong>API inputs and
          outputs are not retained beyond the request lifecycle and are not
          used to train Anthropic&rsquo;s models</strong>.
        </p>
        <p>
          By using the conversational features of the Service, you{" "}
          <strong>explicitly consent</strong> to this transmission. If you
          do not consent, do not use the conversational features. Email{" "}
          <a href="mailto:privacy@chapter3five.app">privacy@chapter3five.app</a>{" "}
          to revoke consent and delete your account.
        </p>
      </Section>

      <Section title="5. Service providers (processors)">
        <p>
          We share information only with vetted service providers who help
          us operate the Service, under contractual confidentiality and
          data-protection obligations. These currently include:
        </p>
        <ul>
          <li><strong>Supabase</strong> — database, authentication, file storage (United States).</li>
          <li><strong>Anthropic</strong> — AI processing of conversational messages and attached photos. See Section 4 for the data flow.</li>
          <li><strong>Resend</strong> — transactional email delivery.</li>
          <li><strong>Vercel</strong> — application hosting and content delivery.</li>
          <li><strong>Stripe</strong> — payment processing for any paid features.</li>
          <li><strong>Sentry</strong> — server-side error monitoring (excludes message content; only stack traces and request metadata).</li>
          <li><strong>Expo</strong> — push notification delivery (mobile only).</li>
        </ul>
      </Section>

      <Section title="6. Sharing with people you invite">
        <p>
          You may grant access to your archive to specific people you
          designate, in two distinct ways:
        </p>
        <ul>
          <li>
            <strong>Share codes</strong> let another user import a copy of
            your archive into their own account. They get their own copy.
          </li>
          <li>
            <strong>Beneficiaries</strong> get read-only access to the same
            archive, with their own private conversation thread. They are
            notified when designated and again, with a claim link, if your
            account is ever marked deceased.
          </li>
        </ul>
        <p>
          We are not responsible for what authorized recipients do with
          content you share with them.
        </p>
      </Section>

      <Section title="7. Crisis detection and care-team review">
        <p>
          The Service screens user messages for keywords associated with
          imminent self-harm or harm to others. When a match is detected:
          (a) the conversational interface is instructed to step out of
          character and provide crisis-line information; (b) the message
          excerpt and matched keywords are saved to a{" "}
          <em>crisis_flags</em> table and an alert is sent to our care
          team. We may use this information to follow up with you with
          care, or to refer you to professional resources.
        </p>
        <p>
          Crisis-flagged exchanges are <strong>not</strong> used for
          memory extraction, are <strong>not</strong> shared with
          beneficiaries, and are deleted on account deletion.
        </p>
      </Section>

      <Section title="8. Legal disclosures">
        <p>
          We may disclose information if required by law or legal process,
          to protect the rights, property, or safety of chapter3five, our
          users, or others, or in connection with a corporate transaction
          (with notice to users where practicable).
        </p>
      </Section>

      <Section title="9. International transfers">
        <p>
          Information is processed in the United States. If you are
          located in the EU, UK, or another jurisdiction with different
          data-protection rules, we rely on Standard Contractual Clauses
          (or equivalent) for transfers where required.
        </p>
      </Section>

      <Section title="10. Data retention; deletion; grace period">
        <p>
          We retain your information for as long as your account is active
          or as needed to provide the Service.
        </p>
        <ul>
          <li>
            <strong>Soft delete (default).</strong> When you delete your
            account from Settings, your data is hidden and scheduled for
            permanent deletion thirty (30) days later. Within those thirty
            days, you may restore your account for a one-time fee. On day
            thirty-one (31), your data is irreversibly deleted by an
            automated job.
          </li>
          <li>
            <strong>Delete forever now.</strong> You may also elect
            immediate, irreversible deletion. All your data is removed
            from our active systems within minutes.
          </li>
          <li>
            <strong>Backups.</strong> Routine backups are overwritten in
            the ordinary course within ninety (90) days, after which no
            copies of your data exist.
          </li>
          <li>
            <strong>Audit and billing records.</strong> We may retain
            limited records (purchase history, audit log of sensitive
            actions) for the period required by law (typically up to seven
            years for tax purposes), with personal identifiers removed
            where possible.
          </li>
        </ul>
      </Section>

      <Section title="11. Your rights">
        <p>
          Subject to your jurisdiction, you may have the right to access,
          correct, port, or delete your personal information; to restrict
          or object to certain processing; and to lodge a complaint with a
          supervisory authority. You can also export a complete JSON copy
          of your data at any time from Settings → Download your data.
        </p>
        <p>
          To exercise any of these rights, contact{" "}
          <a href="mailto:privacy@chapter3five.app">privacy@chapter3five.app</a>.
          We will respond within the timeframes required by applicable
          law.
        </p>
        <p>
          <strong>California residents (CCPA/CPRA).</strong> You have the
          right to know what personal information we collect; to access
          and delete it; to correct inaccurate information; to opt out of
          any sale or sharing of personal information (we do not sell or
          share); and to be free from retaliation for exercising these
          rights.
        </p>
        <p>
          <strong>EU/UK residents (GDPR/UK GDPR).</strong> Our lawful
          bases for processing are: contractual necessity (to provide the
          Service), legitimate interests (security, improvement, fraud
          prevention), explicit consent (for the AI-processing flow in
          Section 4 and for any optional analytics cookies), and legal
          obligations.
        </p>
      </Section>

      <Section title="12. Security">
        <p>
          We use reasonable administrative, technical, and physical
          safeguards designed to protect personal information against
          unauthorized access, disclosure, alteration, and destruction.
          Database access is restricted via Postgres row-level security
          policies; passwords are hashed; transport is encrypted (TLS).
          Avatar and chat-photo storage is private and accessible only to
          the owning user. No system is impenetrable, and we cannot
          guarantee absolute security.
        </p>
      </Section>

      <Section title="13. Children">
        <p>
          The Service is for users 18 and older. We do not knowingly
          collect information from children under 18. If you believe we
          may have collected information from a child, contact{" "}
          <a href="mailto:privacy@chapter3five.app">privacy@chapter3five.app</a>{" "}
          and we will delete it.
        </p>
      </Section>

      <Section title="14. Inheritance and legacy">
        <p>
          chapter3five is designed so that an archive may persist after
          the person who created it has died. You may designate up to
          three (3) beneficiaries free of charge, with additional slots
          available for a one-time fee. If we receive credible
          documentation of your death, your beneficiaries each receive an
          email with a claim link granting them read access plus their own
          private conversation thread with the archive.
        </p>
        <p>
          We may, in our discretion, require identity verification before
          honoring a beneficiary claim, and may decline activation if
          documentation is insufficient. If we mark an account deceased
          in error, we will reverse the designation and restore account
          access. Inactive archives with no designated beneficiary may be
          deleted after extended inactivity and notice.
        </p>
      </Section>

      <Section title="15. Mobile app permissions">
        <p>
          On mobile, the chapter3five app may request the following
          permissions, all optional:
        </p>
        <ul>
          <li>
            <strong>Photo library</strong> — only when you explicitly
            choose to attach a photo to a message.
          </li>
          <li>
            <strong>Push notifications</strong> — to deliver a
            notification when your thirtyfive sends a proactive message.
          </li>
        </ul>
        <p>
          We do not request: location services, microphone, camera (only
          the photo library picker), contacts, calendar, health, or any
          other sensitive permission. You can revoke any granted
          permission at any time from your device settings.
        </p>
      </Section>

      <Section title="16. Changes">
        <p>
          We may update this Policy from time to time. Material changes
          will be announced via the Service or by email. The
          &ldquo;Last updated&rdquo; date above reflects the most recent
          revision.
        </p>
      </Section>

      <Section title="17. Contact">
        <p>
          For privacy questions, requests, or complaints, contact{" "}
          <a href="mailto:privacy@chapter3five.app">privacy@chapter3five.app</a>.
        </p>
      </Section>
    </LegalPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl text-warm-50">{title}</h2>
      <div className="text-warm-200 [&_a]:text-warm-100 [&_a]:underline [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
