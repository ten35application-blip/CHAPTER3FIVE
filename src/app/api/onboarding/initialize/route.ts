import { NextResponse, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Mobile onboarding initializer. Creates the caller's first oracle
 * (the one they'll answer the forty questions into, OR the one the
 * randomize path fills with random answers) and stamps
 * profiles.active_oracle_id so the downstream endpoints
 * (/api/onboarding/randomize, /api/onboarding/memory, the mobile
 * questions flow) can find it.
 *
 * WHY THIS EXISTS. Migration 0103 removed the "untitled" placeholder
 * oracle handle_new_user used to create at signup -- it was showing
 * up as a locked Pro row in the web dashboard for every fresh user
 * (see the commit for the mission-alignment reasoning). The mobile
 * app's onboarding flow was silently depending on that placeholder:
 * randomize.tsx 400s "No active identity" and welcome.tsx <->
 * questions.tsx infinite-redirects when active_oracle_id is null.
 *
 * This endpoint restores the initialization but under mobile's control
 * -- the web dashboard is unaffected (no placeholder rendered), because
 * this only fires when the mobile welcome.tsx explicitly calls it
 * after collecting name/mode/language from the user.
 *
 * Idempotent: if active_oracle_id is already set, no-op success.
 * Bearer-authed like the sibling /api/onboarding/randomize.
 */
export async function POST(request: NextRequest) {
  // Cookie OR Bearer, same pattern as /api/onboarding/randomize.
  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const auth = request.headers.get("authorization") ?? "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) {
      const tokenClient = createPlainClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { global: { headers: { Authorization: `Bearer ${m[1]}` } } },
      );
      const r = await tokenClient.auth.getUser(m[1]);
      user = r.data.user ?? null;
    }
  }
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Read the profile fields welcome.tsx wrote seconds ago. Uses admin
  // client so we bypass RLS and always see the row post-write; the
  // user_id filter is the authorization.
  const admin = createAdminClient();
  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("oracle_name, mode, preferred_language, active_oracle_id")
    .eq("id", user.id)
    .maybeSingle<{
      oracle_name: string | null;
      mode: string | null;
      preferred_language: string | null;
      active_oracle_id: string | null;
    }>();
  if (profileErr) {
    return NextResponse.json(
      { error: `profile read failed: ${profileErr.message}` },
      { status: 500 },
    );
  }
  if (!profile) {
    return NextResponse.json({ error: "No profile" }, { status: 404 });
  }

  // Idempotent: already initialized → success no-op. Safe to call
  // welcome.tsx more than once (retries, back-navigation, etc.).
  if (profile.active_oracle_id) {
    return NextResponse.json({
      ok: true,
      oracle_id: profile.active_oracle_id,
      already: true,
    });
  }

  const name = (profile.oracle_name ?? "").trim() || "untitled";
  const rawMode = profile.mode;
  const mode =
    rawMode === "real" || rawMode === "randomize" || rawMode === "memory"
      ? rawMode
      : "real";
  const preferredLanguage =
    profile.preferred_language === "es" ? "es" : "en";

  // Insert the oracle via admin client -- protect_oracle_columns denies
  // user-role INSERTs across the board (0067 + 0084 + 0096); service
  // role is the only path in.
  const { data: inserted, error: insertErr } = await admin
    .from("oracles")
    .insert({
      user_id: user.id,
      name,
      mode,
      preferred_language: preferredLanguage,
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: `oracle insert failed: ${insertErr?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  // Stamp active_oracle_id. Field is protected by
  // protect_billing_columns (0072), so admin client is required.
  const { error: updateErr } = await admin
    .from("profiles")
    .update({ active_oracle_id: inserted.id })
    .eq("id", user.id);
  if (updateErr) {
    return NextResponse.json(
      { error: `active_oracle_id update failed: ${updateErr.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, oracle_id: inserted.id });
}
