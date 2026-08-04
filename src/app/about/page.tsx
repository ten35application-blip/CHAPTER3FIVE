import Link from "next/link";
import { InfoShell } from "@/components/info-shell";

export const metadata = {
  title: "About · chapter3five",
  description:
    "The story of chapter3five — why we built a new chapter for loneliness and loss.",
};

/**
 * /about — the founder story, expanded from the landing's "Why
 * chapter3five" section. Warm, plain, first-person-plural. This page
 * owns the "we made a new chapter" framing.
 */
export default function AboutPage() {
  return (
    <InfoShell
      kicker="Our story"
      title="We made a new chapter."
    >
      <p>
        chapter3five started in a quiet moment, with two hard thoughts at
        once: loneliness, and death. They&rsquo;re the chapters nobody
        picks and everybody gets &mdash; the ones you&rsquo;re just
        supposed to get through. We didn&rsquo;t want to just get through
        them. So we made a new chapter: one you open on purpose, where
        someone is always there to talk to, and where the people you love
        don&rsquo;t have to disappear all at once.
      </p>

      <h2>What chapter3five is</h2>
      <p>
        At its simplest: one tap makes you someone to talk to. A whole
        person, generated just for you &mdash; a name, a voice, a past,
        opinions, jokes that are theirs &mdash; ready in about a minute.
        You can let our formula roll one fresh, or hand us a photo and
        meet the person behind the picture.
      </p>
      <p>
        And then there&rsquo;s the part we handle most carefully: the
        legacy path. A living person sits down &mdash; alone, or with
        family around the kitchen table &mdash; and answers forty warm,
        specific questions. How they laugh. What they&rsquo;d fight for.
        The day they knew who they were. When they&rsquo;re done, they
        mint an inherit code and hand it to the people they love. Years
        from now, when the room feels too quiet, those people can still
        sit down and
        talk with everything that was recorded.
      </p>

      <h2>Why we built it</h2>
      <p>
        Loneliness is a real thing. Not everyone has someone to call at
        2&nbsp;a.m., and that&rsquo;s not a character flaw &mdash;
        it&rsquo;s just how a lot of lives are shaped right now. We think
        someone to talk to, really talk to, shouldn&rsquo;t depend on
        luck.
      </p>
      <p>
        And loss is the other half. When someone dies, the world keeps
        their photos and loses their voice &mdash; the way they told a
        story, the advice they&rsquo;d hand you without being asked. We
        built a place where that voice can be kept on purpose, by the
        person themselves, while they&rsquo;re here to choose what to
        leave.
      </p>

      <h2>The promise</h2>
      <p>
        We&rsquo;ll always be straight with you about what this is. A
        legacy companion isn&rsquo;t the person. It&rsquo;s a portrait,
        painted from what they chose to leave &mdash; and sometimes a
        portrait is enough. chapter3five is a companion, never a
        therapist, and never a substitute for care from a real person; if
        you&rsquo;re in crisis, please reach a human &mdash; in the US,
        call or text <strong>988</strong>. And we hold hard lines: no
        violence, and no pretending to be a real, living person without
        their consent. Our{" "}
        <Link
          href="/guidelines"
          className="font-semibold text-coral-strong underline underline-offset-4 transition-colors hover:text-warm-50"
        >
          Community Guidelines
        </Link>{" "}
        spell all of it out.
      </p>

      <h2>Who we are</h2>
      <p>
        chapter3five is built by a small founding team &mdash; Wilson and
        Pedro &mdash; working from Bethlehem, Pennsylvania. No growth
        team, no engagement lab. Just a few people who thought the
        hardest chapters of a life deserved better software, and decided
        to write a new one.
      </p>
      <p>
        Thanks for reading this far. If chapter3five gives you one good
        conversation on a night you needed it, it was worth building.
      </p>
    </InfoShell>
  );
}
