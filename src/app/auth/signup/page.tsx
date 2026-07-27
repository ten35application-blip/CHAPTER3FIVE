import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DobField } from "./DobField";

export const metadata = {
  title: "Make an account · chapter3five",
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
  // Supabase Auth password policy on this project is 12 chars minimum.
  // Client-side floor must match, or a valid-here / rejected-there
  // password 8-11 chars long falls through to the generic
  // "Something went wrong" catch below with no useful message.
  if (password.length < 12) {
    redirectWithError("/auth/signup", "Password needs at least 12 characters.");
  }
  if (!dobRaw || !/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
    redirectWithError("/auth/signup", "Please enter your date of birth.");
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
  }

  // Straight to the acceptance gate — the (gated) layout would bounce
  // them there from /dashboard anyway, but going direct skips a hop.
  redirect("/onboarding");
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // Client-side year bounds for the DOB pickers: newest year is
  // today - 18 (someone born in that year could already be 18), oldest
  // is today - 120. Server-side checks still validate the exact date
  // on submit — these bounds just keep obviously-invalid years out of
  // the dropdown.
  const currentYear = new Date().getUTCFullYear();
  const maxDobYear = currentYear - 18;
  const minDobYear = currentYear - 120;

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-sm flex-col items-center">
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
          Make an <span className="text-gradient-cta">account.</span>
        </h1>
        <p className="mt-3 text-base text-warm-300">
          It only takes a minute.
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
              minLength={12}
              className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-coral"
              placeholder="At least 12 characters"
            />
          </label>

          <DobField maxYear={maxDobYear} minYear={minDobYear} />

          <button
            type="submit"
            className="bg-gradient-cta hover:bg-gradient-cta-hover mt-4 flex h-14 w-full items-center justify-center rounded-full text-lg font-bold tracking-tight text-white shadow-[0_16px_40px_-10px_rgba(232,138,118,0.5),_0_6px_16px_-6px_rgba(126,196,196,0.4)] transition-all hover:-translate-y-px hover:shadow-[0_20px_46px_-10px_rgba(232,138,118,0.55),_0_8px_20px_-6px_rgba(126,196,196,0.45)] active:translate-y-0 active:opacity-95"
          >
            Create account
          </button>

          {/* Standard cover — the real, recorded acceptance happens at
              /onboarding after signup. EULA linked separately because
              Apple App Store Review Guidelines § 3.2.1(vii) require an
              EULA-specific URL. */}
          <p className="mt-3 text-center text-xs leading-relaxed text-warm-400">
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="font-semibold text-warm-300 underline-offset-2 transition-colors hover:text-coral-strong hover:underline"
            >
              Terms
            </Link>
            ,{" "}
            <Link
              href="/eula"
              className="font-semibold text-warm-300 underline-offset-2 transition-colors hover:text-coral-strong hover:underline"
            >
              EULA
            </Link>
            ,{" "}
            <Link
              href="/privacy"
              className="font-semibold text-warm-300 underline-offset-2 transition-colors hover:text-coral-strong hover:underline"
            >
              Privacy Policy
            </Link>
            , and{" "}
            <Link
              href="/guidelines"
              className="font-semibold text-warm-300 underline-offset-2 transition-colors hover:text-coral-strong hover:underline"
            >
              Community Guidelines
            </Link>
            .
          </p>
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
