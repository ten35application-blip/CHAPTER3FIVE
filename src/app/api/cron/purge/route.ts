import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Daily purge cron — runs at 06:00 UTC (just after midnight US-East).
 *
 * Hard-deletes:
 *   - profiles where scheduled_purge_at < now() (30-day grace expired)
 *   - oracles  where scheduled_purge_at < now() (single thirtyfive expired)
 *
 * For an account purge: removes all owned rows (answers, oracles,
 * shares, payments, etc.), wipes avatar storage, then deletes the
 * auth.users row.
 *
 * For an oracle-only purge: removes the oracle and lets cascading FKs
 * clean up answers/messages/grants/persona_memories/beneficiaries
 * attached to it. Avatar files for that oracle get scrubbed too.
 */

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  const nowIso = new Date().toISOString();

  let accountsPurged = 0;
  let oraclesPurged = 0;
  const errors: string[] = [];

  // ============================================================
  // 1. Account-level purges.
  // ============================================================
  const { data: accountsToDelete } = await admin
    .from("profiles")
    .select("id")
    .lt("scheduled_purge_at", nowIso)
    .not("deleted_at", "is", null)
    .limit(50);

  for (const p of accountsToDelete ?? []) {
    try {
      // App-side data, in dependency order.
      await admin.from("answers").delete().eq("user_id", p.id);
      await admin.from("agreements").delete().eq("user_id", p.id);
      await admin.from("oracles").delete().eq("user_id", p.id);
      await admin.from("shares").delete().eq("source_user_id", p.id);
      await admin.from("payments").delete().eq("user_id", p.id);
      await admin.from("crisis_flags").delete().eq("user_id", p.id);
      await admin.from("message_reports").delete().eq("user_id", p.id);
      await admin.from("device_tokens").delete().eq("user_id", p.id);
      await admin.from("chat_usage").delete().eq("user_id", p.id);
      await admin.from("profiles").delete().eq("id", p.id);

      // Storage cleanup (avatars).
      try {
        const { data: files } = await admin.storage
          .from("avatars")
          .list(p.id);
        if (files && files.length > 0) {
          const paths = files.map((f) => `${p.id}/${f.name}`);
          await admin.storage.from("avatars").remove(paths);
        }
      } catch (err) {
        console.error(`purge storage cleanup failed for ${p.id}`, err);
      }

      // Then the auth.users row itself — irreversible.
      const { error: authErr } = await admin.auth.admin.deleteUser(p.id);
      if (authErr) {
        errors.push(`auth ${p.id}: ${authErr.message}`);
      }

      await admin.from("audit_log").insert({
        action: "account_purged",
        target_user_id: p.id,
        details: { source: "cron", grace_expired: true },
      });

      accountsPurged++;
    } catch (err) {
      errors.push(
        `account ${p.id}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  // ============================================================
  // 2. Oracle-level purges (where the account itself is still alive).
  // ============================================================
  const { data: oraclesToDelete } = await admin
    .from("oracles")
    .select("id, user_id")
    .lt("scheduled_purge_at", nowIso)
    .not("deleted_at", "is", null)
    .limit(100);

  for (const o of oraclesToDelete ?? []) {
    try {
      // Storage: scrub avatar files for this oracle. We don't track
      // exact filenames here, so list everything under the user folder
      // and remove anything that starts with the oracle id.
      try {
        const { data: files } = await admin.storage
          .from("avatars")
          .list(o.user_id);
        if (files && files.length > 0) {
          const paths = files
            .filter((f) => f.name.startsWith(o.id))
            .map((f) => `${o.user_id}/${f.name}`);
          if (paths.length > 0) {
            await admin.storage.from("avatars").remove(paths);
          }
        }
      } catch (err) {
        console.error(`purge oracle storage cleanup failed for ${o.id}`, err);
      }

      // Cascade FKs handle messages/answers/grants/memories/beneficiaries.
      await admin.from("oracles").delete().eq("id", o.id);

      await admin.from("audit_log").insert({
        action: "oracle_purged",
        target_user_id: o.user_id,
        target_id: o.id,
        details: { source: "cron", grace_expired: true },
      });

      oraclesPurged++;
    } catch (err) {
      errors.push(
        `oracle ${o.id}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  await admin.from("cron_runs").insert({
    job: "purge",
    processed: accountsPurged + oraclesPurged,
    duration_ms: Date.now() - startedAt,
    status: errors.length > 0 ? "error" : "ok",
    error: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
  });

  return NextResponse.json({
    accounts_purged: accountsPurged,
    oracles_purged: oraclesPurged,
    errors,
  });
}
