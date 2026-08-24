import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit, sendArchiveUpdatedEmail } from "@/lib/notifications";
import { verifiedAvatarUrl, avatarsObjectPath } from "@/lib/storage/avatarObject";
import { randomUUID } from "node:crypto";

/**
 * Update an archive you made about YOURSELF, and push the change to
 * everyone already holding a copy.
 *
 * Wilson 2026-08-22, after his wife finished the first real archive and
 * her photo didn't survive: "you can only edit YOUR OWN WALK and not
 * that you helped create for someone else."
 *
 * The rules, all enforced here:
 *
 *   - SELF-MODE ONLY. An archive about someone else — a parent, a
 *     friend — is not yours to revise. Their story stops where they
 *     stopped it.
 *   - NEVER YOUR COPY OF SOMEONE ELSE'S. `inherited_at IS NULL` is the
 *     load-bearing filter; without it, redeeming someone's archive
 *     would let you rewrite their dead relative for their whole family.
 *   - ADD AND CORRECT, NEVER DELETE. An empty answer is rejected
 *     rather than stored, so nothing a person said can be taken away.
 *   - NOTHING IS LOST. A correction appends the previous text to
 *     legacy_answers.history before overwriting, so the record keeps
 *     what was said as well as what it became.
 *
 * Fan-out is deliberate, not incidental. Copies are snapshots taken at
 * redemption, so without this a correction would leave two relatives
 * holding contradictory versions of the same person. Every holder is
 * emailed and told exactly what changed — a companion that quietly
 * starts knowing new things is unsettling, and if the person is gone,
 * an unannounced change is worse than unsettling.
 */

export type ArchiveUpdate = {
  /** Already uploaded via /api/legacy/photo. Verified before storing. */
  photoUrl?: string | null;
  /** question_id → new text. Blank/whitespace entries are refused. */
  answers?: Record<string, string>;
};

export type UpdateResult =
  | { ok: true; photoChanged: boolean; added: number; corrected: number; copies: number }
  | { ok: false; error: string; status: number };

type LegacyAnswers = {
  subject?: { mode?: unknown; photoUrl?: string | null; [k: string]: unknown };
  answers?: Record<string, string>;
  history?: Array<{
    question_id: string;
    from: string;
    to: string;
    at: string;
  }>;
};

export async function updateOwnArchive(
  userId: string,
  oracleId: string,
  update: ArchiveUpdate,
): Promise<UpdateResult> {
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("oracles")
    .select("id, user_id, name, is_legacy, inherited_at, legacy_answers, avatar_url, deleted_at")
    .eq("id", oracleId)
    .maybeSingle();

  if (!row || row.user_id !== userId || row.deleted_at) {
    return { ok: false, error: "We couldn't find that archive.", status: 404 };
  }
  if (!row.is_legacy || row.inherited_at) {
    // A redeemed copy is is_legacy and owned by the caller too — this
    // is the check that stops someone revising a dead person they
    // inherited.
    return {
      ok: false,
      error: "Only an archive you created can be updated.",
      status: 403,
    };
  }

  const stored = (row.legacy_answers ?? {}) as LegacyAnswers;
  if (stored.subject?.mode !== "self") {
    return {
      ok: false,
      error:
        "This one is about someone else, so it stays as they were remembered. Only your own archive can be updated.",
      status: 403,
    };
  }

  const answers: Record<string, string> = { ...(stored.answers ?? {}) };
  const history = [...(stored.history ?? [])];
  const now = new Date().toISOString();
  let added = 0;
  let corrected = 0;

  for (const [qid, rawText] of Object.entries(update.answers ?? {})) {
    const text = typeof rawText === "string" ? rawText.trim() : "";
    if (!text) {
      // Add and correct — never take away.
      return {
        ok: false,
        error: "An answer can be changed, but not emptied.",
        status: 400,
      };
    }
    const previous = (answers[qid] ?? "").trim();
    if (previous === text) continue;
    if (previous) {
      history.push({ question_id: qid, from: previous, to: text, at: now });
      corrected++;
    } else {
      added++;
    }
    answers[qid] = text;
  }

  // Photo: verify the object is really there before it goes anywhere
  // near a row. This whole feature exists because an unverified URL
  // was stored once and rendered as a black square.
  let newPhotoUrl: string | null = null;
  let photoChanged = false;
  if (update.photoUrl !== undefined && update.photoUrl !== null) {
    newPhotoUrl = await verifiedAvatarUrl(
      update.photoUrl,
      `legacy/update user=${userId} oracle=${oracleId}`,
    );
    if (!newPhotoUrl) {
      return {
        ok: false,
        error: "That photo didn't save. Try picking it again.",
        status: 400,
      };
    }
    photoChanged = true;
  }

  if (!photoChanged && added === 0 && corrected === 0) {
    return { ok: true, photoChanged: false, added: 0, corrected: 0, copies: 0 };
  }

  const nextLegacy: LegacyAnswers = {
    ...stored,
    subject: {
      ...(stored.subject ?? {}),
      ...(photoChanged ? { photoUrl: newPhotoUrl } : {}),
    },
    answers,
    history,
  };

  const { error: updateError } = await admin
    .from("oracles")
    .update({
      legacy_answers: nextLegacy,
      ...(photoChanged ? { avatar_url: newPhotoUrl } : {}),
    })
    .eq("id", oracleId)
    .eq("user_id", userId);

  if (updateError) {
    console.error(`[legacy/update] ${oracleId} failed:`, updateError);
    return {
      ok: false,
      error: "Couldn't save that just now. Try again.",
      status: 500,
    };
  }

  // Fan out to everyone holding a copy. Backgrounded — one archive can
  // have many holders and the person who pressed Save shouldn't wait
  // on their inboxes.
  const copies = await copyTargets(oracleId);
  if (copies.length > 0) {
    after(async () => {
      await fanOut({
        sourceName: (row.name as string) ?? "Someone",
        answers,
        history,
        photoUrl: photoChanged ? newPhotoUrl : null,
        copies,
        photoChanged,
        added,
        corrected,
      });
    });
  }

  return { ok: true, photoChanged, added, corrected, copies: copies.length };
}

