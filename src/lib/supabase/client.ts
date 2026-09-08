import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        // Passkeys (2026-09-08): sign in with Face ID / fingerprint, no
        // password. Experimental in supabase-js 2.116 — explicit opt-in.
        experimental: { passkey: true },
      },
    },
  );
}
