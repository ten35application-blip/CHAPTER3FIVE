import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

/**
 * DELAYED-DELIVERY REVEAL PUSH (audit fix H1+M3, 2026-08-25).
 *
 * A delayed reply is persisted with a future visible_at and NO
 * immediate push. The phone used to schedule the reveal notification
 * itself, but that scheduling only happened after the /api/chat
 * response parsed — force-quit in that 10-30s window and the
 * notification never existed, for exactly the person who put the
 * phone away to wait. So the server owns the reveal moment instead:
 * Supabase pg_cron POSTs here every minute (job 'delayed-reveal-push')
 * and this route announces every reply whose moment has arrived.
 *
 * NO AUTH, ON PURPOSE. This endpoint is idempotent — it can only
 * announce replies whose visible_at has already passed, each at most
 * once (reveal_push_sent_at is claimed atomically below) — so an
 * outside caller can trigger nothing that the next minute wouldn't do
 * anyway. Abuse is capped by the internal_ticks conditional update:
 * at most one scan per 30 seconds no matter how hard it's hammered.
 *
 * The double-text flush in both chat routes stamps
 * reveal_push_sent_at at flush time, so a reply the user watched
 * arrive never buzzes them a minute later.
 */

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  const admin = createAdminClient();

  // Rate gate: claim the tick or bail. Postgres serializes the
  // conditional update, so concurrent callers can't both pass.
  const { data: tick } = await admin
    .from("internal_ticks")
    .update({ last_run_at: new Date().toISOString() })
    .eq("name", "delayed_push")
    .lt(
      "last_run_at",
      new Date(Date.now() - 30_000).toISOString(),
    )
    .select("name");
  if (!tick || tick.length === 0) {
    return NextResponse.json({ ok: true, skipped: "recent_run" });
  }

  // Claim due rows atomically: whoever stamps reveal_push_sent_at owns
  // the announcement. The 6-hour floor keeps a backlog (downtime, old
  // rows) from buzzing people about ancient messages — anything older
  // arrives silently, which is the pre-push status quo.
  const nowIso = new Date().toISOString();
  const { data: due, error } = await admin
    .from("messages")
    .update({ reveal_push_sent_at: nowIso })
    .eq("role", "assistant")
    .not("visible_at", "is", null)
    .lte("visible_at", nowIso)
    .gte("visible_at", new Date(Date.now() - 6 * 3600_000).toISOString())
    .is("reveal_push_sent_at", null)
    .is("deleted_at", null)
    .select("user_id, oracle_id, content, visible_at, created_at");
  if (error) {
    console.error("[delayed-push] due-claim failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, pushed: 0 });
  }

  // One push per (user, oracle) turn — a burst is one arrival. The
  // preview is the LAST part by created_at, matching the instant
  // path's choice.
  const byThread = new Map<string, typeof due>();
  for (const row of due) {
    const key = `${row.user_id}:${row.oracle_id}`;
    const bucket = byThread.get(key) ?? [];
    bucket.push(row);
    byThread.set(key, bucket);
  }

  // Companion names for titles, one query.
  const oracleIds = [...new Set(due.map((r) => r.oracle_id))];
  const { data: oracles } = await admin
    .from("oracles")
    .select("id, name")
    .in("id", oracleIds);
  const nameById = new Map((oracles ?? []).map((o) => [o.id, o.name]));

  let pushed = 0;
  for (const rows of byThread.values()) {
    const last = [...rows].sort((a, b) =>
      a.created_at < b.created_at ? -1 : 1,
    )[rows.length - 1];
    const preview = String(last.content ?? "");
    await sendPushToUser({
      userId: last.user_id,
      title: nameById.get(last.oracle_id) ?? "chapter3five",
      body: preview.length > 180 ? `${preview.slice(0, 179)}…` : preview,
      badge: 1,
      categoryId: "companion_message",
      threadIdentifier: last.oracle_id,
      channelId: "companion",
      data: { oracle_id: last.oracle_id, kind: "reply" },
    }).catch((err) => {
      // The rows stay stamped — a failed push is not retried, matching
      // the instant path's best-effort posture.
      console.error("[delayed-push] push failed:", err);
    });
    pushed++;
  }

  return NextResponse.json({ ok: true, pushed });
}
