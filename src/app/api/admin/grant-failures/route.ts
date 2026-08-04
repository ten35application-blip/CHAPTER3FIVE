import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin/allowlist";

export const runtime = "nodejs";

/**
 * "Who paid us and didn't get what they paid for."
 *
 * Reads grant_failures (migration 0133). Same shape and same gate as
 * /api/admin/cron-health, and it exists for the same reason that one
 * does: something was being written — or in this case, logged — that no
 * code ever read.
 *
 * Unresolved rows first, because those are the ones that are still
 * someone's problem. `owed` is the honest headline number: how many
 * people are currently out money with nothing to show for it.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  }
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: "not_admin" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("grant_failures")
    .select(
      "id, created_at, user_id, kind, delta, purpose, error, stripe_event_id, stripe_session_id, resolved_at, resolved_by, notes",
    )
    .order("resolved_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const unresolved = rows.filter((r) => !r.resolved_at);

  return NextResponse.json({
    // The number to look at. Non-zero means go fix something by hand.
    owed: unresolved.length,
    // Broken out because the inherited_slot ones are the ones where a
    // grieving family paid and the archive stayed shut.
    owedByKind: unresolved.reduce<Record<string, number>>((acc, r) => {
      acc[r.kind] = (acc[r.kind] ?? 0) + 1;
      return acc;
    }, {}),
    rows,
  });
}
