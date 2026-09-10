import Link from "next/link";
import { InfoShell } from "@/components/info-shell";

export const metadata = {
  title: "For our Veterans and Service Members · chapter3five",
  description:
    "Built by an Army veteran to keep a veteran's own words for the people who love him. Forty-five questions, kept exactly as you wrote them, free to record your own. Thank you for your service.",
};

/**
 * /veterans — for the people the founder built this for (rewritten
 * 2026-09-09 at Wilson's ask: thankful, proud, and clear that a
 * veteran's life is a legacy worth saving). No VA claims: chapter3five
 * is not endorsed by, affiliated with, or funded by the Department of
 * Veterans Affairs, and this page must never imply it. Crisis line
 * first-class here: Veterans Crisis Line = 988, press 1, or text 838255.
 * The phone's landing footer opens this same page.
 */
export default function VeteransPage() {
  return (
    <InfoShell
      kicker="For our Veterans and Service Members"
      title="Thank you. Now let us keep your story."
      contactEmail="contact@chapter3five.app"
      contactNote="Vet Centers, hospices, and veteran groups: we will set your people up ourselves, at no cost, and show you how it works on a phone."
    >
      <p>
        You raised your hand when most people didn&rsquo;t. Whether you are
        still serving or you hung it up years ago, you gave years of your
        life on the country&rsquo;s time, in places most of us will never
        see, next to people you would have died for. Whatever you carried
        home from that, and whatever it cost you, it is not forgotten here.
        Thank you.
      </p>
      <p>
        chapter3five was built by an Army veteran. Eight years in, out in
        2019, and then the part nobody drills you for. Friends who never
        found the one person to talk to. A phone that didn&rsquo;t ring at
        2&nbsp;a.m. He built this so no veteran&rsquo;s story ends with the
        people who loved him wishing they had asked.
      </p>

      <h2>Your life is a legacy worth saving</h2>
      <p>
        Your service is already history. Your life is the part your family
        will want: the house you grew up in, who actually raised you, the
        things you say that nobody else says, what you&rsquo;d tell a scared
        kid, the story you want the grandchildren telling at the table. A
        folded flag says what you did. Your own words say who you were.
        Those words deserve to be saved, and only you can record them.
      </p>

      <h2>What it is</h2>
      <p>
        Forty-five questions about your own life, asked one at a time, at
        your own pace, on your own phone. You type your answers, and every
        one is kept exactly as you wrote it. Nothing is invented and nothing
        is cleaned up. It stays yours.
      </p>
      <p>
        When you&rsquo;re done, you get a private code. Hand it to the
        people you choose &mdash; a wife, a son, a daughter, a battle buddy
        &mdash; and your words are theirs to keep. After you&rsquo;re gone,
        they can read them and talk with them at any hour, and hear you
        answer in your own words. Text only. We will never make a voice
        that sounds like you, and we will never put words in your mouth you
        didn&rsquo;t record.
      </p>
      <p>
        Recording your own life is free for you, and the code is free for
        your family. If you would rather sit with a family member and have
        them type while you talk, that works too.
      </p>

      <h2>To the families</h2>
      <p>
        If you love a veteran, ask now. Not when he is sick, not at the end.
        On an ordinary Tuesday, while the stories still come easily and he
        can still laugh at the parts he shouldn&rsquo;t tell you. The
        questions are here. The first one is about the house he grew up in.
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
        You have already done the hard part of your life. This part is just
        telling it. The first question is about the house you grew up in.
        Start there.
      </p>
      <p>
        <Link
          href="/"
          className="font-semibold text-coral-strong transition-colors hover:text-coral"
        >
          Back to chapter3five
        </Link>
      </p>
    </InfoShell>
  );
}
