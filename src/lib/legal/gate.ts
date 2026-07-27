import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { CURRENT_TERMS_VERSION } from "./version";

/**
 * Legal-acceptance gate for API routes.
 *
 * The web (gated)/layout redirects users to /onboarding if they
 * haven't accepted the current terms bundle, but API routes have
 * no equivalent — a mobile client with a valid Bearer token could
 * post to /api/chat without ever passing the acceptance flow.
 *
 * This helper checks profiles.terms_version_accepted against
 * CURRENT_TERMS_VERSION and returns a 428 (Precondition Required)
 * with a machine-readable code when the record is stale or missing.
 * Mobile clients can catch the code and route the user to the
 * in-app equivalent of /onboarding before retrying.
 *
 * Usage in an API route:
 *
 *   const supabase = await createClient();
 *   const {data: {user}} = await supabase.auth.getUser();
 *   if (!user) return NextResponse.json({error:"Not signed in"}, {status:401});
 *   const gate = await requireTermsAccepted(supabase, user.id);
 *   if (!gate.ok) return gate.response;
 *   // ...proceed
 *
 * Never throws — a failed profile read counts as "not accepted"
 * (fail-closed for legal gating).
 */
export async function requireTermsAccepted(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse }
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("terms_version_accepted")
    .eq("id", userId)
    .maybeSingle<{ terms_version_accepted: string | null }>();

  if (error || !data || data.terms_version_accepted !== CURRENT_TERMS_VERSION) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "terms_not_accepted",
          required_version: CURRENT_TERMS_VERSION,
          accept_url: "/onboarding",
        },
        { status: 428 },
      ),
    };
  }
  return { ok: true };
}
