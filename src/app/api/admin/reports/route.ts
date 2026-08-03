import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api/adminAuth";
import { safeCount, safeSelect } from "@/lib/admin/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reports — JSON twin of /admin/reports, the
 * moderation queue for user-submitted message reports (App Store 1.2
 * UGC workflow). Each report ships with the same stitched context the
 * web page renders: the reported message (null if since deleted), the
 * persona name for assistant messages, and the reporter's profile.
 *
 * Query params:
 *   status — pending|reviewed|dismissed (default pending — the web
 *            queue only shows pending; the API exposes the closed
 *            states too so mobile can show history). "resolved" is
 *            accepted as an alias for "reviewed".
 *   limit  — default 50, hard cap 200
 *   offset — default 0
 */
type ReportRow = {
  id: string;
  message_id: string;
  reason: string;
  notes: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reporter_user_id: string;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  user_id: string;
  oracle_id: string;
};

type OracleRow = { id: string; name: string };
type ProfileRow = { id: string; full_name: string | null };

const REASON_LABEL: Record<string, string> = {
  inappropriate: "Inappropriate content",
  harmful: "Harmful or dangerous",
  off_character: "Out of character",
  spam: "Spam",
  other: "Other",
};

export async function GET(request: Request) {
  const gate = await requireAdminApi(request);
  if (!gate.ok) return gate.response;
  const supabase = gate.admin;

  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status") ?? "pending";
  // DB statuses are pending/reviewed/dismissed; accept "resolved" as
  // an alias for "reviewed" so the mobile client can use either.
  const status =
    rawStatus === "resolved"
      ? "reviewed"
      : ["pending", "reviewed", "dismissed"].includes(rawStatus)
        ? rawStatus
        : "pending";
  const limit = Math.min(
    200,
    Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50),
  );
  const offset = Math.max(
    0,
    Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0,
  );

  const [reports, total] = await Promise.all([
    safeSelect<ReportRow>(
      supabase,
      "message_reports",
      "id, message_id, reason, notes, status, created_at, reviewed_at, reporter_user_id",
      (q) =>
        q
          .eq("status", status)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1),
    ),
    safeCount(supabase, "message_reports", (q) => q.eq("status", status)),
  ]);

  // Stitch on the reported messages, persona names, and reporter
  // profiles — same three follow-up reads as the web page.
  const messageIds = reports.map((r) => r.message_id);
  const oracleIds = new Set<string>();
  const reporterIds = new Set<string>();
  reports.forEach((r) => reporterIds.add(r.reporter_user_id));

  const messagesById = new Map<string, MessageRow>();
  if (messageIds.length > 0) {
    const msgs = await safeSelect<MessageRow>(
      supabase,
      "messages",
      "id, role, content, created_at, user_id, oracle_id",
      (q) => q.in("id", messageIds),
    );
    for (const m of msgs) {
      messagesById.set(m.id, m);
      oracleIds.add(m.oracle_id);
    }
  }

  const oraclesById = new Map<string, OracleRow>();
  if (oracleIds.size > 0) {
    const oracles = await safeSelect<OracleRow>(
      supabase,
      "oracles",
      "id, name",
      (q) => q.in("id", Array.from(oracleIds)),
    );
    for (const o of oracles) oraclesById.set(o.id, o);
  }

  const profilesById = new Map<string, ProfileRow>();
  if (reporterIds.size > 0) {
    const profiles = await safeSelect<ProfileRow>(
      supabase,
      "profiles",
      "id, full_name",
      (q) => q.in("id", Array.from(reporterIds)),
    );
    for (const p of profiles) profilesById.set(p.id, p);
  }

  return NextResponse.json({
    reports: reports.map((r) => {
      const msg = messagesById.get(r.message_id) ?? null;
      const oracle = msg ? oraclesById.get(msg.oracle_id) ?? null : null;
      const reporter = profilesById.get(r.reporter_user_id) ?? null;
      return {
        id: r.id,
        message_id: r.message_id,
        reason: r.reason,
        reason_label: REASON_LABEL[r.reason] ?? r.reason,
        notes: r.notes,
        status: r.status,
        created_at: r.created_at,
        reviewed_at: r.reviewed_at,
        reporter_user_id: r.reporter_user_id,
        // null message = "Message deleted" state on web.
        message: msg,
        oracle,
        reporter,
      };
    }),
    total,
    hasMore: offset + reports.length < total,
  });
}
