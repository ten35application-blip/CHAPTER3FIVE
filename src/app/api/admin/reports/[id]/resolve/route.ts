import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/reports/[id]/resolve — Bearer-authed twin of the
 * web resolveReport server action. Either "reviewed" (report was
 * legitimate, action taken elsewhere) or "dismissed" (spurious / not
 * actionable). Both close the row; the queue only shows pending.
 *
 * Body: { outcome: "reviewed" | "dismissed" } — "resolved" is
 * accepted as an alias for "reviewed" so the mobile client can use
 * either term.
 *
 * Service role because message_reports has no user UPDATE policy (by
 * design — reports are user-immutable once submitted). The gate's
 * user id is stamped as reviewed_by, same as web.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const admin = gate.admin;
  const { id: reportId } = await params;

  let body: { outcome?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "bad_json" },
      { status: 400 },
    );
  }
  const rawOutcome = typeof body.outcome === "string" ? body.outcome : "";
  const outcome =
    rawOutcome === "resolved"
      ? "reviewed"
      : rawOutcome === "reviewed" || rawOutcome === "dismissed"
        ? rawOutcome
        : null;
  if (!outcome) {
    return NextResponse.json(
      {
        error: 'outcome must be "reviewed" (or "resolved") or "dismissed"',
        code: "bad_outcome",
      },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("message_reports")
    .update({
      status: outcome,
      reviewed_by: gate.user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", reportId);

  if (error) {
    return NextResponse.json(
      { error: error.message, code: "db_error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
