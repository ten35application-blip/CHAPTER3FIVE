import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";
import { notifyAdminsOfIdentityReport } from "@/lib/safety/identity-report-notify";
import { getRequestAuth } from "@/lib/api/mobileAuth";
import { requireTermsAccepted } from "@/lib/legal/gate";

/**
 * User reports an ENTIRE identity (drifted persona, off-brand
 * face-generation, general concern about the persona itself as
 * opposed to a specific message). Lands in the moderation queue at
 * /admin/reports alongside per-message reports.
 *
 * Sibling to /api/reports (per-message) — same auth, same gate, same
 * reason enum, same email fan-out shape, same error mapping. The
 * only differences are the target column (oracle_id, not message_id)
 * and the destination table (oracle_reports, not message_reports).
 *
 * RLS on public.oracle_reports (0123) requires the reporter to
 * either OWN the oracle or have exchanged at least one message with
 * it — same "you interact with it" test the per-message policy
 * enforces indirectly through the messages join.
 */
const REASONS = new Set([
  "inappropriate",
  "harmful",
  "off_character",
  "spam",
  "other",
]);

export async function POST(request: NextRequest) {
  let payload: { oracle_id?: string; reason?: string; notes?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const oracleId = String(payload.oracle_id ?? "").trim();
  const reason = String(payload.reason ?? "").trim();
  const notes = payload.notes
    ? String(payload.notes).trim().slice(0, 2000) || null
    : null;

  if (!oracleId) {
    return NextResponse.json({ error: "Missing oracle_id" }, { status: 400 });
  }
  if (!REASONS.has(reason)) {
    return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
  }

  const { supabase, user } = await getRequestAuth(request);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const legal = await requireTermsAccepted(supabase, user.id);
  if (!legal.ok) return legal.response;

  const { data: inserted, error } = await supabase
    .from("oracle_reports")
    .insert({
      oracle_id: oracleId,
      reporter_user_id: user.id,
      reason,
      notes,
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    // RLS: reporter must own the oracle OR have exchanged a message
    // with it. Rejected inserts surface as 42501 — clean 403.
    if (error.code === "42501") {
      return NextResponse.json({ error: "not_your_oracle" }, { status: 403 });
    }
    // 0123 partial-unique dedupe: one PENDING report per (oracle,
    // reporter). Duplicate submissions surface as 23505 — 409 so
    // the client can render "already reported" instead of firing
    // a second admin email.
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_reported" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (inserted?.id) {
    after(async () => {
      await notifyAdminsOfIdentityReport({
        reportId: inserted.id,
        oracleId,
        reporterUserId: user.id,
        reason,
        notes,
      });
    });
  }

  return NextResponse.json({ ok: true });
}