type CopyTarget = {
  id: string;
  user_id: string;
  legacy_answers: unknown;
  /** False when the holder's account is soft-deleted. Their COPY is still
   *  brought up to date — they can reactivate inside the 30-day window and
   *  must not come back to a permanently stale archive — but they are not
   *  emailed while they are gone. */
  notify: boolean;
};

async function copyTargets(oracleId: string): Promise<CopyTarget[]> {
  const admin = createAdminClient();
  const { data: codes } = await admin
    .from("inherit_codes")
    .select("id")
    .eq("oracle_id", oracleId);
  const codeIds = (codes ?? []).map((c) => c.id as string);
  if (codeIds.length === 0) return [];

  const { data: rows } = await admin
    .from("oracles")
    .select("id, user_id, legacy_answers")
    .in("inherited_from_code_id", codeIds)
    .is("deleted_at", null);
  const copies = (rows ?? []) as CopyTarget[];
  if (copies.length === 0) return [];

  // Holders who closed their account get the UPDATE but not the EMAIL.
  //
  // This used to filter them out entirely, which fixed one bug and
  // created another: account deletion is a 30-day soft delete with a
  // reactivate path, so anyone who left and came back had permanently
  // missed every update made while they were gone — nothing backfills.
  // For an archive of someone who died, that is the family member who
  // returns to find their copy is the only one frozen in the past.
  //
  // Writing to the row is harmless while they are away; mailing them is
  // not (the 2026-08-22 drill mailed a deleted test account, which is
  // what prompted the original filter). So keep the row current and hold
  // the notification.
  const { data: living } = await admin
    .from("profiles")
    .select("id")
    .in("id", Array.from(new Set(copies.map((c) => c.user_id))))
    .is("deleted_at", null);
  const alive = new Set((living ?? []).map((p) => p.id as string));
  return copies.map((c) => ({ ...c, notify: alive.has(c.user_id) }));
}

async function fanOut(args: {
  sourceName: string;
  answers: Record<string, string>;
  history: LegacyAnswers["history"];
  photoUrl: string | null;
  photoChanged: boolean;
  copies: CopyTarget[];
  added: number;
  corrected: number;
}) {
  const admin = createAdminClient();
  const sourcePath = args.photoUrl ? avatarsObjectPath(args.photoUrl) : null;

  for (const copy of args.copies) {
    try {
      const theirs = (copy.legacy_answers ?? {}) as LegacyAnswers;
      const nextBlob: Record<string, unknown> = {
        ...theirs,
        answers: args.answers,
        history: args.history,
      };
      const patch: Record<string, unknown> = { legacy_answers: nextBlob };

      // Each holder gets the photo in their OWN namespace — the same
      // rule redemption follows, so one person deleting their account
      // can never blank the picture in someone else's copy.
      if (sourcePath) {
        const destPath = `legacy/${copy.user_id}/inherited-${randomUUID()}.jpg`;
        const { error: copyError } = await admin.storage
          .from("avatars")
          .copy(sourcePath, destPath);
        if (copyError) {
          console.error(
            `[legacy/update] photo fan-out failed for copy=${copy.id}: ${copyError.message}`,
          );
        } else {
          const { data: pub } = admin.storage
            .from("avatars")
            .getPublicUrl(destPath);
          const theirUrl = `${pub.publicUrl}?v=${Date.now()}`;
          patch.avatar_url = theirUrl;
          // The blob's pointer moves WITH the avatar — leaving it on
          // the creator's (or the holder's previous) object is how a
          // copy ends up rendering a photo someone else controls.
          nextBlob.subject = {
            ...((theirs.subject ?? {}) as Record<string, unknown>),
            photoUrl: theirUrl,
          };
        }
      }

      await admin.from("oracles").update(patch).eq("id", copy.id);

      // Row is current either way; the mail is what waits. A holder whose
      // account is closed can reactivate inside the 30-day window and will
      // find their copy up to date rather than frozen at the day they left.
      if (!copy.notify) continue;

      const { data: authRes } = await admin.auth.admin.getUserById(
        copy.user_id,
      );
      const email = authRes?.user?.email;
      if (email) {
        await sendArchiveUpdatedEmail({
          to: email,
          userId: copy.user_id,
          name: args.sourceName,
          photoChanged: args.photoChanged,
          answersAdded: args.added,
          answersCorrected: args.corrected,
        });
      }
    } catch (err) {
      // One bad copy must never stop the rest — but a console line
      // dies with the lambda, and a holder whose copy silently missed
      // an update is unrecoverable without a durable record. The audit
      // row is that record: /admin can list archive_update_failed
      // events and re-run the update for exactly those holders.
      console.error(`[legacy/update] fan-out error on copy=${copy.id}:`, err);
      void recordAudit({
        actorUserId: null,
        action: "archive_update_failed",
        targetUserId: copy.user_id,
        targetId: copy.id,
        details: {
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }
}
