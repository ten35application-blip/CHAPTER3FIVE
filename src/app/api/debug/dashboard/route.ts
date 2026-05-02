import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Diagnostic-only endpoint. Runs each query the dashboard makes,
 * isolated, and reports which one (if any) errors. Returns JSON.
 *
 * Visit /api/debug/dashboard while signed in. Paste the response
 * to find which call is throwing in production.
 *
 * SAFE: no writes, no secrets in output, owner-only.
 */
export async function GET() {
  const out: Record<string, { ok: boolean; error?: string; sample?: unknown }> =
    {};

  try {
    const supabase = await createClient();

    // Auth
    const userRes = await supabase.auth.getUser();
    out.auth = {
      ok: !userRes.error && !!userRes.data.user,
      error: userRes.error?.message,
      sample: userRes.data.user?.id?.slice(0, 8),
    };
    if (!userRes.data.user) {
      return NextResponse.json(out);
    }
    const userId = userRes.data.user.id;
    const admin = createAdminClient();

    // 1. profile (main columns the dashboard reads)
    const p1 = await supabase
      .from("profiles")
      .select(
        "preferred_language, onboarding_completed, favorites, last_read",
      )
      .eq("id", userId)
      .single();
    out.profile_main = {
      ok: !p1.error,
      error: p1.error?.message,
      sample: p1.data ? Object.keys(p1.data) : null,
    };

    // 2. profile.muted_conversations (separate read because column may be missing)
    const p2 = await supabase
      .from("profiles")
      .select("muted_conversations")
      .eq("id", userId)
      .maybeSingle();
    out.profile_muted = {
      ok: !p2.error,
      error: p2.error?.message,
    };

    // 3. owned oracles
    const o = await supabase
      .from("oracles")
      .select("id, name, avatar_url, mode, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null);
    out.oracles = {
      ok: !o.error,
      error: o.error?.message,
      sample: o.data?.length,
    };

    // 4. archive_grants (shared archives)
    const g = await supabase
      .from("archive_grants")
      .select("oracle_id")
      .eq("user_id", userId);
    out.archive_grants = {
      ok: !g.error,
      error: g.error?.message,
      sample: g.data?.length,
    };

    // 5. group_rooms
    const gr = await supabase
      .from("group_rooms")
      .select("id, name, last_message_at, created_at")
      .eq("owner_user_id", userId);
    out.group_rooms = {
      ok: !gr.error,
      error: gr.error?.message,
      sample: gr.data?.length,
    };

    // 6. group_room_members (with oracles join)
    const grm = await admin
      .from("group_room_members")
      .select("room_id, oracle_id, oracles(avatar_url)")
      .limit(1);
    out.group_room_members = {
      ok: !grm.error,
      error: grm.error?.message,
    };

    // 7. beneficiary_room_members
    const brm = await admin
      .from("beneficiary_room_members")
      .select("room_id")
      .eq("user_id", userId)
      .is("left_at", null);
    out.beneficiary_room_members = {
      ok: !brm.error,
      error: brm.error?.message,
      sample: brm.data?.length,
    };

    // 8. beneficiary_rooms
    const br = await admin
      .from("beneficiary_rooms")
      .select("id, name, oracle_id, last_message_at, created_at")
      .limit(1);
    out.beneficiary_rooms = {
      ok: !br.error,
      error: br.error?.message,
    };

    // 9. messages (any per oracle)
    const m = await admin
      .from("messages")
      .select("oracle_id, content, role, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    out.messages = {
      ok: !m.error,
      error: m.error?.message,
      sample: m.data?.length,
    };

    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      {
        ...out,
        thrown: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack?.slice(0, 1000) : undefined,
      },
      { status: 500 },
    );
  }
}
