import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Terms — chapter3five",
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="April 25, 2026">
      <Section title="Agreement">
        <p>
          By using chapter3five, you agree to these terms. If you don&rsquo;t
          agree, please don&rsquo;t use the service.
        </p>
      </Section>

      <Section title="What chapter3five is">
        <p>
          chapter3five is an application for recording, organizing, and
          revisiting personal answers to a curated set of questions. It is not
          a medical, legal, or therapeutic service.
        </p>
      </Section>

      <Section title="Your account">
        <ul>
          <li>
            <strong>You must be 18 years of age or older to use chapter3five.</strong>{" "}
            chapter3five is an adults-only product. By creating an account, you
            confirm you meet this requirement.
          </li>
          <li>You must provide accurate information when creating an account.</li>
          <li>You&rsquo;re responsible for keeping your account credentials safe.</li>
        </ul>
      </Section>

      <Section title="The nature of chapter3five">
        <p>
          chapter3five preserves a person&rsquo;s voice and personality through
          their own recorded answers. Conversations with the resulting archive
          are not therapy, not medical advice, and not a substitute for
          professional support. The archive will respond in the voice of the
          person it represents — including their opinions, biases, moods, and
          imperfections. That is the design.
        </p>
      </Section>

      <Section title="Your content">
        <p>
          You own everything you record in chapter3five. By using the service,
          you grant us a limited license to store and serve that content back
          to you and the people you grant access to — nothing more.
        </p>
      </Section>

      <Section title="What you can&rsquo;t do">
        <ul>
          <li>Use chapter3five to record content about people without their consent.</li>
          <li>Use the app to harass, harm, or impersonate anyone.</li>
          <li>Reverse engineer or attempt to extract data that isn&rsquo;t yours.</li>
        </ul>
      </Section>

      <Section title="Changes and termination">
        <p>
          We may update the service and these terms. Material changes will be
          announced. You can close your account at any time, in which case
          your data is exported on request and then deleted.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          chapter3five is provided as-is. We make no guarantees that the
          service will be uninterrupted or error-free. We&rsquo;re not liable
          for indirect or consequential damages.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions: <a href="mailto:legal@chapter3five.app">legal@chapter3five.app</a>.
        </p>
      </Section>
    </LegalPage>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl text-warm-50">{title}</h2>
      <div className="text-warm-200 [&_a]:text-warm-100 [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
        {children}
      </div>
    </section>
  );
}
