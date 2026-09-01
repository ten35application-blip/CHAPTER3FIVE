"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/admin/queries";

/**
 * SIGNUP PROMOS (Wilson 2026-09-01) — "something we can turn on and
 * off in case in the future we want to do another gift system."
 *
 * One campaign runs at a time (enforced by a partial unique index, not
 * by hope). Turning one on gifts the NEXT N people who sign up; it
 * stops itself when the quota is gone. Accounts that already existed
 * when the promo started never qualify — see claim_signup_promo.
 */

export type PromoKind =
  | "companion"
  | "pro_month"
  | "message_pack"
  | "image_pack"
  | "inherit_credit";

export async function startPromo(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const quota = Number.parseInt(String(formData.get("quota") ?? ""), 10);
  const kind = String(formData.get("kind") ?? "companion") as PromoKind;
  const label = String(formData.get("label") ?? "").trim();

  if (!Number.isFinite(quota) || quota < 1 || quota > 10000) return;

  const supabase = createAdminClient();
  // Stop anything already running — one campaign at a time.
  await supabase
    .from("signup_promos")
    .update({ enabled: false })
    .eq("enabled", true);

  await supabase.from("signup_promos").insert({
    label: label || `${quota} free ${kind === "companion" ? "identities" : kind}`,
    kind,
    quota,
    enabled: true,
    created_by: admin.id,
  });

  revalidatePath("/admin/rewards");
}

export async function stopPromo(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await createAdminClient()
    .from("signup_promos")
    .update({ enabled: false })
    .eq("id", id);
  revalidatePath("/admin/rewards");
}
