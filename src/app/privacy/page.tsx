import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Privacy — chapter3five",
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="April 25, 2026">
      <Section title="What this is">
        <p>
          chapter3five is a service that helps people record meaningful answers
          to a curated set of questions, so loved ones can revisit them later.
          This page explains what information we collect, how it&rsquo;s used,
          and what rights you have over it.
        </p>
      </Section>

      <Section title="What we collect">
        <ul>
          <li>Account information you provide (name, email).</li>
          <li>The answers you record in the app — text, and (optionally) media.</li>
          <li>
            Basic device and usage information needed to operate the app (e.g.,
            which questions have been answered, when you last opened the app).
          </li>
        </ul>
      </Section>

      <Section title="How we use it">
        <ul>
          <li>To provide the chapter3five experience itself.</li>
          <li>
            To allow loved ones you&rsquo;ve invited to access the archive you
            created.
          </li>
          <li>
            To improve the app — anonymized, aggregated usage only. We do not
            sell personal data.
          </li>
        </ul>
      </Section>

      <Section title="Who can see your archive">
        <p>
          Only you and the people you explicitly grant access. chapter3five
          staff cannot read your answers in the normal course of operations.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can request export or deletion of your data at any time by
          emailing <a href="mailto:privacy@chapter3five.app">privacy@chapter3five.app</a>.
        </p>
      </Section>

      <Section title="Inheritance">
        <p>
          chapter3five is designed so that the archive outlives the person who
          created it. The legal handling of access after death — who inherits,
          how access is granted, what happens if no successor is named — will
          be addressed in the final, reviewed version of this policy.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions: <a href="mailto:privacy@chapter3five.app">privacy@chapter3five.app</a>.
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
