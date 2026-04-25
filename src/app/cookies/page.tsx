import { LegalPage } from "@/components/LegalPage";

export const metadata = {
  title: "Cookies — chapter3five",
};

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Policy" lastUpdated="April 25, 2026">
      <Section title="1. What cookies are">
        <p>
          Cookies are small text files placed on your device by a website
          you visit. Similar technologies (local storage, session storage,
          pixel tags) work in comparable ways. This Policy uses
          &ldquo;cookies&rdquo; to refer to all such technologies.
        </p>
      </Section>

      <Section title="2. How we use cookies">
        <p>chapter3five uses cookies in the following categories:</p>
        <ul>
          <li>
            <strong>Strictly necessary.</strong> Required to operate the
            Service — for example, to authenticate your session, remember
            that you are signed in, and protect against cross-site request
            forgery. The Service will not function without these. We cannot
            disable them on your behalf.
          </li>
          <li>
            <strong>Functional.</strong> Remember preferences such as your
            language selection, so you don&rsquo;t have to set them on
            every visit.
          </li>
          <li>
            <strong>Analytics (aggregate, de-identified).</strong> Help us
            understand which pages are visited, where users come from, and
            which questions are answered most. We use this only in
            aggregate and never to identify an individual user. Where
            required by law, we will request your consent before setting
            these cookies.
          </li>
        </ul>
        <p>
          <strong>We do not use advertising cookies.</strong> We do not
          allow third parties to set advertising cookies through our
          Service.
        </p>
      </Section>

      <Section title="3. Third parties">
        <p>
          Our processors (e.g., Supabase, Vercel) may set strictly
          necessary cookies to operate authentication, hosting, and
          security functions. They are bound by contractual data
          protection obligations.
        </p>
      </Section>

      <Section title="4. Your choices">
        <p>
          You can clear cookies in your browser at any time. Doing so will
          sign you out and reset preferences. You can also configure most
          browsers to refuse cookies or alert you when cookies are being
          sent. If you disable strictly necessary cookies, the Service may
          not function.
        </p>
        <p>
          For analytics cookies, where consent is required by your
          jurisdiction, we will offer a banner-based control on first
          visit. You may withdraw consent at any time from your account
          settings.
        </p>
      </Section>

      <Section title="5. Changes">
        <p>
          We may update this Cookie Policy from time to time. The
          &ldquo;Last updated&rdquo; date above reflects the most recent
          revision.
        </p>
      </Section>

      <Section title="6. Contact">
        <p>
          For questions about cookies or this Policy, contact{" "}
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
