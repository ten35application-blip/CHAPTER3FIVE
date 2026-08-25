import Link from "next/link";
import { InfoShell } from "@/components/info-shell";

export const metadata = {
  title: "Support · chapter3five",
  description:
    "How to reach us, common questions, and what to do if something isn't working.",
};

export default function SupportPage() {
  return (
    <InfoShell
      kicker="We're here"
      title="Support."
      tagline="Something not working, or just need a hand? Send us a note and a real person writes back."
      contactEmail="hello@chapter3five.app"
      contactNote="Fastest way to reach us is email. We answer within one business day."
    >
      <p>
        chapter3five is a small team building carefully. If you&rsquo;re
        stuck on something, need to change an account detail, or just have
        a question about what we do &mdash; write to us. We read every
        message and reply personally.
      </p>

      <h2>Common questions</h2>

      <p>
        <strong>How do I delete my account?</strong>
      </p>
      <p>
        In the mobile app, open <em>Settings</em> and scroll to{" "}
        <em>Delete account</em>. You&rsquo;ll be asked to confirm.
        Deletion is scheduled and takes effect after a 30-day grace
        window &mdash; if you change your mind, sign back in during that
        window to cancel it. On the web, email us at{" "}
        <a
          href="mailto:hello@chapter3five.app"
          className="font-semibold text-coral-strong hover:underline"
        >
          hello@chapter3five.app
        </a>{" "}
        and we&rsquo;ll process it for you. See our{" "}
        <Link
          href="/data-deletion"
          className="font-semibold text-coral-strong hover:underline"
        >
          data deletion policy
        </Link>{" "}
        for the full flow.
      </p>

      <p>
        <strong>I forgot my password.</strong>
      </p>
      <p>
        On the sign-in screen, tap <em>Forgot password?</em> &mdash; we
        send a reset link to your email. If nothing arrives, check spam
        first, then write to us.
      </p>

      <p>
        <strong>Someone gave me an inherit code. How do I use it?</strong>
      </p>
      <p>
        Sign in and open the <em>Redeem an inherit code</em> flow. Paste
        the code and their archive lands in your contacts. The code stays
        yours to keep, even if the original owner closes their account
        down the road.
      </p>

      <p>
        <strong>A reply from my companion felt wrong.</strong>
      </p>
      <p>
        Press and hold the message itself &mdash; the same menu that
        holds the reactions has a <em>Report</em> option that sends the
        details straight to our care inbox. This works on the website
        and in the app. We review every report.
      </p>

      <p>
        <strong>The app won&rsquo;t open, or it crashed.</strong>
      </p>
      <p>
        Try closing and reopening it first. If the problem persists, email
        us with your device (iPhone model, iOS version) and a short
        description of what you were doing when it happened. Screenshots
        help.
      </p>

      <p>
        <strong>I&rsquo;m in crisis.</strong>
      </p>
      <p>
        chapter3five isn&rsquo;t crisis care and isn&rsquo;t a substitute
        for a real person. If you&rsquo;re in the US, please call or text{" "}
        <strong>988</strong>. UK Samaritans: <strong>116 123</strong>.
        Mexico SAPTEL: <strong>+52 55 5259&nbsp;8121</strong>. Reach a
        human when it counts.
      </p>

      <h2>Anything else</h2>
      <p>
        Feedback, feature requests, bugs, or just want to tell us what
        chapter3five has meant to you &mdash; we read all of it. Email
        below, or write to{" "}
        <a
          href="mailto:hello@chapter3five.app"
          className="font-semibold text-coral-strong hover:underline"
        >
          hello@chapter3five.app
        </a>{" "}
        for anything that isn&rsquo;t a support ticket.
      </p>
    </InfoShell>
  );
}
