import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
// Literal, not the shared constant: Next reads segment config
// statically, so an imported value fails the build with
// "Invalid segment configuration export detected". Keep in sync
// with CRON_MAX_DURATION in lib/cron/budget.ts.
export const maxDuration = 300;

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

  // AN ACCOUNT THAT OWNS THE SHARED CONCIERGE IS NOT PURGEABLE.
  //
  // The concierge (is_concierge = true — one row, "Adrian") is what
  // every free-tier user talks to, and it is owned by an operator's
  // personal account rather than a service account. Step 1 below calls
  // auth.admin.deleteUser, and oracles.user_id references auth.users
  // ON DELETE CASCADE, so purging that account destroys the concierge
  // and cascades away messages, conversation_state, oracle_read_state
  // and persona_memories for EVERY user, plus nulls out their
  // free_identity_id. No column filter anywhere else can prevent it —
  // the cascade doesn't consult columns.
  //
  // Until the concierge is reparented to a service account, refuse.
  // An operator who genuinely wants their account gone can move the
  // row first. Fail-closed on the lookup: if we cannot tell who owns
  // the concierge, we do not get to delete anyone.
  const purgeCandidateIds = (accountsToDelete ?? []).map((p) => p.id as string);
  const conciergeOwners = new Set<string>();
  let unknownConciergeState = false;
  if (purgeCandidateIds.length > 0) {
    const { data: conciergeRows, error: conciergeErr } = await admin
      .from("oracles")
      .select("user_id")
      .eq("is_concierge", true);
    if (conciergeErr) {
      errors.push(`concierge owner lookup failed: ${conciergeErr.message}`);
      for (const id of purgeCandidateIds) conciergeOwners.add(id);
      unknownConciergeState = true;
    } else {
      for (const row of conciergeRows ?? []) {
        conciergeOwners.add(row.user_id as string);
      }
    }
  }

  let skippedConciergeOwner = 0;

  for (const p of accountsToDelete ?? []) {
    if (conciergeOwners.has(p.id as string)) {
      skippedConciergeOwner++;
      continue;
    }
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

  // A LIVE INHERIT CODE IS SOMEONE ELSE'S ONLY COPY.
  //
  // inherit_codes.oracle_id is `on delete cascade` (verified against
  // pg_constraint), so the hard delete below destroys every code minted
  // for the identity. permanentDeleteIdentity in dashboard/actions.ts
  // already refuses for exactly this reason — the family holding the
  // card otherwise hits the redeem screen's deliberately vague "That
  // code didn't open anything" and never learns why.
  //
  // That guard sits on the button. This loop has no button and no owner
  // to ask, and until migration 0136 started writing
  // oracles.scheduled_purge_at it had never selected a single row, so
  // the gap never showed. Now it can fire, and it would be the more
  // destructive of the two paths: silent, unattended, no warning.
  //
  // Skipping leaves the row soft-deleted and recoverable. The owner can
  // still revoke the code and hard-delete deliberately through the UI.
  // Waiting is always the recoverable direction; deleting never is.
  const candidateIds = (oraclesToDelete ?? []).map((o) => o.id as string);
  const heldByLiveCode = new Set<string>();
  let skippedForLiveCode = 0;
  let skippedForUnknownCodeState = 0;
  if (candidateIds.length > 0) {
    // Explicit limit, and a full page is treated as "cannot tell".
    // Without it PostgREST's db-max-rows could silently truncate the
    // result, and a truncated answer here fails OPEN — an oracle whose
    // code fell off the end reads as unheld and gets destroyed. That
    // is the one direction this block exists to prevent.
    const CODE_PAGE = 1000;
    const { data: liveCodes, error: codesErr } = await admin
      .from("inherit_codes")
      .select("oracle_id")
      .in("oracle_id", candidateIds)
      .is("revoked_at", null)
      .limit(CODE_PAGE);
    if (codesErr) {
      // Fail closed. If we cannot prove no code is outstanding, we do
      // not get to destroy the identity it points at.
      errors.push(`inherit_codes lookup failed: ${codesErr.message}`);
      for (const id of candidateIds) heldByLiveCode.add(id);
      skippedForUnknownCodeState = candidateIds.length;
    } else if ((liveCodes?.length ?? 0) >= CODE_PAGE) {
      errors.push(
        `inherit_codes lookup hit the ${CODE_PAGE}-row page limit; skipping this batch rather than risking a truncated read`,
      );
      for (const id of candidateIds) heldByLiveCode.add(id);
      skippedForUnknownCodeState = candidateIds.length;
    } else {
      for (const row of liveCodes ?? []) {
        heldByLiveCode.add(row.oracle_id as string);
      }
    }
  }

  for (const o of oraclesToDelete ?? []) {
    if (heldByLiveCode.has(o.id as string)) {
      // Only count it as a code-hold when we actually saw a code; the
      // fail-closed branches above already reported themselves, and
      // labelling those "live inherit code outstanding" would send
      // someone looking for a code that isn't there.
      if (skippedForUnknownCodeState === 0) skippedForLiveCode++;
      continue;
    }
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

  // Skipped-for-code is not an error — it's the guard working — but it
  // must be visible, or "0 purged" reads as "nothing was due" when it
  // actually means "something was due and we refused to destroy it".
  const notes: string[] = [];
  if (skippedForLiveCode > 0) {
    notes.push(
      `${skippedForLiveCode} identit${skippedForLiveCode === 1 ? "y" : "ies"} skipped: live inherit code outstanding`,
    );
  }
  if (skippedForUnknownCodeState > 0) {
    notes.push(
      `${skippedForUnknownCodeState} identities skipped: could not read inherit-code state`,
    );
  }
  if (skippedConciergeOwner > 0) {
    // Don't call it a concierge hold when the truth is "we couldn't
    // check" — that would send someone hunting for an ownership problem
    // that doesn't exist. Same distinction the inherit-code counters make.
    notes.push(
      unknownConciergeState
        ? `${skippedConciergeOwner} account(s) skipped: could not read concierge ownership`
        : `${skippedConciergeOwner} account(s) skipped: owns the shared concierge — reparent it before this account can be purged`,
    );
  }
  notes.push(...errors);

  await admin.from("cron_runs").insert({
    job: "purge",
    processed: accountsPurged + oraclesPurged,
    duration_ms: Date.now() - startedAt,
    status: errors.length > 0 ? "error" : "ok",
    error: notes.length > 0 ? notes.slice(0, 6).join("; ") : null,
  });

  return NextResponse.json({
    accounts_purged: accountsPurged,
    oracles_purged: oraclesPurged,
    skipped_for_live_code: skippedForLiveCode,
    skipped_for_unknown_code_state: skippedForUnknownCodeState,
    skipped_concierge_owner: skippedConciergeOwner,
    errors,
  });
}
