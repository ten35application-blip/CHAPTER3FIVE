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
export async function getRequestAuth(request: Request): Promise<{
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

  return { supabase, user };
}
