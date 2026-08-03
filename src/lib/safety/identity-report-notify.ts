/**
 * Email admins when a user submits an identity-level report — the
 * sibling of report-notify.ts (which handles per-message reports).
 * App Store 1.2 + Play UGC review both expect a "Report this
 * identity" affordance for cases where the whole persona is the
 * issue (drifted persona_prompt, off-brand face-generation) rather
 * than a specific message. Report row lands in
 * public.oracle_reports (0123); this ping wakes the admin inbox so
 * queue latency stays inside the 24h SLA published on /guidelines.
 *
 * Fire-and-forget from after() — the client's submit never waits on
 * Resend. Never throws.
 */

import { ADMIN_EMAILS } from "@/lib/admin/allowlist";
import { resend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";

export async function notifyAdminsOfIdentityReport(args: {
  reportId: string;
  oracleId: string;
  reporterUserId: string;
  reason: string;
  notes: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const [oracleRes, reporterRes] = await Promise.allSettled([
      admin
        .from("oracles")
        .select("name, one_line_hook, is_legacy, is_concierge, created_at")
        .eq("id", args.oracleId)
        .maybeSingle<{
          name: string | null;
          one_line_hook: string | null;
          is_legacy: boolean | null;
          is_concierge: boolean | null;
          created_at: string;
        }>(),
      admin.auth.admin.getUserById(args.reporterUserId),
    ]);
    const oracle =
      oracleRes.status === "fulfilled" ? oracleRes.value.data : null;
    const reporter =
      reporterRes.status === "fulfilled" ? reporterRes.value.data : null;

    // User-authored — strip newlines + cap so a crafted name can't
    // break Resend's subject line.
    const safeName = (oracle?.name ?? "unknown persona")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, 80) || "unknown persona";
    const safeHook = (oracle?.one_line_hook ?? "")
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, 300);
    const reporterEmail = reporter?.user?.email ?? "unknown reporter";
    const kind = oracle?.is_concierge
      ? "concierge"
      : oracle?.is_legacy
        ? "legacy/inherited"
        : "randomized";

    const base =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://chapter3five.app";
    const subject = `[chapter3five reports] identity: ${args.reason} — ${safeName}`;
    const body = [
      `A new IDENTITY-level report just landed (the persona itself, not a specific message).`,
      ``,
      `Reason: ${args.reason}`,
      `Reporter: ${reporterEmail}`,
      `Persona: ${safeName} (${kind})`,
      safeHook ? `One-line: ${safeHook}` : ``,
      `Oracle id: ${args.oracleId}`,
      oracle?.created_at ? `Created (UTC): ${oracle.created_at}` : ``,
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
            from: "chapter3five reports <hello@chapter3five.app>",
            to,
            subject,
            text: body,
          })
          .catch((err) => {
            console.error(
              `[identity-report/notify] send to ${to} failed:`,
              err,
            );
          }),
      ),
    );
  } catch (err) {
    console.error("[identity-report/notify] unexpected failure:", err);
  }
}
