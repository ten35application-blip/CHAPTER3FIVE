"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin/allowlist";

/**
 * Resolve a message report — either "reviewed" (report was
 * legitimate, action taken elsewhere) or "dismissed" (report was
 * spurious / not actionable). Both close the row; the admin queue
 * only shows `status = 'pending'`.
 *
 * Admin-only via the allowlist. Uses service role because
 * message_reports has no user UPDATE policy (by design — reports
 * are user-immutable once submitted).
 */
export async function resolveReport(
  reportId: string,
  outcome: "reviewed" | "dismissed",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return { ok: false, error: "not_admin" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("message_reports")
    .update({
      status: outcome,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}

/**
 * Sibling to resolveReport — closes an identity-level report row in
 * public.oracle_reports (0123). Same admin allowlist check, same
 * service-role update pattern.
 */
export async function resolveOracleReport(
  reportId: string,
  outcome: "reviewed" | "dismissed",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return { ok: false, error: "not_admin" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("oracle_reports")
    .update({
      status: outcome,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/reports");
  return { ok: true };
}
