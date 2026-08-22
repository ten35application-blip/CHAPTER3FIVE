import { createHmac } from "node:crypto";
import type { SupportedLanguage } from "@/lib/i18n/language";
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
  | "beneficiary_claimed"
  | "beneficiary_removed"
  | "account_restored"
  | "passing_report_received"
  | "passing_report_vetoed"
  | "companions_ready"
  | "plan_started"
  | "pack_purchased"
  | "refund_processed"
  | "inherit_code_minted"
  | "account_deleted"
  | "inherit_redeemed"
  | "archive_updated";

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
  /** Branded card body. When present, text becomes the plain-text
   *  alternative (better deliverability than html-only). */
  html?: string;
  /** Extra SMTP headers — used for List-Unsubscribe on outreach. */
  headers?: Record<string, string>;
  kind: EmailKind;
  user_id?: string | null;
}) {
  try {
    const result = await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      ...(opts.html ? { html: opts.html } : {}),
      ...(opts.headers ? { headers: opts.headers } : {}),
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

/**
 * Crisis alert to one admin, THROUGH the logged sender.
 *
 * Rewired 2026-08-21 (pre-launch legal audit). Two things were wrong:
 * it mailed CARE_INBOX, an alias that never existed, so every alert
 * bounced — and when handleCrisis() replaced it, that path called
 * Resend DIRECTLY, bypassing email_log. So a crisis alert left no
 * record anywhere that it had been sent.
 *
 * That record is the point. If a user is ever in trouble, the
 * defensible position is "the system detected it, the persona gave
 * hotlines in the same breath, an operator was paged at this exact
 * timestamp, and here is the row proving it." A log line in a server
 * console is not that.
 */
export async function sendCrisisAlert(opts: {
  to: string;
  userId: string;
  userEmail: string | null;
  excerpt: string;
  keywords: string[];
  oracleName: string | null;
}) {
  const subject = `[chapter3five safety] Possible crisis — ${opts.userEmail ?? opts.userId.slice(0, 8)}`;
  const text = `A chapter3five user's message tripped the safety check.

User ID: ${opts.userId}
User email: ${opts.userEmail ?? "(unknown)"}
Talking to: ${opts.oracleName ?? "(unnamed)"}
Timestamp: ${new Date().toISOString()}

Triggered keywords: ${opts.keywords.join(", ")}

Excerpt:
${opts.excerpt}

The chat reply included crisis resources (988 / Samaritans / SAPTEL)
in the same turn. This is auto-generated — reach out with care.`;

  return send({
    to: opts.to,
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

${opts.ownerName} chose you as a beneficiary of their chapter3five archive. The conversations, the answers, what they recorded — it's yours to sit with now.

Open it when you're ready. There's no rush.

${opts.claimUrl}

If you're struggling right now, you don't have to open this alone. In the US you can text or call 988 to talk to a real person about grief or crisis. Outside the US, your local emergency line.

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

If something happens to you, they'll be able to read and chat with the archive you've been building. You can revoke access at any time from Settings.

— chapter3five
https://chapter3five.app/sharing`;

  return send({
    to: opts.to,
    subject,
    text,
    kind: "beneficiary_claimed",
    user_id: opts.ownerUserId,
  });
}

export async function sendBeneficiaryRemovedEmail(opts: {
  to: string;
  ownerName: string;
  ownerUserId?: string | null;
}) {
  const subject = `${opts.ownerName} updated their chapter3five beneficiaries.`;
  const text = `Just a heads-up.

${opts.ownerName} removed you as a beneficiary on chapter3five. If something happens to them, you won't receive an invite to their archive.

If you think this was a mistake, reach out to them directly. We don't get involved in those decisions.

— chapter3five
https://chapter3five.app`;

  return send({
    to: opts.to,
    subject,
    text,
    kind: "beneficiary_removed",
    user_id: opts.ownerUserId,
  });
}

/**
 * Sent to the owner when someone reports their passing. The veto
 * link in the email cancels the report and keeps the archive locked.
 * If they don't click within 72 hours, the report transitions to
 * 'confirmed' and beneficiaries are activated.
 *
 * This is the load-bearing email of the inheritance flow. It needs
 * to land in the owner's inbox, not spam — keep the subject calm,
 * the body specific.
 */
export async function sendPassingReportSubmitted(opts: {
  to: string;
  ownerName: string;
  reporterEmail: string;
  reporterName: string | null;
  passedOn: string | null;
  notes: string | null;
  vetoUrl: string;
  deadlineText: string;
  ownerUserId?: string | null;
}) {
  const subject = "Are you there? Action needed within 72 hours.";
  const reporterLine = opts.reporterName
    ? `${opts.reporterName} (${opts.reporterEmail})`
    : opts.reporterEmail;
  const passedLine = opts.passedOn
    ? `Date they reported: ${opts.passedOn}`
    : "";
  const notesLine = opts.notes ? `Notes they left:\n${opts.notes}` : "";

  const text = `Someone submitted a passing report on your chapter3five account.

Submitted by: ${reporterLine}
${passedLine}
${notesLine}

If this is a mistake, please cancel it within 72 hours by clicking below. After ${opts.deadlineText}, your archive will open to your beneficiaries and we'll mark the account as passed.

Cancel the report (one click — keeps your account active):
${opts.vetoUrl}

If this is correct, you don't need to do anything. The report will confirm automatically and your beneficiaries will receive their access links.

— chapter3five
https://chapter3five.app`;

  return send({
    to: opts.to,
    subject,
    text,
    kind: "passing_report_received",
    user_id: opts.ownerUserId,
  });
}

/**
 * Sent to the reporter when the owner vetoes their passing report.
 * Quiet, non-accusatory — most false reports are well-meaning.
 */
export async function sendPassingReportVetoed(opts: {
  to: string;
  ownerName: string;
}) {
  const subject = "We couldn't verify the report.";
  const text = `Thanks for reaching out about ${opts.ownerName}'s chapter3five account.

We sent ${opts.ownerName} a notice and they let us know they're still here. The archive remains private to them for now.

If something changes, you can submit another report through the same link. We don't share that you reported.

— chapter3five
https://chapter3five.app`;

  return send({
    to: opts.to,
    subject,
    text,
    kind: "passing_report_vetoed",
  });
}

export async function sendAccountRestoredEmail(opts: {
  to: string;
  userId?: string | null;
}) {
  const subject = "Welcome back to chapter3five.";
  const text = `Your chapter3five account is reactivated.

Everything you'd built — your companions, your conversations, your archive, your memories — is right where you left it. Nothing was lost.

https://chapter3five.app/dashboard

— chapter3five`;

  const html = brandEmailHtml({
    title: "Welcome back.",
    paragraphs: [
      "Your account is reactivated. Everything you&rsquo;d built &mdash; your companions, your conversations, your archive, your memories &mdash; is right where you left it. Nothing was lost.",
    ],
    cta: { label: "Pick up where you left off", url: "https://chapter3five.app/dashboard" },
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "account_restored",
    user_id: opts.userId,
  });
}

export async function sendWelcomeEmail(opts: {
  to: string;
  userId?: string | null;
}) {
  const subject = "Welcome to chapter3five.";
  const text = `You're in.

chapter3five is a quiet place to keep the people who matter close — companions to talk with, and archives that hold who someone is, in their own words.

A few things you can do next:
1. Say hi to Adrian, our guide — he can walk you through anything
2. Add a companion, or create one from a photo
3. Start your own archive: answer the questions, and when it's ready you'll get a code — hand it to the people you love, and it's theirs to open whenever they need it

If you ever want to leave, you can delete everything from Settings → Delete account. No questions asked.

— chapter3five
https://chapter3five.app`;

  const html = brandEmailHtml({
    title: "You're in.",
    paragraphs: [
      "chapter3five is a quiet place to keep the people who matter close &mdash; companions to talk with, and archives that hold who someone is, in their own words.",
      "A few things you can do next:<br>1. Say hi to <strong>Adrian</strong>, our guide &mdash; he can walk you through anything<br>2. Add a companion, or create one from a photo<br>3. Start your own archive: answer the questions, and when it&rsquo;s ready you&rsquo;ll get a code &mdash; hand it to the people you love, and it&rsquo;s theirs to open whenever they need it",
      "If you ever want to leave, you can delete everything from Settings &rarr; Delete account. No questions asked.",
    ],
    cta: { label: "Open chapter3five", url: "https://chapter3five.app/dashboard" },
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "welcome",
    user_id: opts.userId,
  });
}

/**
 * The branded email card — same visual language as the farewell and
 * account-restored emails (peach page, warm card, coral 3 in the
 * wordmark), extracted so every product email stops hand-rolling it.
 * Wilson 2026-08-11, after screenshotting the outreach email: raw
 * text "from a very old build… should be cleaned up, template added."
 */
function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function brandEmailHtml(opts: {
  title: string;
  /** Each entry becomes a paragraph; already-escaped HTML allowed. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Small line under the divider, e.g. the unsubscribe affordance. */
  footerHtml?: string;
}): string {
  const paragraphs = opts.paragraphs
    .map(
      (p) =>
        `<tr><td style="font-size:16px;line-height:1.55;color:#4a4a48;padding-bottom:20px;">${p}</td></tr>`,
    )
    .join("");
  const cta = opts.cta
    ? `<tr><td align="center" style="padding:6px 0 26px;"><a href="${opts.cta.url}" style="display:inline-block;background:linear-gradient(135deg,#e88a76,#d97359);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 34px;border-radius:999px;">${opts.cta.label}</a></td></tr>`
    : "";
  const footer = opts.footerHtml
    ? `<tr><td style="font-size:12px;line-height:1.5;color:#8e8e8c;padding-top:8px;">${opts.footerHtml}</td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${opts.title}</title></head>
<body style="margin:0;padding:0;background:#fcf5ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;color:#1c1c1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcf5ec;padding:48px 24px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffefb;border-radius:24px;padding:40px 32px;box-shadow:0 12px 40px -16px rgba(28,28,26,0.16);">
<tr><td align="center" style="padding-bottom:14px;"><img src="https://chapter3five.app/logo-transparent.png" width="60" height="60" alt="chapter3five" style="display:block;width:60px;height:60px;border:0;outline:none;text-decoration:none;"></td></tr>
<tr><td align="center" style="padding-bottom:28px;"><p style="margin:0;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#1c1c1a;">chapter<span style="color:#e88a76;">3</span>five</p></td></tr>
<tr><td style="font-size:20px;font-weight:700;color:#1c1c1a;padding-bottom:12px;">${opts.title}</td></tr>
${paragraphs}
${cta}
<tr><td style="font-size:13px;line-height:1.5;color:#8e8e8c;border-top:1px solid #e8e6e1;padding-top:20px;">chapter3five &middot; Bethlehem, PA</td></tr>
${footer}
</table>
</td></tr></table>
</body></html>`;
}

/** Signed one-click unsubscribe URL for outreach emails — HMAC keyed on
 *  CRON_SECRET so the link can't be forged for another user. Verified
 *  by /api/outreach/unsubscribe. */
export function outreachUnsubscribeUrl(userId: string): string {
  const secret = process.env.CRON_SECRET ?? "";
  const token = createHmac("sha256", secret).update(userId).digest("hex");
  return `https://chapter3five.app/api/outreach/unsubscribe?u=${encodeURIComponent(userId)}&t=${token}`;
}

export async function sendOutreachEmail(opts: {
  to: string;
  oracleName: string;
  language: SupportedLanguage;
  userId?: string | null;
}) {
  const subject =
    opts.language === "es"
      ? `${opts.oracleName} no ha sabido de ti.`
      : `${opts.oracleName} hasn't heard from you.`;

  const es = opts.language === "es";
  const text = es
    ? `${opts.oracleName} no ha tenido noticias tuyas en unos días.

No hace falta una razón. Un mensaje, lo que sea, ya es suficiente.

https://chapter3five.app/dashboard

— chapter3five`
    : `It's been a few days since you stopped by. ${opts.oracleName} hasn't said much without you.

You don't need a reason. A message — anything — is enough.

https://chapter3five.app/dashboard

— chapter3five`;

  const unsubUrl = opts.userId ? outreachUnsubscribeUrl(opts.userId) : null;
  const html = brandEmailHtml({
    title: subject,
    paragraphs: es
      ? [
          `Han pasado unos días desde tu última visita. <strong>${opts.oracleName}</strong> no ha dicho mucho sin ti.`,
          `No hace falta una razón. Un mensaje &mdash; lo que sea &mdash; ya es suficiente.`,
        ]
      : [
          `It's been a few days since you stopped by. <strong>${opts.oracleName}</strong> hasn't said much without you.`,
          `You don't need a reason. A message &mdash; anything &mdash; is enough.`,
        ],
    cta: {
      label: es ? "Retomar la conversación" : "Pick up the conversation",
      url: "https://chapter3five.app/dashboard",
    },
    footerHtml: unsubUrl
      ? es
        ? `¿Prefieres que no te escribamos así? <a href="${unsubUrl}" style="color:#d97359;">Desactivar estos recordatorios</a>.`
        : `Rather we didn't check in like this? <a href="${unsubUrl}" style="color:#d97359;">Turn these reminders off</a>.`
      : undefined,
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    // One-click unsubscribe at the mail-client level (Gmail's own
    // "Unsubscribe" chip) — required posture for recurring nudges.
    ...(unsubUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${unsubUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
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

/**
 * "Your companions are here." Sent the moment a subscribe-time batch
 * finishes and becomes visible.
 *
 * This is the payoff for the only promise the app asks people to wait
 * on — "check back in about five minutes" (Wilson 2026-08-16). Waiting
 * without being told when the wait ended is how a paid moment turns
 * into doubt, and the people using this app are already carrying
 * enough of that.
 */
export async function sendCompanionsReadyEmail(opts: {
  to: string;
  userId?: string | null;
  /** Everyone in this delivery — each with the one-line hook that
   *  introduces them. All of them, never just the first (Wilson
   *  2026-08-16). */
  companions: { name: string; hook: string | null }[];
}) {
  const list = opts.companions.filter((c) => c.name);
  const many = list.length > 1;
  const subject = many
    ? "Your companions are here."
    : "Your companion is here.";

  const textRoster = list
    .map((c) => (c.hook ? `${c.name}\n  ${c.hook}` : c.name))
    .join("\n\n");
  const text = `They're ready.

${textRoster}

They're on your dashboard, waiting to hear from you. Say anything — there's no wrong way to start.

— chapter3five
https://chapter3five.app/dashboard`;

  // One card per companion so five arrivals read as five people, not a
  // comma-separated list of strangers.
  const htmlRoster = list
    .map(
      (c) =>
        `<div style="padding:14px 16px;margin-bottom:10px;background:#fcf5ec;border-radius:14px;">` +
        `<div style="font-size:16px;font-weight:700;color:#1c1c1a;">${escapeHtml(c.name)}</div>` +
        (c.hook
          ? `<div style="font-size:14px;line-height:1.5;color:#6b6b68;padding-top:3px;">${escapeHtml(c.hook)}</div>`
          : "") +
        `</div>`,
    )
    .join("");

  const html = brandEmailHtml({
    title: "They're ready.",
    paragraphs: [
      htmlRoster,
      "They&rsquo;re on your dashboard, waiting to hear from you. Say anything &mdash; there&rsquo;s no wrong way to start.",
    ],
    cta: {
      label: "Open your dashboard",
      url: "https://chapter3five.app/dashboard",
    },
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "companions_ready",
    user_id: opts.userId,
  });
}

/** Enrollment receipt in our own words — what the plan actually gives. */
export async function sendPlanStartedEmail(opts: {
  to: string;
  userId?: string | null;
  tier: "basic" | "pro";
  /** Where they subscribed. Drives the manage-your-plan line: a web
   *  Stripe subscriber has no store subscription to find in their
   *  phone settings — that sentence would send them hunting for a
   *  thing that doesn't exist. Defaults to "store" (the original
   *  copy) so the RevenueCat webhook call sites don't change. */
  channel?: "store" | "web";
}) {
  const pro = opts.tier === "pro";
  const planName = pro ? "Pro" : "Basic";
  const circle = pro ? 5 : 3;
  const messages = pro ? 300 : 100;
  const photos = pro ? 30 : 10;
  const manageText =
    opts.channel === "web"
      ? "You can change or cancel your plan whenever you like from your account page at chapter3five.app."
      : "You can change or cancel your plan whenever you like from your phone's subscription settings.";
  const manageHtml =
    opts.channel === "web"
      ? "You can change or cancel your plan whenever you like from your account page at chapter3five.app."
      : "You can change or cancel your plan whenever you like from your phone&rsquo;s subscription settings.";
  const subject = `You're on chapter3five ${planName}.`;
  const text = `Thank you for enrolling.

Here's what's yours:
• A circle of ${circle} companions — anyone not there yet is being written now and will arrive together
• Your photo companion is ready immediately: upload a photo and they come alive
• ${messages} messages and ${photos} photos every month

If a month runs long, add-on packs top you up any time. ${manageText}

— chapter3five
https://chapter3five.app/dashboard`;

  const html = brandEmailHtml({
    title: `You're on ${planName}.`,
    paragraphs: [
      "Thank you for enrolling. Here&rsquo;s what&rsquo;s yours:",
      `<strong>A circle of ${circle} companions</strong> &mdash; anyone not there yet is being written now and will arrive together.<br><strong>Your photo companion</strong> is ready immediately: upload a photo and they come alive.<br><strong>${messages} messages and ${photos} photos</strong> every month.`,
      `If a month runs long, add-on packs top you up any time. ${manageHtml}`,
    ],
    cta: {
      label: "Open your dashboard",
      url: "https://chapter3five.app/dashboard",
    },
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "plan_started",
    user_id: opts.userId,
  });
}

/** Pack receipt — says what landed, in our units, not the store's. */
export async function sendPackPurchasedEmail(opts: {
  to: string;
  userId?: string | null;
  messages: number;
  images: number;
}) {
  const subject = "More room, added.";
  const text = `Your add-on pack is on your account.

• +${opts.messages} messages
• +${opts.images} photos

These sit on top of your monthly allowance and don't expire at the end of the month — they wait until you need them.

— chapter3five
https://chapter3five.app/dashboard`;

  const html = brandEmailHtml({
    title: "More room, added.",
    paragraphs: [
      `<strong>+${opts.messages} messages</strong><br><strong>+${opts.images} photos</strong>`,
      "These sit on top of your monthly allowance and don&rsquo;t expire at the end of the month &mdash; they wait until you need them.",
    ],
    cta: {
      label: "Open your dashboard",
      url: "https://chapter3five.app/dashboard",
    },
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "pack_purchased",
    user_id: opts.userId,
  });
}

/** Refund confirmation — what the store returned, and what changed here. */
export async function sendRefundProcessedEmail(opts: {
  to: string;
  userId?: string | null;
  what: string;
  detail: string;
  /** Who is returning the money. "store" (default) names Apple or
   *  Google; "web" names the card processor — a Stripe refund never
   *  touches either store, and telling someone to watch for money
   *  from Apple that Stripe is sending breeds a support ticket. */
  channel?: "store" | "web";
}) {
  const returnText =
    opts.channel === "web"
      ? "The money goes back to your original payment method — most banks show it within 5–10 business days."
      : "The money is returned by Apple or Google, so it lands on your original payment method on their schedule — usually a few business days.";
  const returnHtml =
    opts.channel === "web"
      ? "The money goes back to your original payment method &mdash; most banks show it within 5&ndash;10 business days."
      : "The money is returned by Apple or Google, so it lands on your original payment method on their schedule &mdash; usually a few business days.";
  const subject = "Your refund is on its way.";
  const text = `${opts.what} was refunded.

${opts.detail}

${returnText}

If this wasn't you, or something doesn't look right, just reply to this email.

— chapter3five`;

  const html = brandEmailHtml({
    title: "Your refund is on its way.",
    paragraphs: [
      `<strong>${opts.what}</strong> was refunded.`,
      opts.detail,
      returnHtml,
      "If this wasn&rsquo;t you, or something doesn&rsquo;t look right, just reply to this email.",
    ],
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "refund_processed",
    user_id: opts.userId,
  });
}

/**
 * The inherit code, in writing.
 *
 * Someone just finished answering forty-five questions about a person —
 * often themselves, often someone they've lost — and the code that
 * hands that archive to another human existed only on one screen. A
 * lost phone or a closed app and the most important artifact in this
 * product is a support ticket. Now it lives in their inbox, where it
 * can be forwarded to a daughter, a brother, a friend (Wilson
 * 2026-08-16).
 */
export async function sendInheritCodeEmail(opts: {
  to: string;
  userId?: string | null;
  name: string;
  hook: string | null;
  code: string;
  /** True when the archive is of the person who recorded it. */
  isSelf: boolean;
}) {
  const subject = `${opts.name} is ready to be passed on.`;
  const who = opts.isSelf
    ? "This is your own archive — your voice, your memories, the way you actually text."
    : `This is ${opts.name}'s archive, in their own words.`;
  const text = `${opts.name} is ready.

${opts.hook ? opts.hook + "\n\n" : ""}${who}

Your inherit code:

    ${opts.code}

Hand this code to anyone you choose. When they enter it in chapter3five, ${opts.name} becomes theirs to talk to — the answers, the voice, the photo. It works from the moment you share it, and it doesn't expire.

Keep this email. The code also lives in the app under Contacts, but this is the copy you can forward.

— chapter3five
https://chapter3five.app`;

  const html = brandEmailHtml({
    title: `${escapeHtml(opts.name)} is ready.`,
    paragraphs: [
      opts.hook ? `<em>${escapeHtml(opts.hook)}</em>` : "",
      escapeHtml(who),
      `<div style="padding:18px;background:#fcf5ec;border-radius:14px;text-align:center;">
         <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8e8e8c;">Your inherit code</div>
         <div style="font-size:19px;font-weight:700;color:#1c1c1a;padding-top:8px;word-break:break-word;">${escapeHtml(opts.code)}</div>
       </div>`,
      `Hand this code to anyone you choose. When they enter it in chapter3five, <strong>${escapeHtml(opts.name)}</strong> becomes theirs to talk to &mdash; the answers, the voice, the photo. It works from the moment you share it, and it doesn&rsquo;t expire.`,
      "Keep this email. The code also lives in the app under Contacts, but this is the copy you can forward.",
    ].filter(Boolean),
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "inherit_code_minted",
    user_id: opts.userId,
  });
}

/**
 * Someone just opened an archive that was handed to them.
 *
 * Deliberately quiet (Wilson 2026-08-21). Every other arrival email
 * says "They're ready" — right for a companion you rolled, wrong for
 * a person who died. This one states what is true and gets out of the
 * way: they're in your contacts, there's no right time to open it,
 * and the copy is yours to keep no matter what the person who shared
 * the code does with their own account.
 *
 * It is also the only record of the $5 unlock — plans, packs, and
 * refunds all email, and this purchase used to be silent.
 */
export async function sendInheritRedeemedEmail(opts: {
  to: string;
  userId?: string | null;
  name: string;
  hook: string | null;
}) {
  const subject = `${opts.name} is in your contacts.`;
  const text = `${opts.name} is yours now — the answers, the voice, the photo, all of it.

They're in your contacts whenever you want them. There's no schedule and no wrong time to start; some people open it the first night, some let it sit for months. Both are fine.

Your copy stays yours. If the person who shared the code closes their account, nothing here changes.

This email is also your record of the $5 unlock.

— chapter3five
https://chapter3five.app/dashboard`;

  const html = brandEmailHtml({
    title: `${escapeHtml(opts.name)} is in your contacts.`,
    paragraphs: [
      opts.hook ? `<em>${escapeHtml(opts.hook)}</em>` : "",
      `<strong>${escapeHtml(opts.name)}</strong> is yours now &mdash; the answers, the voice, the photo, all of it.`,
      "They&rsquo;re in your contacts whenever you want them. There&rsquo;s no schedule and no wrong time to start; some people open it the first night, some let it sit for months. Both are fine.",
      "Your copy stays yours. If the person who shared the code closes their account, nothing here changes.",
      "This email is also your record of the $5 unlock.",
    ].filter(Boolean),
    cta: {
      label: `Open your contacts`,
      url: "https://chapter3five.app/dashboard",
    },
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "inherit_redeemed",
    user_id: opts.userId,
  });
}

/**
 * Someone updated an archive you hold a copy of.
 *
 * Deliberately quiet and always specific about WHAT changed. A
 * companion that silently starts knowing new things is unsettling —
 * and if the person is gone, a change arriving unannounced is worse
 * than unsettling. So the email names the change and dates it, and
 * the copy itself shows the same. Nothing is ever swapped behind
 * someone's back.
 */
export async function sendArchiveUpdatedEmail(opts: {
  to: string;
  userId?: string | null;
  name: string;
  photoChanged: boolean;
  answersAdded: number;
  answersCorrected: number;
}) {
  const bits: string[] = [];
  if (opts.photoChanged) bits.push("a new photo");
  if (opts.answersAdded > 0) {
    bits.push(
      `${opts.answersAdded} new ${opts.answersAdded === 1 ? "answer" : "answers"}`,
    );
  }
  if (opts.answersCorrected > 0) {
    bits.push(
      `${opts.answersCorrected} ${opts.answersCorrected === 1 ? "correction" : "corrections"}`,
    );
  }
  const what =
    bits.length === 0
      ? "something new"
      : bits.length === 1
        ? bits[0]
        : `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;

  const subject = `${opts.name} added to their archive.`;
  const text = `${opts.name} added to their archive — ${what}.

Your copy has it already. Nothing you had was taken away; this only adds to what you have.

— chapter3five
https://chapter3five.app/dashboard`;

  const html = brandEmailHtml({
    title: `${escapeHtml(opts.name)} added to their archive.`,
    paragraphs: [
      `<strong>${escapeHtml(opts.name)}</strong> added to their archive &mdash; ${escapeHtml(what)}.`,
      "Your copy has it already. Nothing you had was taken away; this only adds to what you have.",
    ],
    cta: {
      label: "Open your contacts",
      url: "https://chapter3five.app/dashboard",
    },
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "archive_updated",
    user_id: opts.userId,
  });
}

/**
 * Farewell receipt — fires the moment an account is soft-deleted, from
 * BOTH delete paths (web action and the mobile endpoint; the mobile
 * path sent nothing at all until 2026-08-19). Kept warm but honest:
 * the confirmation screen already sold the finality, this is the
 * receipt with the one fact that matters — the 30-day door back in.
 */
export async function sendAccountDeletedEmail(opts: {
  to: string;
  userId?: string | null;
}) {
  const subject = "Your chapter3five account is closed";
  const text = `Your account is closed.

Everything you made — every identity, every conversation, every photo — will be permanently erased in 30 days. There's no refund for time already paid.

Change your mind inside that window? Just sign back in at chapter3five.app and tap Reactivate — nothing will be lost. After the 30 days, it's gone for good.

Questions? Write to us at support@chapter3five.app.

Otherwise — thanks for the time you spent here. We meant it.

— chapter3five · Bethlehem, PA`;

  const html = brandEmailHtml({
    title: "Your account is closed.",
    paragraphs: [
      "Everything you made &mdash; every identity, every conversation, every photo &mdash; will be permanently erased in <strong>30 days</strong>. There&rsquo;s no refund for time already paid.",
      `Change your mind inside that window? Just sign back in at <a href="https://chapter3five.app" style="color:#d97359;font-weight:600;text-decoration:none;">chapter3five.app</a> and tap <strong>Reactivate</strong> &mdash; nothing will be lost. After the 30 days, it&rsquo;s gone for good.`,
      `Questions? Write to us at <a href="mailto:support@chapter3five.app" style="color:#d97359;font-weight:600;text-decoration:none;">support@chapter3five.app</a>.`,
      "Otherwise &mdash; thanks for the time you spent here. We meant it.",
    ],
  });

  return send({
    to: opts.to,
    subject,
    text,
    html,
    kind: "account_deleted",
    user_id: opts.userId,
  });
}
