import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalCallout,
  LegalSection,
  LegalShell,
  type TocItem,
} from "@/components/legal";

export const metadata: Metadata = {
  title: "End-User License Agreement — chapter3five",
  description:
    "The license you're granted to use chapter3five and its content, plus how that license changes for the iOS App Store version.",
};

const toc: TocItem[] = [
  { id: "what-this-is", label: "What this document is" },
  { id: "license", label: "The license we grant you" },
  { id: "restrictions", label: "What you can't do with that license" },
  { id: "content", label: "Ownership of the content" },
  { id: "ios", label: "iOS App Store terms" },
  { id: "termination", label: "When this license ends" },
  { id: "warranty-liability", label: "Warranty and liability" },
  { id: "governing-law", label: "Governing law" },
  { id: "contact", label: "How to reach us" },
];

/**
 * Public End-User License Agreement.
 *
 * Apple's "Instructions for Minimum Terms of Developer's EULA" let
 * developers either accept Apple's standard EULA or provide their own,
 * so long as ours includes the listed Minimum Terms. Section 5 below
 * carries those Minimum Terms in near-verbatim form (Acknowledgment,
 * Scope, Maintenance & Support, Warranty & Warranty-Refund, Product
 * Claims, IP, Legal Compliance, Developer Name & Address, Third-Party
 * Terms, Third-Party Beneficiary).
 *
 * For web usage this page and the Terms of Service both apply — the
 * ToS covers the broader relationship (billing, conduct, disputes)
 * while this EULA covers the software-license mechanics App Store
 * review specifically looks for.
 */
