import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Mobile parity for the web dashboard actions
 * purgeConversation + permanentDeleteIdentity. Terminal — rows are
 * gone.
 *
 * body: { oracle_id: string, kind: "conversation" | "identity" }
 *
 * "conversation" — hard-delete every soft-deleted message the caller
 * has with this oracle. Uses the admin client because users have no
 * DELETE policy on messages (by design). The auth check + oracle
 * visibility check via the user-scoped client is the gate.
 *
 * "identity" — hard-delete a soft-deleted oracle from the caller's
 * trash. Uses the user-scoped client; RLS enforces auth.uid() =
 * user_id and the deleted_at check keeps live oracles safe.
 *
 * Accepts both cookie auth (web) and Bearer auth (mobile) via the
 * shared getRequestAuth helper. Was cookie-only 2026-07-30, which
 * 401'd every mobile Delete-forever tap — Fable audit finding.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const oracleId = typeof body.oracle_id === "string" ? body.oracle_id : null;
  const kind = body.kind === "identity" ? "identity" : body.kind === "conversation" ? "conversation" : null;
  if (!oracleId || !kind) {
    return NextResponse.json(
      { error: "oracle_id and kind (conversation|identity) required" },
      { status: 400 },
    );
  }

  if (kind === "identity") {
    const { error } = await supabase
      .from("oracles")
      .delete()
      .eq("id", oracleId)
      .eq("is_concierge", false)
      .not("deleted_at", "is", null);
    if (error) {
      return NextResponse.json(
        { error: "Couldn't permanently delete that identity." },
        { status: 500 },
      );
    }
    return new NextResponse(null, { status: 204 });
  }

  // conversation — need to first verify the caller can see this oracle
  // (RLS) before letting the admin client delete their messages under
  // it. Without this check a stolen access token could purge anyone's
  // trash.
  const { data: oracleCheck } = await supabase
    .from("oracles")
    .select("id")
    .eq("id", oracleId)
    .maybeSingle();
  if (!oracleCheck) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("messages")
    .delete()
    .eq("user_id", user.id)
    .eq("oracle_id", oracleId)
    .not("deleted_at", "is", null);
  if (error) {
    return NextResponse.json(
      { error: "Couldn't permanently delete those messages." },
      { status: 500 },
    );
  }
  return new NextResponse(null, { status: 204 });
}
