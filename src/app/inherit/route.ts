import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  NEXT_COOKIE,
  NEXT_COOKIE_MAX_AGE,
  cleanInheritCode,
} from "@/lib/auth/nextPath";
import {
  APP_LINK_INTERSTITIAL,
  appLinkPage,
  isPhoneUserAgent,
} from "@/lib/auth/appLinks";

/**
 * /inherit?code=chapter-… — the link inside a shared inherit code
 * (lib/legacy/shareMessage.ts). Public on purpose: the (gated) layout
 * can't see the URL it bounced from, so a gated link loses the code the
 * moment a signed-out recipient taps it.
 *
 *   signed in  → /identity/inherit?code=…  (the box arrives filled)
 *   signed out → /auth/signin?next=…  + the same destination in a
 *                cookie, consumed by sign-in (returning users) or by
 *                onboarding (brand-new users, after the confirmation
 *                email round-trip).
 *
 * No code → plain redeem page, same two branches.
 */
export async function GET(request: NextRequest) {
  const code = cleanInheritCode(request.nextUrl.searchParams.get("code"));
  const target = code ? `/identity/inherit?code=${code}` : "/identity/inherit";

  // On a phone, offer the app first (see lib/auth/appLinks.ts). `web=1`
  // is the "Continue on the web" link and the Android fallback — it
  // skips this and runs the normal branches below.
  const platform = isPhoneUserAgent(request.headers.get("user-agent"));
  if (
    APP_LINK_INTERSTITIAL &&
    platform &&
    request.nextUrl.searchParams.get("web") !== "1"
  ) {
    // Absolute on purpose: Chrome's intent:// browser_fallback_url must
    // be a full URL, and the public origin is what the phone tapped.
    const webFallback = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://chapter3five.app");
    webFallback.searchParams.set("web", "1");
    return new Response(
      appLinkPage({ platform, code, webFallback: webFallback.toString() }),
      { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(new URL(target, request.url));
  }

  const res = NextResponse.redirect(
    new URL(`/auth/signin?next=${encodeURIComponent(target)}`, request.url),
  );
  res.cookies.set(NEXT_COOKIE, encodeURIComponent(target), {
    maxAge: NEXT_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Readable by the sign-in page's client code on purpose.
    httpOnly: false,
  });
  return res;
}
