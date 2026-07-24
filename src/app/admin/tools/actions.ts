"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_EMAILS } from "@/lib/admin/allowlist";
import { fingerprintTraits } from "@/lib/identity/fingerprint";
import { rollTraits } from "@/lib/identity/formula";
import { synthesizePersona } from "@/lib/identity/synthesize";

const IDENTITIES_PER_ADMIN = 3;
const MAX_FINGERPRINT_REROLLS = 5;

/**
 * Hard-delete every oracle in the database. Also cascades to messages,
 * inherit_codes, and oracle_shares via the FK on oracles. Use only from
 * the admin tools page — guarded by requireAdmin().
 *
 * Returns a small result object so the client can render "deleted N rows".
 */
export async function deleteAllIdentities(): Promise<{
  ok: boolean;
  deleted?: number;
  error?: string;
}> {
  await requireAdmin();
  const admin = createAdminClient();

  // Count first so we can report accurately even on cascade.
  const { count: before } = await admin
    .from("oracles")
    .select("id", { count: "exact", head: true });

  // Deleting by a tautological predicate — Supabase REST refuses
  // unqualified DELETEs, so pass a filter that matches every row.
  const { error } = await admin.from("oracles").delete().neq("id", "");

  if (error) {
    return { ok: false, error: `${error.code ?? ""} ${error.message}` };
  }

  revalidatePath("/dashboard");
  revalidatePath("/trash");
  revalidatePath("/admin");
  return { ok: true, deleted: before ?? 0 };
}

/**
 * Seed 3 formula-generated identities for each admin account that has
 * signed up. Skips admins whose account doesn't exist yet — reports
 * them in the result so Wilson can prompt them to sign up.
 *
 * Runs the exact same pipeline as /identity/new:
 *   rollTraits -> fingerprintTraits -> synthesizePersona (Claude) -> insert
 * so this doubles as a smoke test of the whole formula flow.
 *
 * Sequential (not parallel) so a mid-way failure leaves a partial but
 * consistent state instead of racing Anthropic rate limits.
 */
export async function seedAdminIdentities(): Promise<{
  ok: boolean;
  created: { email: string; count: number; names: string[] }[];
  skipped: { email: string; reason: string }[];
  errors: { email: string; error: string }[];
}> {
  await requireAdmin();
  const admin = createAdminClient();

  // Resolve admin emails -> user_ids. auth.admin.listUsers is paginated;
  // we only ever have a few admins, so one page is enough.
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    return {
      ok: false,
      created: [],
      skipped: [],
      errors: [{ email: "*", error: listErr.message }],
    };
  }
  const usersByEmail = new Map(
    usersPage.users.map((u) => [
      (u.email ?? "").toLowerCase(),
      u,
    ]),
  );

  const created: { email: string; count: number; names: string[] }[] = [];
  const skipped: { email: string; reason: string }[] = [];
  const errors: { email: string; error: string }[] = [];

  for (const adminEmail of ADMIN_EMAILS) {
    const user = usersByEmail.get(adminEmail.toLowerCase());
    if (!user) {
      skipped.push({
        email: adminEmail,
        reason: "No signed-up account for this email yet.",
      });
      continue;
    }

    const names: string[] = [];
    let seededForThisAdmin = 0;
    for (let i = 0; i < IDENTITIES_PER_ADMIN; i++) {
      try {
        const inserted = await createOneIdentityForUser(admin, user.id);
        names.push(inserted.name);
        seededForThisAdmin++;
      } catch (err) {
        errors.push({
          email: adminEmail,
          error: err instanceof Error ? err.message : String(err),
        });
        // Continue with next admin — don't abort the whole seed.
        break;
      }
    }
    if (seededForThisAdmin > 0) {
      created.push({ email: adminEmail, count: seededForThisAdmin, names });
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");

  return {
    ok: errors.length === 0,
    created,
    skipped,
    errors,
  };
}

/**
 * Roll -> fingerprint (dedup) -> synthesize -> insert for one user.
 * Mirrors the /identity/new pipeline but uses the service-role client
 * so we can insert on behalf of another account.
 */
async function createOneIdentityForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<{ id: string; name: string }> {
  let traits = null;
  let fingerprint = null;

  for (let attempt = 0; attempt < MAX_FINGERPRINT_REROLLS; attempt++) {
    const candidate = rollTraits();
    const candidateFingerprint = fingerprintTraits(candidate);
    const { data: existing } = await admin
      .from("oracles")
      .select("id")
      .eq("fingerprint", candidateFingerprint)
      .maybeSingle();
    if (!existing) {
      traits = candidate;
      fingerprint = candidateFingerprint;
      break;
    }
  }

  if (!traits || !fingerprint) {
    throw new Error("Couldn't roll a unique fingerprint after 5 tries");
  }

  const persona = await synthesizePersona(traits);

  const { data: inserted, error } = await admin
    .from("oracles")
    .insert({
      user_id: userId,
      traits,
      fingerprint,
      name: persona.name,
      one_line_hook: persona.one_line_hook,
      persona_prompt: persona.persona_prompt,
    })
    .select("id, name")
    .single();

  if (error || !inserted) {
    throw new Error(error?.message ?? "Insert returned no row");
  }

  return { id: inserted.id, name: inserted.name };
}
