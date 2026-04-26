import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

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
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(
    code,
  );

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Recovery flow: go straight to the password reset form.
  if (next === "/auth/reset-password") {
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // Welcome email — fire-and-forget once per user, only on signup
  // confirmation (not recovery). We piggyback on email_confirmed_at being
  // very recent to dedupe accidental duplicate sends.
  const user = sessionData?.user;
  if (user?.email && user.email_confirmed_at) {
    const confirmedRecently =
      Date.now() - new Date(user.email_confirmed_at).getTime() < 5 * 60 * 1000;
    if (confirmedRecently) {
      const admin = createAdminClient();
      const { count } = await admin
        .from("email_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("kind", "welcome");
      if ((count ?? 0) === 0) {
        sendWelcomeEmail({ to: user.email, userId: user.id }).catch((e) =>
          console.error("welcome email failed:", e),
        );
      }
    }
  }

  // Signup confirmation flow: drop on the welcome page first, then onboarding.
  const dest = next ?? "/onboarding";
  const confirmed = new URL("/auth/confirmed", url.origin);
  confirmed.searchParams.set("next", dest);
  return NextResponse.redirect(confirmed);
}
