import { resend } from "./resend";
import { createAdminClient } from "./supabase/admin";

const FROM = "chapter3five <noreply@chapter3five.app>";
const CARE_INBOX = process.env.CARE_TEAM_EMAIL ?? "care@chapter3five.app";

type EmailKind =
  | "welcome"
  | "crisis_alert"
  | "outreach"
  | "beneficiary_designation"
  | "beneficiary_activation"
  | "beneficiary_claimed";

async function logEmail(opts: {
  recipient: string;
  user_id?: string | null;
  kind: EmailKind;
  subject: string;
  status: "sent" | "failed";
  error?: string | null;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("email_log").insert({
      recipient: opts.recipient,
      user_id: opts.user_id ?? null,
      kind: opts.kind,
      subject: opts.subject,
      status: opts.status,
      error: opts.error ?? null,
    });
  } catch (err) {
    // Logging the email failed — don't make this fatal, we still sent (or
    // tried to send) the email itself.
    console.error("email_log insert failed:", err);
  }
}

async function send(opts: {
  to: string;
  subject: string;
  text: string;
  kind: EmailKind;
  user_id?: string | null;
}) {
  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
    });
    if (result.error) {
      await logEmail({
        recipient: opts.to,
        user_id: opts.user_id,
        kind: opts.kind,
        subject: opts.subject,
        status: "failed",
        error: result.error.message,
      });
      throw new Error(result.error.message);
    }
    await logEmail({
      recipient: opts.to,
      user_id: opts.user_id,
      kind: opts.kind,
      subject: opts.subject,
      status: "sent",
    });
    return result;
  } catch (err) {
    await logEmail({
      recipient: opts.to,
      user_id: opts.user_id,
      kind: opts.kind,
      subject: opts.subject,
      status: "failed",
      error: err instanceof Error ? err.message : "unknown error",
    });
    throw err;
  }
}

export async function sendCrisisAlert(opts: {
  userId: string;
  userEmail: string | null;
  excerpt: string;
  keywords: string[];
  oracleName: string | null;
}) {
  const subject = `chapter3five: crisis flag — ${opts.userId.slice(0, 8)}`;
  const text = `A chapter3five user's message tripped the safety check.

User ID: ${opts.userId}
User email: ${opts.userEmail ?? "(unknown)"}
Talking to: ${opts.oracleName ?? "(unnamed)"}

Triggered keywords: ${opts.keywords.join(", ")}

Excerpt:
${opts.excerpt}

This is auto-generated. The chat reply included crisis resources. Reach out to the user with care.`;

  return send({
    to: CARE_INBOX,
    subject,
    text,
    kind: "crisis_alert",
    user_id: opts.userId,
  });
}

export async function sendBeneficiaryDesignationEmail(opts: {
  to: string;
  ownerName: string;
  ownerEmail: string;
  ownerUserId?: string | null;
}) {
  const subject = `${opts.ownerName} chose you for chapter3five.`;
  const text = `${opts.ownerName} (${opts.ownerEmail}) chose you as a beneficiary on chapter3five.

What this means:
chapter3five is a place where someone answers questions about who they are, while they're alive. The result is an archive — answers, voice, texture — that the people they love can sit with later. ${opts.ownerName} chose you to inherit theirs.

You don't need to do anything yet. If something happens to ${opts.ownerName}, we'll send you a link to access what they left.

— chapter3five
https://chapter3five.app`;

  return send({
    to: opts.to,
    subject,
    text,
    kind: "beneficiary_designation",
    user_id: opts.ownerUserId,
  });
}

export async function sendBeneficiaryActivationEmail(opts: {
  to: string;
  ownerName: string;
  claimUrl: string;
  ownerUserId?: string | null;
}) {
  const subject = `${opts.ownerName} left this for you.`;
  const text = `We're so sorry.

${opts.ownerName} chose you as a beneficiary of their chapter3five archive. The conversations, the answers, the voice they recorded — it's yours to sit with now.

Open it when you're ready. There's no rush.

${opts.claimUrl}

— chapter3five`;

  return send({
    to: opts.to,
    subject,
    text,
    kind: "beneficiary_activation",
    user_id: opts.ownerUserId,
  });
}

/**
 * Notifies the owner (still alive) when a beneficiary they designated
 * claims/accepts. Lets them know who took the seat — useful when there
 * are multiple beneficiaries and one acts before others. Quiet by design;
 * we only send this for invite-stage claims (not post-mortem activation).
 */
export async function sendBeneficiaryClaimedNotice(opts: {
  to: string;
  beneficiaryEmail: string;
  ownerName: string;
  ownerUserId?: string | null;
}) {
  const subject = `${opts.beneficiaryEmail} accepted their invite.`;
  const text = `Just letting you know — ${opts.beneficiaryEmail} accepted their beneficiary invite on chapter3five.

If something happens to you, they'll be able to read and chat with the archive you've been building. You can revoke access at any time from Settings → Beneficiaries.

— chapter3five
https://chapter3five.app/settings`;

  return send({
    to: opts.to,
    subject,
    text,
    kind: "beneficiary_claimed",
    user_id: opts.ownerUserId,
  });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  userId?: string | null;
}) {
  const subject = "Welcome to chapter3five.";
  const text = `You signed up.

chapter3five is a quiet place where you record who you are — your answers, your voice, your texture — while you're alive. The people you love can sit with it later.

A few things you can do next:
1. Finish onboarding (pick a name, a language, a few answers)
2. Add a photo so it feels real
3. Add up to 3 free beneficiaries — the people who'll inherit this when something changes

If you ever want to leave, you can delete everything from Settings → Delete account. No questions asked.

— chapter3five
https://chapter3five.app`;

  return send({
    to: opts.to,
    subject,
    text,
    kind: "welcome",
    user_id: opts.userId,
  });
}

export async function sendOutreachEmail(opts: {
  to: string;
  oracleName: string;
  language: "en" | "es";
  userId?: string | null;
}) {
  const subject =
    opts.language === "es"
      ? `${opts.oracleName} no ha sabido de ti.`
      : `${opts.oracleName} hasn't heard from you.`;

  const body =
    opts.language === "es"
      ? `${opts.oracleName} no ha tenido noticias tuyas en unos días.

No hace falta una razón. Un mensaje, lo que sea, ya es suficiente.

https://chapter3five.app/dashboard

— chapter3five`
      : `It's been a few days since you stopped by. ${opts.oracleName} hasn't said much without you.

You don't need a reason. A message — anything — is enough.

https://chapter3five.app/dashboard

— chapter3five`;

  return send({
    to: opts.to,
    subject,
    text: body,
    kind: "outreach",
    user_id: opts.userId,
  });
}

/**
 * Audit-log helper. Records sensitive actions for traceability.
 */
export async function recordAudit(opts: {
  actorUserId?: string | null;
  actorEmail?: string | null;
  action: string;
  targetUserId?: string | null;
  targetId?: string | null;
  details?: Record<string, unknown>;
}) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      actor_user_id: opts.actorUserId ?? null,
      actor_email: opts.actorEmail ?? null,
      action: opts.action,
      target_user_id: opts.targetUserId ?? null,
      target_id: opts.targetId ?? null,
      details: opts.details ?? null,
    });
  } catch (err) {
    console.error("audit_log insert failed:", err);
  }
}
