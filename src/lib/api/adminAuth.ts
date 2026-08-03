import { NextResponse } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { isAdmin } from "@/lib/admin/allowlist";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Admin-gate for Bearer-authed API routes the mobile app calls.
 *
 * Same posture as the web /admin layout + edge proxy: signed-in +
 * email on the allowlist. Returns either { admin, user } for the
 * caller to proceed, or a NextResponse to return immediately.
 *
 * `admin` is the service-role Supabase client — admin routes span
 * all users and RLS would hide most of the data they need to
 * aggregate. Cookie sessions on web hit the same admin client via
 * createAdminClient() directly; this helper centralizes the same
 * pattern for the mobile Bearer path so no admin route has to
 * hand-roll the auth check.
 *
 * The 404 for signed-in-non-admins mirrors the web layout: the
 * path never reveals it exists to a non-admin.
 */
export type AdminAuthResult =
  | {
      ok: true;
      admin: SupabaseClient;
      user: User;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireAdminApi(
  request: Request,
): Promise<AdminAuthResult> {
  const { user } = await getRequestAuth(request);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not signed in" },
        { status: 401 },
      ),
    };
  }
  if (!isAdmin(user.email)) {
    // Match the web /admin layout's notFound() posture — the path
    // never reveals it exists to a non-admin.
    return {
      ok: false,
      response: NextResponse.json({ error: "Not found" }, { status: 404 }),
    };
  }
  return {
    ok: true,
    admin: createAdminClient(),
    user,
  };
}
