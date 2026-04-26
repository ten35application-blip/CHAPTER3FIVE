import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS. Only use server-side, in
 * admin-gated routes or scheduled jobs. Never import this from client code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
