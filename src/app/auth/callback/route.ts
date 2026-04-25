import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth?error=Missing%20code", url.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Recovery flow: go straight to the password reset form.
  if (next === "/auth/reset-password") {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // Signup confirmation flow: drop on the welcome page first, then onboarding.
  const dest = next ?? "/onboarding";
  const confirmed = new URL("/auth/confirmed", url.origin);
  confirmed.searchParams.set("next", dest);
  return NextResponse.redirect(confirmed);
}
