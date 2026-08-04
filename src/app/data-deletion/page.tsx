import Link from "next/link";
import { InfoShell } from "@/components/info-shell";

export const metadata = {
  title: "Data Deletion · chapter3five",
  description:
    "How to delete your chapter3five account and everything attached to it.",
};

/**
 * /data-deletion — the deletion-instructions page Apple and Google
 * require for app-store listings: a public web page describing the
 * in-app path to full account deletion.
 */
export default function DataDeletionPage() {
  return (
    <InfoShell
      kicker="Your data"
      title="Deleting your account."
    >
      <p>
        You can delete your chapter3five account and the data attached to
        it yourself, from inside the app:
      </p>
      <ul>
        <li>
          <strong>Log in</strong> at{" "}
          <Link
            href="/auth/signin"
            className="font-semibold text-coral-strong underline underline-offset-4 transition-colors hover:text-warm-50"
          >
            chapter3five.app
          </Link>{" "}
          (the same flow whether you use the website or the mobile app).
        </li>
        <li>
          Open <strong>Settings</strong>.
        </li>
        <li>
          Choose <strong>Delete account</strong> and confirm.
        </li>
      </ul>
      <p>
        Deletion covers your profile, your companions and their
        conversation history, any legacy recordings you made, and the
        inherit codes you created. Your account is deactivated
        immediately, and after a <strong>30-day grace period</strong>{" "}
        &mdash; there in case of a genuine &ldquo;wait, no&rdquo; &mdash;
        everything is permanently and irreversibly purged. Once that
        window closes, there is no archive we can restore from.
      </p>
      <p>
        For the details of what we store while your account is active,
        how long things are retained, and the small set of records we may
        keep where the law requires it, see our{" "}
        <Link
          href="/privacy"
          className="font-semibold text-coral-strong underline underline-offset-4 transition-colors hover:text-warm-50"
        >
          Privacy Policy
        </Link>
        .
      </p>
    </InfoShell>
  );
}
