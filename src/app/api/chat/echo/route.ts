import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { requireTermsAccepted } from "@/lib/legal/gate";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * POST /api/chat/echo — Me-identity echo-back.
 *
 * Wilson's Phase-2 lock:
 *   "You cannot talk to yourself — anything you said will repeat back
 *    to you, like iOS and Android do now."
 *
 * The Me identity is the user's self-archive (oracles.is_self_archive
 * = true, stamped by /api/legacy/complete when subject.mode === 'self').
 * Its "conversation" is a mirror: every user turn is followed by an
 * assistant turn with the identical content, delivered in the same
 * transaction. No Anthropic call. No tokens spent. No cap counting.
 *
 * Server-side implementation (not client-side) because the
 * `messages: users insert their own` RLS policy (0108) hard-blocks
 * `role = 'assistant'` INSERTs from the authenticated client. Even if
 * the trigger / grant layers allowed it, keeping this on the server
 * gives us one source of truth: the same row shape (user + assistant
 * with matching created_at) that the rest of the pipeline expects, and
 * an audit log if the echo ever needs to change shape (mark, split,
 * etc). Wilson's note: "server-side is more idempotent + auditable" —
 * this is that trade-off in action.
 *
 * Ownership: the caller must own the oracle AND the oracle must be
 * marked is_self_archive=true. A non-Me identity POSTing here 404s so
 * the endpoint never accidentally becomes a bypass for the paid
 * /api/chat pipeline.
 *
 * Returns: { user: {id, created_at}, echo: {id, created_at} } so the
 * client can swap its optimistic bubbles for the real rows without a
 * separate re-fetch.
 */
export async function POST(request: NextRequest) {
  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  let body: {
    oracle_id?: unknown;
    message?: unknown;
    image_url?: unknown;
    image_storage_path?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const oracleId = typeof body.oracle_id === "string" ? body.oracle_id : null;
  const message = typeof body.message === "string" ? body.message : "";
  const imageUrl =
    typeof body.image_url === "string" && body.image_url.length > 0
      ? body.image_url
      : null;
  const imageStoragePath =
    typeof body.image_storage_path === "string" &&
    body.image_storage_path.length > 0
      ? body.image_storage_path
      : null;

  if (!oracleId) {
    return NextResponse.json({ error: "oracle_id is required" }, { status: 400 });
  }
  // A message OR an image (or both). Never neither — same rule as the
  // main /api/chat path.
  if (!message.trim() && !imageUrl && !imageStoragePath) {
    return NextResponse.json(
      { error: "Message can't be empty." },
      { status: 400 },
    );
  }

  // Ownership + Me-only gate. Read via the user client so RLS + the
  // per-column allowlist (0070 + 0127) both apply — a stray fetch of
  // someone else's row would come back empty here even before the
  // explicit ownership check.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, user_id, is_self_archive")
    .eq("id", oracleId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!oracle || oracle.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!oracle.is_self_archive) {
    // Non-Me identities MUST go through /api/chat so caps, tokens,
    // safety filters, and the persona pipeline all apply.
    return NextResponse.json(
      { error: "This identity is not a Me archive." },
      { status: 400 },
    );
  }

  // Two inserts, same content, in sequence. The user row first so the
  // assistant row can carry a matching created_at (both default now(),
  // which is stable within a single statement but not guaranteed across
  // statements — we don't rely on it matching exactly; the client sorts
  // by created_at with user-before-assistant tiebreak).
  //
  // Service-role client because assistant-role INSERT is blocked for
  // authenticated callers by RLS (0108).
  const admin = createAdminClient();

  const userInsert = await admin
    .from("messages")
    .insert({
      user_id: user.id,
      oracle_id: oracleId,
      role: "user",
      content: message,
      image_url: imageUrl,
      image_storage_path: imageStoragePath,
    })
    .select("id, created_at")
    .single();
  if (userInsert.error || !userInsert.data) {
    console.error("[api/chat/echo] user insert failed:", userInsert.error);
    return NextResponse.json({ error: "Couldn't send" }, { status: 500 });
  }

  const echoInsert = await admin
    .from("messages")
    .insert({
      user_id: user.id,
      oracle_id: oracleId,
      role: "assistant",
      content: message,
      image_url: imageUrl,
      image_storage_path: imageStoragePath,
    })
    .select("id, created_at")
    .single();
  if (echoInsert.error || !echoInsert.data) {
    console.error("[api/chat/echo] echo insert failed:", echoInsert.error);
    // Partial write is acceptable — the user turn is durable; a repeat
    // send just adds another echo. Return success on the user side so
    // the client bubble stops spinning; the missing echo will surface
    // on the next natural refresh as absent (soft failure).
    return NextResponse.json(
      {
        user: userInsert.data,
        echo: null,
      },
      { status: 200 },
    );
  }

  return NextResponse.json({
    user: userInsert.data,
    echo: echoInsert.data,
  });
}
