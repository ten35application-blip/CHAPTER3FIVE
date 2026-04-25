import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy — chapter3five",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="April 25, 2026">
      <Section title="1. Overview">
        <p>
          This Privacy Policy explains how chapter3five
          (&ldquo;chapter3five&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;)
          collects, uses, shares, and protects information about you. It
          applies to the chapter3five website and any related services
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
          <li><strong>Account information.</strong> Email address and password (hashed) you provide on signup. Optionally, your name and language preference.</li>
          <li><strong>Your archive content.</strong> The text answers you record, the oracle name you choose, and the mode (real or randomized) you select.</li>
          <li><strong>Conversation content.</strong> Messages you send to and receive from your archive&rsquo;s conversational interface.</li>
          <li><strong>Usage and device data.</strong> Pages viewed, actions taken, IP address, device and browser type, approximate location, and timestamps. We may use cookies and similar technologies (see our Cookie Policy).</li>
          <li><strong>Payment information</strong>, if you make a purchase. Card data is handled by our payment processor; we do not store full card numbers.</li>
          <li><strong>Communications</strong> you send us, including support requests and feedback.</li>
        </ul>
      </Section>

      <Section title="3. How we use information">
        <ul>
          <li>To provide, operate, and maintain the Service.</li>
          <li>To create and serve responses from the conversational interface, grounded in your archive.</li>
          <li>To authenticate accounts, prevent fraud, and protect the security of the Service.</li>
          <li>To communicate with you about your account, the Service, and updates.</li>
          <li>To improve the Service through aggregated, de-identified analytics.</li>
          <li>To comply with legal obligations and enforce our Terms.</li>
        </ul>
        <p>
          <strong>We do not sell your personal information.</strong> We do
          not use your archive content to train third-party general-purpose
          AI models.
        </p>
      </Section>

      <Section title="4. Service providers (processors)">
        <p>
          We share information only with vetted service providers who help
          us operate the Service, under contractual confidentiality and data
          protection obligations. These currently include:
        </p>
        <ul>
          <li><strong>Supabase</strong> — database, authentication, file storage.</li>
          <li><strong>Anthropic</strong> — generation of conversational responses based on your archive content. Anthropic processes content under its own data protection commitments and does not use API content to train its models by default.</li>
          <li><strong>Resend</strong> — transactional email delivery.</li>
          <li><strong>Vercel</strong> — application hosting and content delivery.</li>
          <li><strong>Stripe</strong> (when applicable) — payment processing.</li>
        </ul>
      </Section>

      <Section title="5. Sharing with people you invite">
        <p>
          You may grant access to your archive to specific people you
          designate. We share archive content with those people under the
          permissions you set. We are not responsible for what authorized
          recipients do with content you share with them.
        </p>
      </Section>

      <Section title="6. Legal disclosures">
        <p>
          We may disclose information if required by law or legal process,
          to protect the rights, property, or safety of chapter3five, our
          users, or others, or in connection with a corporate transaction
          (with notice to users where practicable).
        </p>
      </Section>

      <Section title="7. International transfers">
        <p>
          Information may be processed in the United States and other
          countries that may have different data protection laws than your
          jurisdiction. We rely on appropriate safeguards (such as Standard
          Contractual Clauses) where required.
        </p>
      </Section>

      <Section title="8. Data retention">
        <p>
          We retain your information for as long as your account is active
          or as needed to provide the Service, and as required to comply
          with legal obligations, resolve disputes, and enforce our
          agreements. You may request deletion at any time (see Section 9).
        </p>
      </Section>

      <Section title="9. Your rights">
        <p>
          Subject to your jurisdiction, you may have the right to access,
          correct, port, or delete your personal information; to restrict
          or object to certain processing; and to lodge a complaint with a
          supervisory authority.
        </p>
        <p>
          To exercise any of these rights, contact{" "}
          <a href="mailto:privacy@chapter3five.app">privacy@chapter3five.app</a>.
          We will respond within the timeframes required by applicable law.
        </p>
        <p>
          <strong>California residents (CCPA/CPRA).</strong> You have the
          right to know what personal information we collect; to access and
          delete it; to correct inaccurate information; to opt out of any
          sale or sharing of personal information (we do not sell or share);
          and to be free from retaliation for exercising these rights.
        </p>
        <p>
          <strong>EU/UK residents (GDPR/UK GDPR).</strong> Our lawful bases
          for processing are: contractual necessity (to provide the
          Service), legitimate interests (security, improvement, fraud
          prevention), consent (where applicable, e.g., optional analytics
          cookies), and legal obligations.
        </p>
      </Section>

      <Section title="10. Security">
        <p>
          We use reasonable administrative, technical, and physical
          safeguards designed to protect personal information against
          unauthorized access, disclosure, alteration, and destruction.
          Database access is restricted via row-level security; passwords
          are hashed; transport is encrypted (TLS). No system is
          impenetrable, and we cannot guarantee absolute security.
        </p>
      </Section>

      <Section title="11. Children">
        <p>
          The Service is for users 18 and older. We do not knowingly collect
          information from children under 18. If you believe we may have
          collected information from a child, contact{" "}
          <a href="mailto:privacy@chapter3five.app">privacy@chapter3five.app</a>{" "}
          and we will delete it.
        </p>
      </Section>

      <Section title="12. Inheritance and legacy">
        <p>
          chapter3five is designed so that an archive may persist after the
          person who created it has died. We will, prior to general
          availability, publish a clear successor designation process and
          procedures for verifying identity. By using the Service, you agree
          we may take reasonable measures to verify a successor before
          granting access, and that we may delete inactive archives after a
          notice period.
        </p>
      </Section>

      <Section title="13. Changes">
        <p>
          We may update this Policy from time to time. Material changes
          will be announced via the Service or by email. The
          &ldquo;Last updated&rdquo; date above reflects the most recent
          revision.
        </p>
      </Section>

      <Section title="14. Contact">
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