export default function EulaPage() {
  return (
    <LegalShell
      currentPath="/eula"
      kicker="The license"
      title="End-User License Agreement"
      tagline="The specific license you receive when you use chapter3five on the web or through an app store, and the extra terms that apply on iOS."
      toc={toc}
      contactEmail="hello@chapter3five.app"
      contactNote="Questions about this license? Write to us and a person will answer."
    >
      <LegalCallout>
        Effective July 27, 2026. This EULA sits alongside our{" "}
        <Link href="/terms" className="text-coral-strong hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-coral-strong hover:underline">
          Privacy Policy
        </Link>
        . If you don&rsquo;t agree with any of them, don&rsquo;t use
        chapter3five.
      </LegalCallout>

      <LegalSection id="what-this-is" number={1} title="What this document is">
        <p>
          This is the licensing agreement between you and chapter3five
          (&ldquo;we,&rdquo; &ldquo;us&rdquo;) for the chapter3five
          application — the website at chapter3five.app, the iOS app,
          the Android app, and any related software. It covers what
          you&rsquo;re allowed to do with the software itself, as
          distinct from the service the software connects to (which is
          covered by our{" "}
          <Link href="/terms" className="text-coral-strong hover:underline">
            Terms of Service
          </Link>
          ).
        </p>
      </LegalSection>

      <LegalSection id="license" number={2} title="The license we grant you">
        <p>
          We grant you a personal, non-exclusive, non-transferable,
          revocable license to install and use chapter3five on devices
          you own or control, solely for your own personal,
          non-commercial use, and solely to interact with the
          chapter3five service in the ways the software is designed to
          allow. This license lasts as long as you comply with this
          agreement and our Terms of Service.
        </p>
        <p>
          The license doesn&rsquo;t transfer any ownership. All rights
          in the software — copyrights, trademarks, trade secrets,
          patents — stay with us or our licensors. Nothing in this
          document grants you a license to any of our trademarks, logos,
          or brand elements.
        </p>
      </LegalSection>

      <LegalSection id="restrictions" number={3} title="What you can't do with that license">
        <p>You agree not to:</p>
        <ul>
          <li>
            Copy, modify, translate, reverse-engineer, decompile,
            disassemble, or create derivative works of the software,
            except where the law expressly permits it despite this
            restriction.
          </li>
          <li>
            Rent, lease, sublicense, sell, redistribute, or transfer the
            software or your access to it.
          </li>
          <li>
            Remove or alter any copyright, trademark, or other
            proprietary notices.
          </li>
          <li>
            Use the software to build a competing product, to scrape or
            harvest data at scale, or to train a machine-learning model
            on chapter3five content or transcripts.
          </li>
          <li>
            Use the software to violate any law or the rights of any
            third party, including intellectual-property, privacy, and
            publicity rights.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="content" number={4} title="Ownership of the content">
        <p>
          You own the personal content you contribute — your questions,
          your uploaded photos, the identities you build. The content
          the service generates on your behalf (persona responses,
          synthesized voices, generated images) is licensed to you for
          the same personal, non-commercial use as the software itself.
          You may keep and export copies of your data at any time from
          Settings.
        </p>
        <p>
          You agree that generated content is a computed response, not
          a statement of fact by a real person, and you will not present
          it as if it were.
        </p>
      </LegalSection>

      <LegalSection id="ios" number={5} title="iOS App Store terms">
        <p>
          If you obtained chapter3five through Apple&rsquo;s App Store,
          the following additional terms apply and, where they conflict
          with anything else in this document, take precedence:
        </p>
        <ul>
          <li>
            <strong>Acknowledgment.</strong> This EULA is concluded
            between you and chapter3five only, not with Apple, and
            chapter3five (not Apple) is solely responsible for the app
            and its content. This EULA does not provide for usage rules
            for the app that are less restrictive than or in conflict
            with the Apple Media Services Terms and Conditions.
          </li>
          <li>
            <strong>Scope of License.</strong> The license Apple grants
            you for the app is limited to a non-transferable license
            to use the app on any Apple-branded product that you own
            or control, and as permitted by the Usage Rules set forth
            in the Apple Media Services Terms and Conditions, except
            that the app may be accessed, acquired, and used by other
            accounts associated with you via Family Sharing or volume
            purchasing.
          </li>
          <li>
            <strong>Maintenance and Support.</strong> chapter3five is
            solely responsible for providing any maintenance and
            support services with respect to the app, as specified in
            this EULA or as required under applicable law. You and
            chapter3five acknowledge that Apple has no obligation
            whatsoever to furnish any maintenance and support services
            with respect to the app.
          </li>
          <li>
            <strong>Warranty.</strong> chapter3five is solely
            responsible for any product warranties, whether express or
            implied by law, to the extent not effectively disclaimed.
            In the event of any failure of the app to conform to any
            applicable warranty, you may notify Apple, and Apple will
            refund the purchase price for the app to you; and to the
            maximum extent permitted by applicable law, Apple will
            have no other warranty obligation whatsoever with respect
            to the app. Any other claims, losses, liabilities, damages,
            costs, or expenses attributable to any failure to conform
            to any warranty will be the sole responsibility of
            chapter3five.
          </li>
          <li>
            <strong>Product Claims.</strong> You and chapter3five
            acknowledge that chapter3five, not Apple, is responsible
            for addressing any claims of yours or of any third party
            relating to the app or your possession and/or use of the
            app, including but not limited to: (i) product-liability
            claims; (ii) any claim that the app fails to conform to
            any applicable legal or regulatory requirement; and (iii)
            claims arising under consumer-protection, privacy, or
            similar legislation, including in connection with the
            app&rsquo;s use of the HealthKit or HomeKit frameworks (if
            applicable).
          </li>
          <li>
            <strong>Intellectual-Property Rights.</strong> You and
            chapter3five acknowledge that, in the event of any
            third-party claim that the app or your possession and use
            of the app infringes that third party&rsquo;s
            intellectual-property rights, chapter3five, not Apple, will
            be solely responsible for the investigation, defense,
            settlement, and discharge of any such intellectual-property
            infringement claim.
          </li>
          <li>
            <strong>Legal Compliance.</strong> You represent and
            warrant that (i) you are not located in a country that is
            subject to a U.S. Government embargo, or that has been
            designated by the U.S. Government as a &ldquo;terrorist
            supporting&rdquo; country; and (ii) you are not listed on
            any U.S. Government list of prohibited or restricted
            parties.
          </li>
          <li>
            <strong>Developer Name and Address.</strong> Questions,
            complaints, or claims with respect to the app should be
            directed to chapter3five at{" "}
            <a
              href="mailto:hello@chapter3five.app"
              className="text-coral-strong hover:underline"
            >
              hello@chapter3five.app
            </a>
            . A physical mailing address for legal service will be
            provided on request. (This EULA will be updated with a
            street address once our business registration is complete.)
          </li>
          <li>
            <strong>Third-Party Terms of Agreement.</strong> You must
            comply with applicable third-party terms of agreement when
            using the app — for example, your wireless data-service
            agreement and any Apple terms that apply to your use of
            iCloud, Family Sharing, or other Apple services the app
            interacts with.
          </li>
          <li>
            <strong>Third-Party Beneficiary.</strong> You and
            chapter3five acknowledge and agree that Apple, and
            Apple&rsquo;s subsidiaries, are third-party beneficiaries
            of this EULA, and that, upon your acceptance of the terms
            and conditions of this EULA, Apple will have the right
            (and will be deemed to have accepted the right) to enforce
            this EULA against you as a third-party beneficiary thereof.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="termination" number={6} title="When this license ends">
        <p>
          This license ends automatically if you breach any of its
          terms, and we may end it at any time by giving you notice or
          by terminating your account under the Terms of Service. When
          the license ends, you must stop using the software and
          uninstall any copies you hold. Sections meant to survive
          termination — restrictions, ownership, disclaimers, liability
          limits, governing law — do survive.
        </p>
      </LegalSection>

      <LegalSection id="warranty-liability" number={7} title="Warranty and liability">
        <p>
          The software is provided &ldquo;as is,&rdquo; without warranty
          of any kind. We disclaim all implied warranties, including
          merchantability, fitness for a particular purpose, and
          non-infringement, to the fullest extent permitted by law. Our
          maximum aggregate liability under this EULA is limited to the
          amount you paid us for the software or service in the twelve
          months before the claim.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" number={8} title="Governing law">
        <p>
          This EULA is governed by the laws set out in our{" "}
          <Link href="/terms" className="text-coral-strong hover:underline">
            Terms of Service
          </Link>
          , with the same forum and arbitration provisions applying.
        </p>
      </LegalSection>

      <LegalSection id="contact" number={9} title="How to reach us">
        <p>
          For licensing questions, contact{" "}
          <a
            href="mailto:hello@chapter3five.app"
            className="text-coral-strong hover:underline"
          >
            hello@chapter3five.app
          </a>
          . For account and billing matters, use the addresses on the{" "}
          <Link
            href="/settings/help"
            className="text-coral-strong hover:underline"
          >
            help page
          </Link>
          .
        </p>
      </LegalSection>
    </LegalShell>
  );
}
