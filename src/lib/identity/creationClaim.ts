import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The serializer every creation door passes through.
 *
 * Quota and credit gates are reads; the insert is seconds-to-minutes
 * later (synthesis, portraits). Two parallel requests both pass the
 * read and both insert — one payment, two products (self-audit
 * 2026-08-25). No unique index can express "rows <= quota + credits",
 * so serialization is the honest fix: exactly ONE creation in flight
 * per user, claimed with a conditional UPDATE that exactly one
 * concurrent caller wins.
 *
 * The claim expires on its own after 3 minutes — a crashed request
 * costs the user a short wait, never a lockout. Release is
 * best-effort; expiry is the guarantee.
 */
const CLAIM_MINUTES = 3;

export async function claimCreationSlot(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const until = new Date(Date.now() + CLAIM_MINUTES * 60_000).toISOString();
    const { data, error } = await admin
      .from("profiles")
      .update({ creating_until: until })
      .eq("id", userId)
      .or(`creating_until.is.null,creating_until.lt.${new Date().toISOString()}`)
      .select("id");
    if (error) {
      console.error("[creationClaim] claim failed open:", error);
      // Fail OPEN: a broken claim column must never block paying
      // users from creating. The gates behind it still run; we only
      // lose the anti-parallel serialization for this request.
      return true;
    }
    return (data?.length ?? 0) > 0;
  } catch (err) {
    console.error("[creationClaim] claim threw (failing open):", err);
    return true;
  }
}

export async function releaseCreationSlot(userId: string): Promise<void> {
  try {
    await createAdminClient()
      .from("profiles")
      .update({ creating_until: null })
      .eq("id", userId);
  } catch {
    /* expiry covers it */
  }
}
