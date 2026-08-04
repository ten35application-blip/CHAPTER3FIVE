import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CRON_MAX_DURATION } from "@/lib/cron/budget";

export const runtime = "nodejs";
export const maxDuration = CRON_MAX_DURATION;

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

/**
 * Turn a stored avatar_url into the object key inside the `avatars`
 * bucket, or null if it isn't one of ours.
 *
 * avatar_url holds a full public URL with a ?v= cache-buster. Both purge
 * paths need the key, and both were open-coding the parse — the
 * oracle-level one correctly, the account-level one not at all. Shared
 * so the two can't drift again.
 */
function avatarObjectPath(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null;
  const marker = "/storage/v1/object/public/avatars/";
  const at = avatarUrl.indexOf(marker);
  if (at === -1) return null;
  return avatarUrl.slice(at + marker.length).split("?")[0] || null;
}

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
      // READ THE AVATAR PATHS BEFORE THE CASCADE (2026-08-04). Step 1
      // below deletes auth.users, which cascades `oracles` away — so by
      // the time storage cleanup runs, avatar_url is gone. The prefix
      // sweeps further down cover avatars/{user_id}/ and
      // avatars/legacy/{user_id}/, but a photo uploaded through the
      // from-photo flow lands at avatars/user-uploaded/{oracle_id}.…,
      // a FLAT namespace keyed by oracle id with nothing in the path
      // tying it to this user. No prefix listing can find it.
      //
      // That path is the one where "the user's photo IS the avatar" —
      // an actual photograph of an actual person, on a public bucket.
      // It survived account deletion entirely. Someone exercising their
      // right to be forgotten left behind the one image they would
      // least want left behind, which is also the thing App Store
      // 5.1.1(v) and the privacy policy both say we delete.
      //
      // So: collect the URLs first, delete the objects after.
      const { data: preCascadeOracles } = await admin
        .from("oracles")
        .select("avatar_url")
        .eq("user_id", p.id);
      const uploadedAvatarPaths = (preCascadeOracles ?? [])
        .map((o) => avatarObjectPath(o.avatar_url as string | null))
        .filter((path): path is string => !!path?.startsWith("user-uploaded/"));

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
        // LEGACY PHOTOS LIVE ONE LEVEL DEEPER (2026-08-04). Uploads go
        // to avatars/legacy/{user_id}/…, which the {user_id} prefix
        // above never enumerated. So deleting an account left a
        // photograph of the user's dead relative on the `avatars`
        // bucket — which is PUBLIC — at a permanent, unauthenticated
        // URL. Someone exercising their right to be forgotten left
        // behind the one image they'd least want to.
        //
        // Recipients are unaffected: redemption file-COPIES the avatar
        // into the recipient's own namespace, so an inherited archive
        // keeps its face.
        const { data: legacyFiles } = await admin.storage
          .from("avatars")
          .list(`legacy/${p.id}`, { limit: 1000 });
        if (legacyFiles && legacyFiles.length > 0) {
          await admin.storage
            .from("avatars")
            .remove(legacyFiles.map((f) => `legacy/${p.id}/${f.name}`));
        }

        // The from-photo uploads collected before the cascade. Flat
        // namespace, oracle-keyed, unreachable by any prefix listing —
        // see the note at the top of this loop.
        if (uploadedAvatarPaths.length > 0) {
          await admin.storage.from("avatars").remove(uploadedAvatarPaths);
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
    .select("id, user_id, avatar_url")
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

        // LEGACY PHOTOS CANNOT BE FOUND BY NAME (2026-08-04). They live
        // at avatars/legacy/{user_id}/{timestamp}.jpg — the filename is
        // a timestamp, so the startsWith(o.id) filter above can never
        // match one. The account-purge path was fixed to sweep the
        // whole legacy/ prefix; THIS path deletes a single identity
        // while the account lives on, so it has to target one object.
        //
        // The oracle's own avatar_url is the authority. Without this, a
        // user who deletes just their mother's archive leaves her
        // photograph on the PUBLIC avatars bucket at a permanent
        // unauthenticated URL — the leak we closed for account deletion,
        // one code path over.
        const objectPath = avatarObjectPath(o.avatar_url as string | null);
        // Ownership has to be provable from the path itself — avatar_url
        // is a column, and a column is not a capability. Three shapes
        // qualify, and each one names either this user or this oracle:
        //
        //   legacy/{user_id}/…          legacy-flow upload
        //   user-uploaded/{oracle_id}…  from-photo upload  ← was missed
        //   {user_id}/…                 generated face
        //
        // The startsWith(o.id) filter above only ever catches avatars
        // whose FILENAME begins with the oracle id. Generated faces are
        // named `{timestamp}-ai.webp`, so that filter never matched one
        // either — deleting a single identity left its face behind. The
        // {user_id}/ case here closes that too.
        if (
          objectPath &&
          (objectPath.startsWith(`legacy/${o.user_id}/`) ||
            objectPath.startsWith(`user-uploaded/${o.id}`) ||
            objectPath.startsWith(`${o.user_id}/`))
        ) {
          await admin.storage.from("avatars").remove([objectPath]);
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
