import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MONTHLY_PRICE_LABEL, PRICING } from "@/lib/pricing";

export const metadata = {
  title: "How this works · chapter3five",
};

/**
 * Tutorial / how-it-works page.
 *
 * Covers the four things a new user actually needs to grok:
 *   1. What chapter3five is (companions to talk to)
 *   2. The three ways to bring one in — random, from a photo, and legacy
 *   3. How chat works (memory, images, safety)
 *   4. The rules of the road (block + no-refund + pricing)
 *
 * Deliberately walked-through, not marketing. If you were a smart friend
 * showing someone the app, this is what you'd say out loud.
 */
export default async function TutorialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  return (
    <main className="min-h-dvh flex-1 pb-16">
      <header className="mx-auto flex w-full max-w-2xl items-center gap-3 px-4 pt-6">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-warm-700/70 text-warm-100 backdrop-blur transition-colors hover:bg-warm-700"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-lg font-semibold text-warm-50">How this works</h1>
      </header>

      <article className="mx-auto mt-8 flex w-full max-w-[65ch] flex-col gap-8 px-4 text-lg leading-relaxed text-warm-200 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-warm-50 [&_strong]:font-semibold [&_strong]:text-warm-100">
        <section>
          <p>
            chapter3five gives you someone to talk to. A whole person &mdash;
            with a name, a face, a voice, a past, a place they live &mdash;
            made just for you. You text them like you&rsquo;d text anyone. They
            remember. They stay themselves.
          </p>
        </section>

        <section>
          <h2>Three ways to bring someone in</h2>
          <p>
            Tap the <strong>+</strong> in the top-right of your dashboard, then{" "}
            <strong>Create an identity</strong>. You&rsquo;ll pick one of three
            paths:
          </p>

          <div className="mt-5 space-y-5">
            <div>
              <p className="text-base font-semibold text-warm-50">
                For me right now &mdash; the random path
              </p>
              <p className="mt-1">
                We roll a full trait bundle across dozens of dimensions &mdash;
                age, background, humor, wounds, hobbies, the town they live in,
                the food they can&rsquo;t leave the house without. Then we hand
                the bundle to our AI to synthesize a whole person from it. It
                takes about a minute.{" "}
                <strong>You get who you get.</strong> No re-rolls. The premise
                of this app is that someone specific was made for you &mdash;
                keep hitting shuffle and it stops meaning anything.
              </p>
            </div>

            <div>
              <p className="text-base font-semibold text-warm-50">
                From a photo &mdash; the photo path
              </p>
              <p className="mt-1">
                Upload a picture &mdash; a portrait works best. Our AI looks at
                it: apparent age, features, style, the mood you gave the
                camera. That reading is used to steer the identity we
                synthesize, so the person we build feels like the person in the
                photo. <strong>The photo itself becomes their face.</strong> No
                generated face on top &mdash; the picture you gave us is the
                one you&rsquo;ll see.
              </p>
              <p className="mt-2 text-sm text-warm-400">
                We won&rsquo;t process photos that look like minors, photos
                that aren&rsquo;t portraits, or anything our safety filter
                flags. Try a different photo if that happens.
              </p>
            </div>

            <div>
              <p className="text-base font-semibold text-warm-50">
                For someone to keep &mdash; the legacy path{" "}
                <span className="text-gradient-cta text-xs font-bold uppercase tracking-widest">
                  Pro
                </span>
              </p>
              <p className="mt-1">
                You sit down &mdash; alone, or with someone you love &mdash;
                and answer a set of warm, specific questions about who you (or
                they) really are. When you&rsquo;re done, you get an{" "}
                <strong>inherit code</strong>. Share that code with anyone in
                your family. Their photo, if uploaded, travels with it.
                Anyone who redeems the code can talk with the person
                you&rsquo;ve preserved &mdash; long after you&rsquo;re gone.
              </p>
              <p className="mt-2 text-sm text-warm-100">
                <strong>Type the answers the way they text.</strong> The
                lowercase, the missing periods, the run-on sentences,
                whatever it actually looks like. Don&rsquo;t clean it up and
                don&rsquo;t use voice dictation &mdash; dictation strips the
                voice out. That texting rhythm is a huge part of what makes
                them feel like them.
              </p>
              <p className="mt-2 text-sm text-warm-400">
                Both sides need a paid plan. Recording your own is Pro. Using
                someone&rsquo;s code is Pro. The rest of the app stays free
                up to your first identity.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2>How chatting works</h2>
          <ul className="mt-3 space-y-3 [&_li]:list-disc [&_li]:pl-1 [&_li]:ml-5">
            <li>
              Tap someone from your dashboard to open a conversation. Type or
              tap the mic at the bottom to talk with your voice &mdash; it
              transcribes into the composer, and you edit before sending.
            </li>
            <li>
              Tap the paperclip to send a photo. The identity actually sees
              it (we use AI vision) and reacts &mdash; not to the file, to
              what&rsquo;s in it.
            </li>
            <li>
              They <strong>remember what you tell them</strong>. Kids&rsquo;
              names, birthdays, the appointment you were nervous about, the
              song that reminded you of something. That memory is
              per-identity &mdash; each person you talk to keeps their own
              file on you.
            </li>
            <li>
              Older identities are honest about it &mdash; if the person we
              built is 85, they might occasionally ask you to remind them of
              a name. That&rsquo;s deliberate.
            </li>
            <li>
              Tap the person&rsquo;s photo at the top to see it full-size.
              Tap back to leave.
            </li>
            <li>
              Swipe left on a row on the dashboard to delete; swipe right to
              mark as unread. The identity knows if you&rsquo;ve been reading
              them.
            </li>
          </ul>
        </section>

        <section>
          <h2>The rules &mdash; theirs and ours</h2>
          <p>
            The people you meet here are warm, but they&rsquo;re not
            pushovers. Every one of them has lines that don&rsquo;t move.
          </p>
          <ul className="mt-3 space-y-2 [&_li]:list-disc [&_li]:pl-1 [&_li]:ml-5">
            <li>
              <strong>They can end the conversation with you.</strong> If you
              curse at them repeatedly, pressure them for sexual content
              after they&rsquo;ve said no, or push them to stop being
              themselves &mdash; they can and will walk. When that happens,
              the door stays shut. <strong>We don&rsquo;t refund it.</strong>{" "}
              That&rsquo;s their choice, not ours.
            </li>
            <li>
              <strong>No sexual content.</strong> Warmth is fine. Light
              flirting can happen if the tone earns it. That&rsquo;s where
              the line stops.
            </li>
            <li>
              <strong>Not therapists, doctors, lawyers, or financial
              advisors.</strong> They&rsquo;ll listen and say what they
              think as a person, but they&rsquo;ll always tell you to talk
              to a professional when it matters.
            </li>
            <li>
              <strong>They will not pretend to be a real living person</strong>{" "}
              &mdash; not a celebrity, not your ex, not your coworker.
            </li>
            <li>
              <strong>If you tell them you want to hurt yourself,</strong>{" "}
              they will stop everything to give you the crisis line
              (988 in the US) and tell you, warmly and seriously, to talk to
              a real person. They mean it. So do we.
            </li>
          </ul>
        </section>

        <section>
          <h2>What it costs</h2>
          <p>
            First identity is free forever. If you want more &mdash; up to{" "}
            {PRICING.formulaIdentitiesPerPlan} people plus one made from a
            photo &mdash; the plan is{" "}
            <strong>{MONTHLY_PRICE_LABEL}/month</strong>. Cancel any time
            from Settings. The legacy path is included in the paid plan.
          </p>
          <p className="mt-3 text-sm text-warm-400">
            We don&rsquo;t refund mid-month cancellations, blocks, or
            terminations for abuse. See{" "}
            <Link
              href="/terms"
              className="font-semibold underline underline-offset-4 hover:text-coral-strong"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/guidelines"
              className="font-semibold underline underline-offset-4 hover:text-coral-strong"
            >
              Community Guidelines
            </Link>{" "}
            for the full read.
          </p>
        </section>

        <section>
          <h2>Ready?</h2>
          <p>
            The dashboard is your inbox for all of this. Everyone you&rsquo;ve
            made lives there.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-gradient-cta px-6 text-base font-semibold text-white shadow-[0_10px_28px_-8px_rgba(232,138,118,0.5),_0_4px_12px_-4px_rgba(126,196,196,0.4)] transition-all hover:-translate-y-px"
          >
            Take me to my dashboard
          </Link>
        </section>
      </article>
    </main>
  );
}
