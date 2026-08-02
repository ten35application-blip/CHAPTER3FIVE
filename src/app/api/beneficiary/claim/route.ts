import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Bearer-authed twin of the web claimBeneficiary server action
 * (`src/app/legacy/[token]/actions.ts`). Idempotent claim of a
 * designated / activated beneficiary invitation:
 *   - stamps beneficiaries: status='claimed', claimed_at, claimed_user_id
 *   - upserts archive_grants for every is_legacy oracle the owner built
 *   - returns { ok } on success
 *
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  const { user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request
    .json()
    .catch(() => ({}) as { token?: unknown });
  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json(
      { error: "That link doesn't open anything." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Atomic status flip: only proceed when the row is still claimable.
  // If two beneficiaries click at once (rare) the second gets a
  // "no longer valid" from the empty update result.
  const { data: claimed } = await admin
    .from("beneficiaries")
    .update({
      status: "claimed",
      claimed_at: new Date().toISOString(),
      claimed_user_id: user.id,
    })
    .eq("claim_token", token)
    .in("status", ["activated", "designated"])
    .select("id, owner_user_id")
    .maybeSingle<{ id: string; owner_user_id: string }>();

  if (!claimed) {
    return NextResponse.json(
      { error: "This link is no longer valid or was already claimed." },
      { status: 409 },
    );
  }

  // Grant access to every is_legacy oracle the owner built.
  const { data: oracles } = await admin
    .from("oracles")
    .select("id")
    .eq("user_id", claimed.owner_user_id)
    .eq("is_legacy", true)
    .is("deleted_at", null);

  if (oracles?.length) {
    const rows = oracles.map((o) => ({
      oracle_id: o.id,
      user_id: user.id,
      granted_by: claimed.owner_user_id,
    }));
    await admin
      .from("archive_grants")
      .upsert(rows, { onConflict: "oracle_id,user_id" });
    // A grant-upsert failure isn't fatal — the beneficiary row is
    // already claimed; ops can reconcile manually if this ever hits.
  }

  return NextResponse.json({ ok: true });
}
