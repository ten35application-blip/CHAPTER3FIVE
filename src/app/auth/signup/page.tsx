import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { redirectWithError, sanitizeErrorParam } from "@/lib/action-errors";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubmitButton } from "./SubmitButton";
import { GuidedDobInput } from "./GuidedDobInput";

export const metadata = {
  title: "Begin a chapter · chapter3five",
};

/**
 * Whole-year age at reference-date. Uses month/day comparison rather
 * than a divide by 365.25 so someone whose 18th birthday is today is
 * exactly 18 and passes.
 */
function ageOnDate(dob: Date, on: Date): number {
  let age = on.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < dob.getUTCMonth() ||
    (on.getUTCMonth() === dob.getUTCMonth() &&
      on.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

async function signUp(formData: FormData) {
  "use server";

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const dobRaw = String(formData.get("date_of_birth") ?? "").trim();

  if (!email || !password) {
    redirectWithError("/auth/signup", "Enter your email and password.");
  }
  // 8-char floor matches the update-password page and Supabase's own
  // default minimum. If the project's Auth settings still cap higher
  // than 8, the resulting error from supabase.auth.signUp below is
  // surfaced verbatim -- but this app-level check should mirror the
  // dashboard setting so a caller gets a specific message before the
  // network round-trip.
  if (password.length < 8) {
    redirectWithError("/auth/signup", "Password needs at least 8 characters.");
  }
  // Mobile-parity error copy (2026-08-03): the DOB field is a plain
  // YYYY-MM-DD text input on both surfaces now, so the message needs
  // to teach the format, not just say "please enter".
  if (!dobRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
    redirectWithError(
      "/auth/signup",
      "Enter your date of birth as YYYY-MM-DD (e.g. 1990-04-25).",
    );
  }
  const dob = new Date(`${dobRaw}T00:00:00Z`);
  if (Number.isNaN(dob.getTime())) {
    redirectWithError("/auth/signup", "That date of birth doesn't look right.");
  }
  // Sanity cap: reject obviously bogus dates (future / >120y ago). No
  // one has a legitimate signup with a birthday in the future.
  const now = new Date();
  if (dob > now) {
    redirectWithError("/auth/signup", "Date of birth can't be in the future.");
  }
  const age = ageOnDate(dob, now);
  if (age < 18) {
    // Explicit copy: chapter3five is 18+ and we don't want to be
    // ambiguous with under-18 visitors.
    redirectWithError(
      "/auth/signup",
      "You have to be 18 or older to use chapter3five.",
    );
  }
  if (age > 120) {
    redirectWithError("/auth/signup", "That date of birth doesn't look right.");
  }

  const supabase = await createClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Same celebrated landing the mobile app uses — the signin page
      // shows "Your email is verified ✓" + an open-the-app button.
      emailRedirectTo: "https://chapter3five.app/auth/signin?confirmed=1",
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("registered") || msg.includes("already")) {
      redirectWithError(
        "/auth/signup",
        "That email is already in use. Try signing in.",
        error,
      );
    }
    if (msg.includes("valid") && msg.includes("email")) {
      redirectWithError(
        "/auth/signup",
        "That email doesn't look right.",
        error,
      );
    }
    // Any password-policy rejection from Supabase (length, complexity)
    // -- surface it verbatim so the user knows what to fix instead of
    // hitting the generic "something went wrong" catch.
    if (msg.includes("password")) {
      redirectWithError("/auth/signup", error.message, error);
    }
    redirectWithError(
      "/auth/signup",
      "Something went wrong. Try again in a moment.",
      error,
    );
  }

  // Duplicate signup, disguised as success. Supabase won't confirm that
  // an address is registered — it answers with a success-shaped
  // response whose identities array is EMPTY, and sends no email. The
  // "check your inbox" screen that followed pointed at mail that never
  // existed (Wilson 2026-08-16). Same read as the mobile signup.
  if (
    signUpData?.user &&
    (signUpData.user.identities?.length ?? 0) === 0
  ) {
    redirectWithError(
      "/auth/signup",
      "That email already has an account. Try signing in, or use “Forgot password”.",
    );
  }

  // Persist DOB via the admin client — 0090 puts date_of_birth in the
  // protect_billing_columns denylist so a user can't PATCH it later
  // via the anon key to change the age they registered as. Best-
  // effort: signup succeeded, we don't want to bounce the user if
  // the DOB write hits a transient error; log for follow-up.
  const newUserId = signUpData?.user?.id;
  if (newUserId) {
    try {
      const admin = createAdminClient();
      const { error: dobErr } = await admin
        .from("profiles")
        .update({ date_of_birth: dobRaw })
        .eq("id", newUserId);
      if (dobErr) {
        console.error("[signup] date_of_birth write failed:", dobErr);
      }
    } catch (err) {
      console.error("[signup] date_of_birth admin client threw:", err);
    }

    // Referral (0143): the share link carries ?ref=CODE, the form
    // carries it through as a hidden field. Recorded here, at the one
    // moment the new account's id is known. Silent on every failure —
    // an unknown code, a self-referral, or an account that was already
    // referred must never turn somebody's signup into an error.
    const refCode = String(formData.get("ref") ?? "").trim();
    if (refCode) {
      const { claimReferral } = await import("@/lib/referral");
      await claimReferral(refCode, newUserId);
    }
  }

  // Mobile-parity 2026-08-03: inline the "check your email" success
  // state rather than redirecting to /auth/check-email. Same page,
  // ?sent= carries the email so the success view can echo it back.
  redirect(`/auth/signup?sent=${encodeURIComponent(email)}`);
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string; ref?: string }>;
}) {
  const { error: rawError, sent, ref } = await searchParams;
  const error = sanitizeErrorParam(rawError);

  // Inline success view — mirrors mobile app/auth/signup.tsx's
  // sentTo branch. Same copy down to the period.
  if (sent) {
    return (
      <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-sm flex-col items-center text-center">
          <Link
            href="/"
            aria-label="chapter3five home"
            className="hero-orb flex items-center justify-center"
          >
            <Image
              src="/logo-transparent.png"
              alt="chapter3five"
              width={80}
              height={80}
              priority
              className="h-20 w-20 drop-shadow-[0_16px_40px_rgba(232,138,118,0.3)]"
            />
          </Link>
          <h1 className="mt-8 text-3xl font-bold tracking-[-0.02em] text-warm-50">
            Check your email.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-warm-200">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-warm-50">{sent}</span>. Click
            it, then come back to sign in.
          </p>
          <Link
            href="/auth/signin"
            className="mt-8 flex h-12 items-center justify-center px-6 text-base font-semibold text-coral-strong transition-colors hover:text-coral"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
        {/* Back to landing — top-left affordance (mobile parity). */}
        <div className="w-full">
          <Link
            href="/"
            className="inline-flex h-11 items-center text-base font-semibold text-coral-strong transition-colors hover:text-coral"
          >
            <span aria-hidden="true">&larr;</span>
            <span className="ml-1">Back</span>
          </Link>
        </div>

        {/* Small hero moment — logo inside a compact aura echoing the
            landing, so the auth page feels like it belongs to the same
            product rather than a stock signup form. */}
        <Link
          href="/"
          aria-label="chapter3five home"
          className="hero-orb flex items-center justify-center"
        >
          <Image
            src="/logo-transparent.png"
            alt="chapter3five"
            width={80}
            height={80}
            priority
            className="h-20 w-20 drop-shadow-[0_16px_40px_rgba(232,138,118,0.3)]"
          />
        </Link>

        <h1 className="mt-8 text-4xl font-bold tracking-[-0.02em] text-warm-50">
          Begin a chapter.
        </h1>
        <p className="mt-3 text-base text-warm-300">
          Email + password. That&rsquo;s it.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-6 w-full rounded-2xl bg-warm-700 px-4 py-3 text-center text-sm text-warm-100"
          >
            {error}
          </p>
        ) : null}

        <form action={signUp} className="mt-8 flex w-full flex-col gap-3">
          {/* Carries the share code from the URL through the POST —
              the referral is recorded server-side the moment the
              account exists. */}
          {ref ? <input type="hidden" name="ref" value={ref} /> : null}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-warm-200">Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-coral"
              placeholder="you@example.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-warm-200">Password</span>
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-coral"
              placeholder="Password (8+ characters)"
            />
          </label>

          {/* Plain YYYY-MM-DD text input — mobile parity 2026-08-03,
              replaced the three-dropdown DobField. Regex-validated on
              submit; the copy under the field spells the age-gate
              intent so it doesn't read as tracking. */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-warm-200">
              Date of birth
            </span>
            <GuidedDobInput />
          </label>
          <p className="text-xs leading-relaxed text-warm-400">
            Year, then month, then day — like 1990-04-25. Chapter3five is 18+;
            we ask so we can verify eligibility once, not to track you.
          </p>

          <SubmitButton />
        </form>

        <p className="mt-6 text-sm text-warm-300">
          Already have an account?{" "}
          <Link
            href="/auth/signin"
            className="font-semibold text-coral-strong transition-colors hover:text-coral"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
