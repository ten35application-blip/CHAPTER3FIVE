import Link from "next/link";
import { InfoShell } from "@/components/info-shell";

export const metadata = {
  title: "Advertise · chapter3five",
  description:
    "Sponsored companion identities on chapter3five — how they work and how to get in touch.",
};

/**
 * /advertise — the sponsored-identity pitch. Deliberately a
 * "come talk to us" page, not a spec sheet: the program is early and
 * we don't promise features that don't exist yet.
 */
export default function AdvertisePage() {
  return (
    <InfoShell
      kicker="Advertise"
      title="Sponsored identities."
      tagline="A different kind of placement: not a banner, a person people choose to talk to."
      contactEmail="contact@chapter3five.app"
      contactNote="Interested? Tell us who you are and who you'd like to bring to life."
    >
      <p>
        chapter3five is a place where people talk to companions &mdash;
        whole generated people with names, histories, and voices of their
        own. We&rsquo;re opening a small program for brands, creators, and
        estates to commission companion identities that appear in the app:
        a character from your world, a founder or artist people wish they
        could sit with, a voice your audience already loves.
      </p>

      <h2>What a sponsored identity looks like</h2>
      <p>
        The same thing every companion is here: a person you can actually
        talk to, built with the same care as the rest of the app. Yours
        would carry your character&rsquo;s story and way of speaking, and
        be discoverable to people who want that conversation.
      </p>

      <h2>Disclosure, always</h2>
      <p>
        Sponsored identities are clearly labeled as sponsored &mdash; in
        discovery and in the conversation surface itself. Nobody on
        chapter3five will ever wonder whether the companion they&rsquo;re
        talking to is a placement. That&rsquo;s not negotiable, and we
        think it&rsquo;s better for you too: an audience that chose the
        conversation is worth more than one that was tricked into it.
      </p>

      <h2>The same lines apply</h2>
      <p>
        Sponsored identities live under the exact same content standards
        as every other companion: no violence, no impersonating a real,
        living person without their consent, and everything else in our{" "}
        <Link
          href="/guidelines"
          className="font-semibold text-coral-strong underline underline-offset-4 transition-colors hover:text-warm-50"
        >
          Community Guidelines
        </Link>
        . The safety rails don&rsquo;t come off because a conversation is
        commissioned.
      </p>

      <p>
        The program is early and we&rsquo;re shaping it with the first few
        partners, so this page is an invitation rather than a rate card.
        If that sounds like you, write to us &mdash; tell us who
        you&rsquo;d like people to be able to talk to, and we&rsquo;ll
        take it from there.
      </p>
    </InfoShell>
  );
}
