import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Cookies — chapter3five",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="April 25, 2026">
      <Section title="What cookies are">
        <p>
          Cookies are small text files stored on your device by your browser.
          They help websites remember things — like whether you&rsquo;re signed
          in, or what you last looked at.
        </p>
      </Section>

      <Section title="What chapter3five uses">
        <ul>
          <li>
            <strong>Essential cookies.</strong> Required to keep you signed in
            and the app functioning. We can&rsquo;t turn these off without
            breaking the service.
          </li>
          <li>
            <strong>Analytics (anonymized).</strong> Aggregate usage signals
            that tell us which questions get answered most, which sections get
            read — never tied to a single person.
          </li>
        </ul>
      </Section>

      <Section title="What we don&rsquo;t use">
        <p>
          No advertising cookies. No third-party trackers we don&rsquo;t need
          to operate the service. No selling of cookie data to third parties.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          You can clear cookies in your browser at any time. Doing so will
          sign you out and reset any preferences.
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
