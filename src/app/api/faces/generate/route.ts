import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAndSaveFace } from "@/lib/faces/generate";
import type { Traits } from "@/lib/identity/formula";

export const runtime = "nodejs";
// Generation is 15–40s + storage round-trips, and it runs in `after()`
// which shares this route's duration budget.
export const maxDuration = 120;

/**
 * POST /api/faces/generate — kick off (or retry) face generation for one
 * identity the caller owns.
 *
 * Body: { oracleId: string, force?: boolean }
 *   force retries/regenerates even when avatar_url is already set —
 *   used after a failed job. Same oracle id → same seed → same face.
 *
 * Responds 202 immediately; the actual generation continues after the
 * response via `after()`. Poll oracles.face_generation_status /
 * avatar_url for the outcome.
 *
 * This is also the fallback transport for identity creation if `after()`
 * ever leaves next/server — the primary path today calls
 * generateAndSaveFace directly from the createIdentity action.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: { oracleId?: unknown; force?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const oracleId = body.oracleId;
  if (typeof oracleId !== "string" || oracleId.length === 0) {
    return NextResponse.json({ error: "oracleId required" }, { status: 400 });
  }

  // Ownership check via service role (traits live behind RLS anyway,
  // but we verify user_id explicitly and 404 on other people's rows).
  const admin = createAdminClient();
  const { data: oracle } = await admin
    .from("oracles")
    .select("id, user_id, traits")
    .eq("id", oracleId)
    .maybeSingle();
  if (!oracle || oracle.user_id !== user.id) {
    return NextResponse.json({ error: "Not your identity" }, { status: 404 });
  }
  if (!oracle.traits) {
    return NextResponse.json(
      { error: "This identity has no trait bundle to draw from" },
      { status: 400 },
    );
  }

  const traits = oracle.traits as Traits;
  const force = body.force === true;
  after(async () => {
    await generateAndSaveFace(oracleId, traits, { force });
  });

  // 202 Accepted — generation continues after this response.
  return NextResponse.json(
    { ok: true, status: "generating" },
    { status: 202 },
  );
}
