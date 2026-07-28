import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Daily purge cron — runs at 06:00 UTC (just after midnight US-East).
 *
 * Hard-deletes:
 *   - profiles where scheduled_purge_at < now() (30-day grace expired)
 *   - oracles  where scheduled_purge_at < now() (single identity expired)
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
      // Order matters (Fable audit):
      //
      // Previously the app-side rows were deleted BEFORE
      // auth.admin.deleteUser. If deleteUser errored the profile
      // row was already gone and every cascade-dependent table
      // still holding data (chat_spend_events, message_reactions,
      // conversation_state, persona_memories, chat_blocks,
      // archive_grants, legacy_drafts, etc.) had no
      // owner to hang off — silent orphans until the next full
      // audit.
      //
      // New order:
      //   1. Delete auth.users FIRST. Almost every app table has
      //      `references auth.users(id) on delete cascade` so this
      //      one call sweeps them clean. Retry twice on transient
      //      error; if all three attempts fail, skip this row and
      //      let the next daily run retry (nothing else has been
      //      touched).
      //   2. THEN scrub storage (still needs p.id for the path).
      //   3. THEN belt-and-suspenders app-side deletes for tables
      //      whose FKs are `on delete set null` rather than cascade
      //      (audit_log, email_log, stripe_events, etc.) — those
      //      keep their rows on account delete by design.
      let authErr: { message: string } | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await admin.auth.admin.deleteUser(p.id);
        authErr = res.error ?? null;
        if (!authErr) break;
        // Small backoff between retries; keeps the cron under its
        // time budget even for a stubborn error.
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
      if (authErr) {
        errors.push(`auth ${p.id}: ${authErr.message}`);
        // Skip everything else for this row so the next daily run
        // can retry from a clean state.
        continue;
      }

      // Storage cleanup — the auth-cascade doesn't touch storage.
      try {
        const { data: avatarFiles } = await admin.storage
          .from("avatars")
          .list(p.id, { limit: 1000 });
        if (avatarFiles && avatarFiles.length > 0) {
          await admin.storage
            .from("avatars")
            .remove(avatarFiles.map((f) => `${p.id}/${f.name}`));
        }
      } catch (err) {
        console.error(`purge avatars cleanup failed for ${p.id}`, err);
      }
      try {
        const { data: oracleFolders } = await admin.storage
          .from("chat-photos")
          .list(p.id, { limit: 1000 });
        for (const folder of oracleFolders ?? []) {
          const { data: photos } = await admin.storage
            .from("chat-photos")
            .list(`${p.id}/${folder.name}`, { limit: 1000 });
          if (photos && photos.length > 0) {
            await admin.storage
              .from("chat-photos")
              .remove(
                photos.map((f) => `${p.id}/${folder.name}/${f.name}`),
              );
          }
        }
      } catch (err) {
        console.error(`purge chat-photos cleanup failed for ${p.id}`, err);
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
      // Avatar files for this oracle (in <user>/<oracleId>.<ext> shape).
      try {
        const { data: files } = await admin.storage
          .from("avatars")
          .list(o.user_id, { limit: 1000 });
        if (files && files.length > 0) {
          const paths = files
            .filter((f) => f.name.startsWith(o.id))
            .map((f) => `${o.user_id}/${f.name}`);
          if (paths.length > 0) {
            await admin.storage.from("avatars").remove(paths);
          }
        }
      } catch (err) {
        console.error(`purge oracle avatars cleanup failed for ${o.id}`, err);
      }

      // Chat photos sit at <user>/<oracleId>/<file> — list + remove.
      try {
        const { data: photos } = await admin.storage
          .from("chat-photos")
          .list(`${o.user_id}/${o.id}`, { limit: 1000 });
        if (photos && photos.length > 0) {
          await admin.storage
            .from("chat-photos")
            .remove(
              photos.map((f) => `${o.user_id}/${o.id}/${f.name}`),
            );
        }
      } catch (err) {
        console.error(`purge oracle chat-photos cleanup failed for ${o.id}`, err);
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
