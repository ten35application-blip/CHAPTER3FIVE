import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export const runtime = "nodejs";

/**
 * Email confirmation on OUR domain.
 *
 * Supabase's default confirmation link points at the project's raw
 * host (nljxcyssbcmhwjuyxley.supabase.co). In an email asking a
 * grieving person to trust a brand-new app, a random-looking hostname
 * reads as phishing — Wilson 2026-08-16, from the confirmation email
 * on his own phone. The email template now sends {{ .TokenHash }} to
 * this route instead, so every link in every auth email is
 * chapter3five.app, and Supabase is never named in front of a user.
 *
 * verifyOtp does exactly what the old link did — burns the one-time
 * token and establishes the session — except the cookies land on our
 * domain, so confirming on a laptop also signs you in.
 *
 * Recovery links land on /auth/update-password (the session created
 * here is what authorizes the password change). Everything else lands
 * on the signin page's verified banner, which offers the app deep link
 * for people who registered on mobile.
 *
 * The legacy Supabase-hosted links keep working: they never touch this
 * route, so links already sitting in inboxes are unaffected.
 */

const VALID_TYPES = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const typeRaw = url.searchParams.get("type") ?? "";
  const type = VALID_TYPES.has(typeRaw as EmailOtpType)
    ? (typeRaw as EmailOtpType)
    : null;

  // COOKIE JAR, not the next/headers store (2026-08-21). verifyOtp
  // below establishes the session by SETTING auth cookies — and the
  // shared server client writes them into Next's cookie store, which
  // a freshly-constructed NextResponse.redirect() does not carry. So
  // the token burned, the session existed server-side, and the browser
  // arrived at /auth/update-password with nothing: "This link isn't
  // active", within a minute of the email being sent, every time
  // (Wilson, resetting his own password). Collect what the client
  // wants to set, then paste it onto the exact response we return.
  const jar: { name: string; value: string; options: CookieOptions }[] = [];
  const withCookies = (res: NextResponse) => {
    for (const c of jar) res.cookies.set(c.name, c.value, c.options);
    return res;
  };

  const fail = (reason: string) =>
    withCookies(
      NextResponse.redirect(
        new URL(
          `/auth/signin?error=${encodeURIComponent(reason)}`,
          request.url,
        ),
      ),
    );

  if (!tokenHash || !type) {
    return fail("That link is incomplete. Request a new one below.");
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          jar.push(...cookiesToSet);
        },
      },
    },
  );
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    // Expired or already used — both land here. Say so plainly instead
    // of leaking the provider's wording.
    return fail(
      "That link has expired or was already used. Sign in below, or sign up again to get a fresh one.",
    );
  }

  if (type === "recovery") {
    return withCookies(
      NextResponse.redirect(new URL("/auth/update-password", request.url)),
    );
  }

  // Carry the address forward so the sign-in form arrives already
  // filled in and all they have to type is a password — the way
  // Instagram and X hand you back after verifying (Wilson 2026-08-16).
  // It's the address they just proved they own, so echoing it to
  // themselves reveals nothing they didn't type minutes ago.
  const verifiedEmail = data?.user?.email ?? null;
  const next = verifiedEmail
    ? `/auth/signin?confirmed=1&email=${encodeURIComponent(verifiedEmail)}`
    : "/auth/signin?confirmed=1";
  return withCookies(NextResponse.redirect(new URL(next, request.url)));
}
