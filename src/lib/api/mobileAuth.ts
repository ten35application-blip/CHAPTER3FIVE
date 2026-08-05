import { createClient as createPlainClient } from "@supabase/supabase-js";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Dual-mode auth for API routes the mobile app calls.
 *
 * Supports both cookie-based auth (web) and Bearer-token auth
 * (mobile/Expo) — the exact pattern /api/chat/route.ts established.
 * Returns a Supabase client scoped to the caller (RLS applies) plus
 * the resolved user, or user: null when the request is anonymous.
 *
 * The Bearer branch builds a plain supabase-js client carrying the
 * token as the Authorization header so every PostgREST query runs
 * as that user under RLS — identical posture to the cookie client.
 */
export async function getRequestAuth(
  request: Request,
  opts?: {
    /**
     * Let a soft-deleted account through. ONLY for the routes the web
     * proxy's SOFT_DELETED_ALLOWED list also exempts: data export
     * (portability during the 30-day grace) and delete-account itself
     * (idempotent no-op on a second call).
     */
    allowSoftDeleted?: boolean;
  },
): Promise<{
  supabase: SupabaseClient;
  user: User | null;
}> {
  const authHeader = request.headers.get("authorization");
  const bearer =
    authHeader && authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

  const supabase = bearer
    ? createPlainClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { global: { headers: { Authorization: `Bearer ${bearer}` } } },
      )
    : await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser(bearer ?? undefined);

  // Soft-deleted gate. The web proxy redirects deleted users to
  // /restore, but it reads COOKIES — a Bearer token sailed straight
  // past it, so a user who deleted their account kept full API access
  // from the phone for the whole 30-day grace window: chatting,
  // burning Anthropic spend, receiving pushes. The only mobile-side
  // gates were client reads that sign the user out, which the
  // lock-screen-reply path never hits at all.
  //
  // Checked here so every route on the shared helper is covered at
  // once. Returns user: null — every caller already 401s on that, and
  // the mobile client treats a 401 as signed-out, which is the right
  // UX for an account the user themselves ended.
  //
  // Fail-open on a read error: a transient profiles hiccup must not
  // 401 every API call for everyone. The purge cron is the backstop
  // that actually erases; this gate is about access during grace.
  if (user && !opts?.allowSoftDeleted) {
    const { data: p } = await supabase
      .from("profiles")
      .select("deleted_at")
      .eq("id", user.id)
      .maybeSingle<{ deleted_at: string | null }>();
    if (p?.deleted_at) {
      return { supabase, user: null };
    }
  }

  return { supabase, user };
}
