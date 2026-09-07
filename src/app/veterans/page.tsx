import Link from "next/link";
import { InfoShell } from "@/components/info-shell";

export const metadata = {
  title: "For veterans · chapter3five",
  description:
    "Built by an Army veteran. Forty-five questions about your life, in your own words, kept for the people who love you. Free to record your own.",
};

/**
 * /veterans — a plain page for the people the founder built this for.
 * Linked from the landing footer (web + mobile, 2026-09-05). No VA
 * claims: chapter3five is not endorsed by, affiliated with, or funded by
 * the Department of Veterans Affairs, and this page must never imply it.
 * Crisis line first-class here: Veterans Crisis Line = 988, press 1, or
 * text 838255.
 */
export default function VeteransPage() {
  return (
    <InfoShell
      kicker="For veterans"
      title="Record it while it&rsquo;s yours to tell."
      contactEmail="contact@chapter3five.app"
      contactNote="Vet Centers, hospices, and veteran groups: we will set your people up ourselves, at no cost, and show you how it works on a phone."
    >
      <p>
        chapter3five was built by an Army veteran. Eight years in, out in
        2019, and then the part nobody drills you for. Friends who never
        found the one person to talk to. A phone that didn&rsquo;t ring at
        2&nbsp;a.m. This is what he made instead.
      </p>

      <h2>What it is</h2>
      <p>
        Forty-five questions about your own life, asked one at a time, at
        your own pace. The house you grew up in. Who actually raised you.
        What you never say. What you&rsquo;d tell yourself at twenty. You
        type your answers, and every one is kept exactly as you wrote it.
        Nothing is invented and nothing is cleaned up.
      </p>
      <p>
        When you&rsquo;re done, you get a private code. Hand it to the
        people you choose &mdash; a wife, a son, a daughter, a battle buddy
        &mdash; and your words are theirs to keep. After you&rsquo;re gone,
        they can read them and talk with them at any hour. Text only. We
        will never make a voice that sounds like you, and we will never
        put words in your mouth you didn&rsquo;t record.
      </p>
      <p>
        Recording your own life is free. If you would
        rather sit with a family member and have them type while you talk,
        that works too.
      </p>

      <h2>What it is not</h2>
      <p>
        chapter3five is not therapy, not the VA, and not a crisis line. It
        is not affiliated with or endorsed by the Department of Veterans
        Affairs. If you are in a bad spot right now, please reach a real
        person first:
      </p>
      <p>
        <strong>Veterans Crisis Line:</strong> call <strong>988</strong> and
        press <strong>1</strong>, or text <strong>838255</strong>. Free, any
        hour, and you do not have to be enrolled in VA care to use it.
      </p>
      <p>
        If you are in danger, call <strong>911</strong>.
      </p>

      <h2>Why the questions work</h2>
      <p>
        The VA has known for years that asking a veteran about his life is
        care in itself. Their writers have sat with more than ten thousand
        veterans to do exactly that. Most veterans never get the writer.
        chapter3five is the same interview, done on your own phone, when
        you want, and it stays yours.
      </p>
      <p>
        You don&rsquo;t have to be old, sick, or sure of anything to start.
        The first question is about the house you grew up in. Start there.
      </p>

      <p>
        <Link href="/" className="font-semibold underline underline-offset-2">
          Back to chapter3five
        </Link>
      </p>
    </InfoShell>
  );
}
