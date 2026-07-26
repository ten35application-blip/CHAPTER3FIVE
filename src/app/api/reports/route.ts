import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * User reports a message from their own thread. Lands in the moderation
 * queue at /admin/reports. App Store 1.2 (UGC moderation) requires this
 * surface be present and functional.
 *
 * RLS on message_reports (0077) already enforces that reporter_user_id
 * matches auth.uid() AND that the reported message belongs to the
 * reporter's thread, so a malicious client can't report someone else's
 * conversations. We do a light client-side sanity check here so users
 * get a clean 400 instead of a raw RLS 403.
 */
const REASONS = new Set([
  "inappropriate",
  "harmful",
  "off_character",
  "spam",
  "other",
]);

export async function POST(request: NextRequest) {
  let payload: { message_id?: string; reason?: string; notes?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const messageId = String(payload.message_id ?? "").trim();
  const reason = String(payload.reason ?? "").trim();
  const notes = payload.notes
    ? String(payload.notes).trim().slice(0, 2000) || null
    : null;

  if (!messageId) {
    return NextResponse.json({ error: "Missing message_id" }, { status: 400 });
  }
  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { error } = await supabase.from("message_reports").insert({
    message_id: messageId,
    reporter_user_id: user.id,
    reason,
    notes,
  });

  if (error) {
    // RLS violation reads as 42501 — surface a clean 403 so the client
    // can distinguish "you can't report that message" from a real 500.
    if (error.code === "42501") {
      return NextResponse.json({ error: "not_your_message" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
