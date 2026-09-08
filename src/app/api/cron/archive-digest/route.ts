import { NextResponse, type NextRequest } from "next/server";
import { authorizeCronTick } from "@/lib/cronTick";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendArchiveUpdatedEmail } from "@/lib/notifications";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Sends the batched "X added to their archive" emails (0170). Hourly.
 * A notice is due once the recorder has been quiet for 3 hours
 * (updateArchive.ts pushes due_at on every change). Each row is
 * deleted the moment its mail is sent, so a re-run can't double-send.
 */
export async function GET(request: NextRequest) {
  if (!(await authorizeCronTick(request, "archive_digest", 30))) {
    return NextResponse.json({ ok: false, skipped: true });
  }
  const admin = createAdminClient();
  const { data: due } = await admin
    .from("archive_update_notices")
    .select("copy_id, user_id, source_name, photo_changed, answers_added, answers_corrected")
    .lte("due_at", new Date().toISOString())
    .limit(200);
  let sent = 0;
  for (const n of due ?? []) {
    try {
      // Claim first: delete wins the row; a parallel tick finds nothing.
      const { data: claimed } = await admin
        .from("archive_update_notices")
        .delete()
        .eq("copy_id", n.copy_id as string)
        .select("copy_id");
      if (!claimed || claimed.length === 0) continue;
      const { data: authRes } = await admin.auth.admin.getUserById(n.user_id as string);
      const email = authRes?.user?.email;
      if (!email) continue;
      await sendArchiveUpdatedEmail({
        to: email,
        userId: n.user_id as string,
        name: (n.source_name as string) || "Someone",
        photoChanged: Boolean(n.photo_changed),
        answersAdded: Number(n.answers_added ?? 0),
        answersCorrected: Number(n.answers_corrected ?? 0),
      });
      sent++;
    } catch (err) {
      console.error("[archive-digest] failed for copy", n.copy_id, err);
    }
  }
  return NextResponse.json({ ok: true, due: (due ?? []).length, sent });
}
