import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { ADMIN_EMAILS } from "@/lib/admin/allowlist";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * The offsite copy of everything irreplaceable (Wilson 2026-08-26:
 * "in case anyone comes looking we have a small copy").
 *
 * What this product cannot lose is not code — it's the 45 answers a
 * person recorded before they died, the codes their family holds, and
 * who holds which copy. The live database had NO recovery story
 * (pitr_enabled: false, backups: []), so until real backups are on,
 * and as belt-and-suspenders after, this cron mails a daily JSON
 * snapshot of exactly those tables to the admins. An inbox is a
 * genuinely separate failure domain: it survives a dropped table, a
 * bad migration, a deleted project.
 *
 * Included: legacy + inherited oracles (identity fields, full
 * legacy_answers, avatar pointers), all inherit codes (code, status,
 * oracle), and a holder map (which user holds which copy of which
 * source). Deliberately EXCLUDED: chat messages (huge, and not the
 * irreplaceable core) and anything about non-archive companions
 * (regenerable from traits).
 *
 * Size math: an archive blob runs ~10-100KB; at hundreds of archives
 * this attachment is still a few MB. When it approaches email limits
 * (~30MB), the size guard below ships the manifest without blobs and
 * says so loudly — the signal to move to real storage-side backups.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();

  const [{ data: archives }, { data: codes }, { data: copies }] =
    await Promise.all([
      admin
        .from("oracles")
        .select(
          "id, user_id, name, one_line_hook, is_legacy, is_self_archive, legacy_answers, avatar_url, preferred_language, fingerprint, created_at, deleted_at",
        )
        .eq("is_legacy", true),
      admin
        .from("inherit_codes")
        .select("id, code, oracle_id, created_by, created_at, revoked_at"),
      admin
        .from("oracles")
        .select(
          "id, user_id, name, inherited_from_code_id, inherited_at, avatar_url, legacy_answers, created_at, deleted_at",
        )
        .not("inherited_at", "is", null),
    ]);

  const snapshot = {
    taken_at: new Date().toISOString(),
    note:
      "chapter3five irreplaceables snapshot — archives, inherit codes, holder copies. Restore contact: this inbox.",
    counts: {
      archives: archives?.length ?? 0,
      codes: codes?.length ?? 0,
      holder_copies: copies?.length ?? 0,
    },
    archives: archives ?? [],
    inherit_codes: codes ?? [],
    holder_copies: copies ?? [],
  };

  let payload = JSON.stringify(snapshot);
  let truncated = false;
  if (payload.length > 30 * 1024 * 1024) {
    truncated = true;
    payload = JSON.stringify({
      ...snapshot,
      note:
        "TRUNCATED — blobs omitted, manifest only. The snapshot outgrew " +
        "email. Move to storage-side backups NOW.",
      archives: (archives ?? []).map((a) => {
        const { legacy_answers, ...rest } = a;
        void legacy_answers;
        return rest;
      }),
      holder_copies: (copies ?? []).map((c) => {
        const { legacy_answers, ...rest } = c;
        void legacy_answers;
        return rest;
      }),
    });
  }

  const dateTag = new Date().toISOString().slice(0, 10);
  const subject = truncated
    ? `⚠️ chapter3five archive snapshot ${dateTag} — TRUNCATED, act`
    : `chapter3five archive snapshot ${dateTag} — ${snapshot.counts.archives} archives, ${snapshot.counts.codes} codes`;

  let sent = 0;
  for (const to of ADMIN_EMAILS) {
    try {
      await resend.emails.send({
        from: "chapter3five vault <safety@chapter3five.app>",
        to,
        subject,
        text:
          `Daily snapshot of the irreplaceables.\n\n` +
          `Archives: ${snapshot.counts.archives}\n` +
          `Inherit codes: ${snapshot.counts.codes}\n` +
          `Holder copies: ${snapshot.counts.holder_copies}\n\n` +
          `Keep a few of these. Any one of them is enough to rebuild ` +
          `every family's archive if the worst happens.` +
          (truncated
            ? `\n\n⚠️ THIS ONE IS TRUNCATED (manifest only) — the data ` +
              `outgrew email. Real storage backups are overdue.`
            : ""),
        attachments: [
          {
            filename: `chapter3five-vault-${dateTag}.json`,
            content: Buffer.from(payload).toString("base64"),
          },
        ],
      });
      sent++;
    } catch (err) {
      console.error(`[archive-backup] send to ${to} failed:`, err);
    }
  }

  await admin.from("cron_runs").insert({
    job: "archive-backup",
    processed: sent,
    duration_ms: Date.now() - startedAt,
    status: sent > 0 ? "ok" : "error",
    error: sent === 0 ? "no snapshot email delivered" : null,
  });

  return NextResponse.json({ sent, truncated, counts: snapshot.counts });
}
