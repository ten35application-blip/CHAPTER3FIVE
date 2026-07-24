import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";

/**
 * Server-side admin gate for pages AND server actions.
 *
 * Defense-in-depth layer 2 (layer 1 is the edge proxy in src/proxy.ts,
 * which rewrites non-admins to /404 before any page shell renders).
 *
 * - No session  → redirect to sign-in.
 * - Signed in but not on the allowlist → notFound(). A 404, not a 403,
 *   so /admin does not reveal its existence to non-admins.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }
  if (!isAdmin(user.email)) {
    notFound();
  }
  return user;
}
