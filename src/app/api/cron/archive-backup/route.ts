import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend } from "@/lib/resend";
import { ADMIN_EMAILS } from "@/lib/admin/allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The offsite copy of everything irreplaceable (Wilson 2026-08-26:
 * "in case anyone comes looking we have a small copy").
 *
 * What this product cannot lose is not code — it's the 45 answers a
 * person recorded before they died, the codes their family holds, and
 * who holds which copy. The live database had NO recovery story
 * (pitr_enabled: false, backups: []), so until real backups are on,
 * and as belt-and-suspenders after, this cron takes a daily JSON
 * snapshot of exactly those tables.
 *
 * CADENCE (Wilson 2026-09-02: "i rather get one email the 27th and
 * not this email that we be getting daily"): the snapshot is taken
 * every morning and saved to the private `vault-snapshots` storage
 * bucket (service role only). The email with the attachment goes out
 * ONCE A MONTH, on the 27th — the same day as the transfer sheet — so
 * an inbox still holds a copy that survives the project, without
 * three people getting it daily. `?email=1` forces the email on any
 * day (manual re-run).
 *
 * Included: legacy + inherited oracles (identity fields, full
 * legacy_answers, avatar pointers), all inherit codes (code,
 * revoked_at, oracle), and a holder map (which user holds which copy
 * of which source). Deliberately EXCLUDED: chat messages (huge, and
 * not the irreplaceable core) and anything about non-archive
 * companions (regenerable from traits).
 *
 * COMPLETENESS (audit 2026-09-02): every table is read in pages —
 * PostgREST caps a single select at db-max-rows (1000), which would
 * silently cut a backup short — and each page count is checked against
 * the table's exact count. A read that fails or comes up short is NOT
 * stored: an empty or partial snapshot overwriting the day's good copy
 * is worse than no snapshot, so the job logs an error and stops.
 *
 * Size math: an archive blob runs ~10-100KB; at hundreds of archives
 * the snapshot is still a few MB. The bucket always gets the FULL
 * snapshot (limit 50MB). Only the email attachment has a size guard:
 * Gmail rejects mail over 25MB and base64 adds a third, so past ~15MB
 * raw the email carries the manifest without blobs and says so.
 */

const PAGE = 500;
const EMAIL_MAX_BYTES = 15 * 1024 * 1024;

type Row = Record<string, unknown>;
type PageResult = {
  data: unknown[] | null;
  error: { message: string } | null;
  count: number | null;
};

/** Read a whole table (or filtered slice) in pages, verified against
 *  its exact count. Returns the rows or a reason they can't be trusted. */
async function readAll(
  label: string,
  page: (from: number, to: number) => PromiseLike<PageResult>,
): Promise<{ rows: Row[]; error: string | null }> {
  const rows: Row[] = [];
  let expected: number | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error, count } = await page(from, from + PAGE - 1);
    if (error) return { rows: [], error: `${label}: ${error.message}` };
    if (expected === null) expected = count ?? null;
    for (const r of data ?? []) rows.push(r as Row);
    if (!data || data.length < PAGE) break;
  }
  if (expected !== null && rows.length !== expected) {
    return { rows: [], error: `${label}: read ${rows.length} rows, table has ${expected}` };
  }
  return { rows, error: null };
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  // One clock for the whole run: the object name, the "taken at"
  // stamp, and the 27th check must never disagree across midnight.
  const now = new Date();
  const dateTag = now.toISOString().slice(0, 10);
  const isThe27th = now.getUTCDate() === 27;
  const forced = request.nextUrl.searchParams.get("email") === "1";
  const emailToday = isThe27th || forced;

  const [archivesRead, codesRead, copiesRead] = await Promise.all([
    readAll("legacy archives", (from, to) =>
      admin
        .from("oracles")
        .select(
          "id, user_id, name, one_line_hook, is_legacy, is_self_archive, legacy_answers, avatar_url, preferred_language, fingerprint, created_at, deleted_at",
          { count: "exact" },
        )
        .eq("is_legacy", true)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAll("inherit codes", (from, to) =>
      admin
        .from("inherit_codes")
        .select("id, code, oracle_id, created_by, created_at, revoked_at", { count: "exact" })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAll("holder copies", (from, to) =>
      admin
        .from("oracles")
        .select(
          "id, user_id, name, inherited_from_code_id, inherited_at, avatar_url, legacy_answers, created_at, deleted_at",
          { count: "exact" },
        )
        .not("inherited_at", "is", null)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  const readError = archivesRead.error ?? codesRead.error ?? copiesRead.error;
  if (readError) {
    // Refuse to store or send anything: a bad read must never
    // overwrite today's good copy with an empty one.
    await admin.from("cron_runs").insert({
      job: "archive-backup",
      processed: 0,
      duration_ms: Date.now() - startedAt,
      status: "error",
      error: `snapshot NOT taken — read failed: ${readError}`,
    });
    return NextResponse.json({ ok: false, stored: false, error: readError }, { status: 500 });
  }

  const archives = archivesRead.rows;
  const codes = codesRead.rows;
  const copies = copiesRead.rows;

  const snapshot = {
    taken_at: now.toISOString(),
    note:
      "chapter3five irreplaceables snapshot — archives, inherit codes, holder copies. Restore contact: this inbox.",
    counts: {
      archives: archives.length,
      codes: codes.length,
      holder_copies: copies.length,
    },
    archives,
    inherit_codes: codes,
    holder_copies: copies,
  };

  // The bucket ALWAYS gets the full snapshot. Only the email is
  // trimmed when it would bounce.
  const fullPayload = JSON.stringify(snapshot);
  const bytes = Buffer.byteLength(fullPayload, "utf8");
  let emailPayload = fullPayload;
  let truncated = false;
  if (bytes > EMAIL_MAX_BYTES) {
    truncated = true;
    const withoutBlob = (r: Row) => {
      const { legacy_answers, ...rest } = r;
      void legacy_answers;
      return rest;
    };
    emailPayload = JSON.stringify({
      ...snapshot,
      note:
        "TRUNCATED FOR EMAIL — blobs omitted, manifest only. The full " +
        "snapshot is in the private vault-snapshots bucket.",
      archives: archives.map(withoutBlob),
      holder_copies: copies.map(withoutBlob),
    });
  }

  // Daily: the silent copy. One object per day, overwritten on a
  // re-run, kept forever (~115KB a day today).
  let stored = false;
  let storeError: string | null = null;
  try {
    const { error } = await admin.storage
      .from("vault-snapshots")
      .upload(`${dateTag}.json`, Buffer.from(fullPayload), {
        contentType: "application/json",
        upsert: true,
      });
    if (error) storeError = error.message;
    else stored = true;
  } catch (err) {
    storeError = err instanceof Error ? err.message : String(err);
  }

  // Monthly: the inbox copy, on the 27th only (or when forced).
  const subject = truncated
    ? `⚠️ chapter3five archive snapshot ${dateTag} — manifest only (full copy in the vault bucket)`
    : `chapter3five archive snapshot ${dateTag} — ${snapshot.counts.archives} archives, ${snapshot.counts.codes} codes`;

  let sent = 0;
  for (const to of emailToday ? ADMIN_EMAILS : []) {
    // Resend's SDK reports failures in `error`; it does not throw. The
    // try/catch only covers a broken payload (e.g. base64 of nothing).
    try {
      const { error } = await resend.emails.send({
        from: "chapter3five vault <safety@chapter3five.app>",
        to,
        subject,
        text:
          `Monthly copy of the irreplaceables (a snapshot is also saved every day to the private vault-snapshots bucket).\n\n` +
          `Archives: ${snapshot.counts.archives}\n` +
          `Inherit codes: ${snapshot.counts.codes}\n` +
          `Holder copies: ${snapshot.counts.holder_copies}\n` +
          `Size: ${(bytes / 1024).toFixed(0)} KB\n\n` +
          `Keep a few of these. Any one of them is enough to rebuild ` +
          `every family's archive if the worst happens.` +
          (truncated
            ? `\n\n⚠️ THIS ATTACHMENT IS THE MANIFEST ONLY — the full ` +
              `snapshot outgrew email. The complete copy is in the ` +
              `vault-snapshots bucket (${dateTag}.json).`
            : ""),
        attachments: [
          {
            filename: `chapter3five-vault-${dateTag}.json`,
            content: Buffer.from(emailPayload).toString("base64"),
          },
        ],
      });
      if (error) {
        console.error(`[archive-backup] send to ${to} failed:`, error);
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[archive-backup] send to ${to} failed:`, err);
    }
  }

  // Healthy = the daily copy landed, and on the 27th the email went
  // too. A forced re-run whose email fails is not a failed backup.
  const ok = stored && (!isThe27th || sent > 0);
  await admin.from("cron_runs").insert({
    job: "archive-backup",
    processed: archives.length + codes.length + copies.length,
    duration_ms: Date.now() - startedAt,
    status: ok ? "ok" : "error",
    error: ok
      ? null
      : [
          stored ? null : `snapshot not stored: ${storeError ?? "unknown"}`,
          isThe27th && sent === 0 ? "no snapshot email delivered" : null,
        ]
          .filter(Boolean)
          .join("; "),
  });

  return NextResponse.json(
    {
      ok,
      stored,
      bytes,
      emailed: emailToday,
      sent,
      truncated,
      counts: snapshot.counts,
    },
    { status: ok ? 200 : 500 },
  );
}
