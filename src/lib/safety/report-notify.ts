/**
 * Email admins when a user submits a message report.
 *
 * App Store 1.2 requires the report SURFACE (shipped in Phase A);
 * this closes the review-latency gap by pinging the three admin
 * accounts as soon as a report lands, so nobody has to remember
 * to open /admin/reports.
 *
 * Fire-and-forget from after() — the client's report submit never
 * waits on the email. Never throws.
 */

import { ADMIN_EMAILS } from "@/lib/admin/allowlist";
import { resend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export async function notifyAdminsOfReport(args: {
  reportId: string;
  messageId: string;
  reporterUserId: string;
  reason: string;
  notes: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    // Hydrate context: the reported message + its persona + the
    // reporter's email. All best-effort — email still ships even if
    // one lookup fails.
    // allSettled — either hydration rejecting shouldn't kill the email;
    // we degrade to placeholder text instead.
    const [msgRes, reporterRes] = await Promise.allSettled([
      admin
        .from("messages")
        .select("role, content, oracle_id, created_at")
        .eq("id", args.messageId)
        .maybeSingle<{
          role: string;
          content: string | null;
          oracle_id: string | null;
          created_at: string;
        }>(),
      admin.auth.admin.getUserById(args.reporterUserId),
    ]);
    const msg =
      msgRes.status === "fulfilled" ? msgRes.value.data : null;
    const reporter =
      reporterRes.status === "fulfilled" ? reporterRes.value.data : null;

    let oracleName = "unknown persona";
    if (msg?.oracle_id) {
      const { data: oracle } = await admin
        .from("oracles")
        .select("name")
        .eq("id", msg.oracle_id)
        .maybeSingle<{ name: string }>();
      if (oracle?.name) oracleName = oracle.name;
    }
    // Oracle names are user-authored — strip newlines + cap so a
    // crafted name can't break Resend's subject line.
    const safeOracleName = oracleName
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, 80) || "unknown persona";

    const reporterEmail = reporter?.user?.email ?? "unknown reporter";
    const excerpt = (msg?.content ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 500);

    const base =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://chapter3five.app";
    const subject = `[chapter3five reports] ${args.reason} — ${safeOracleName}`;
    const body = [
      `A new user report just landed.`,
      ``,
      `Reason: ${args.reason}`,
      `Reporter: ${reporterEmail}`,
      `Persona: ${safeOracleName}`,
      `Message role: ${msg?.role ?? "unknown"}`,
      `Message id: ${args.messageId}`,
      msg?.created_at ? `Message sent (UTC): ${msg.created_at}` : ``,
      ``,
      `Reported content:`,
      `"""`,
      excerpt || `(no text)`,
      `"""`,
      ``,
      args.notes ? `Reporter notes:\n${args.notes}` : ``,
      ``,
      `Review + resolve in the admin queue:`,
      `${base}/admin/reports`,
    ]
      .filter(Boolean)
      .join("\n");

    await Promise.allSettled(
      ADMIN_EMAILS.map((to) =>
        resend.emails
          .send({
            // hello@ is the verified Resend sender; from-name carries
            // the reports framing so admin inboxes thread cleanly.
            from: "chapter3five reports <hello@chapter3five.app>",
            to,
            subject,
            text: body,
          })
          .catch((err) => {
            console.error(`[reports/notify] send to ${to} failed:`, err);
          }),
      ),
    );
  } catch (err) {
    console.error("[reports/notify] unexpected failure:", err);
  }
}
