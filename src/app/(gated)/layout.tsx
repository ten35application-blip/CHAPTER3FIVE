import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasAcceptedCurrentTerms } from "@/lib/legal/version";

/**
 * (gated) — every authed surface (dashboard, settings, identity, and
 * anything added to this group later) requires BOTH a signed-in user
 * AND acceptance of the current Terms/Privacy/Guidelines bundle.
 *
 * Users who haven't accepted the current version are sent to
 * /onboarding, which is the only place acceptance is recorded. The
 * legal pages themselves, /auth/*, and the landing page live OUTSIDE
 * this group so people can actually read the documents (and sign out)
 * before agreeing.
 *
 * Route group parens don't change URLs — /dashboard is still
 * /dashboard.
 */
export default async function GatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  // The on_auth_user_created trigger (0001) creates the profile row at
  // signup, but be defensive: if it's somehow missing, create it now so
  // the user lands on /onboarding instead of erroring.
  const { data: profile } = await supabase
    .from("profiles")
    .select("terms_version_accepted")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").insert({ id: user.id });
    redirect("/onboarding");
  }

  if (!hasAcceptedCurrentTerms(profile)) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}
