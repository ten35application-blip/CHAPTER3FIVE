import { resend } from "./resend";

const FROM = "chapter3five <noreply@chapter3five.app>";
const CARE_INBOX = process.env.CARE_TEAM_EMAIL ?? "care@chapter3five.app";

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

  return resend.emails.send({
    from: FROM,
    to: CARE_INBOX,
    subject,
    text,
  });
}

export async function sendBeneficiaryDesignationEmail(opts: {
  to: string;
  ownerName: string;
  ownerEmail: string;
}) {
  const subject = `${opts.ownerName} chose you for chapter3five.`;
  const text = `${opts.ownerName} (${opts.ownerEmail}) chose you as a beneficiary on chapter3five.

What this means:
chapter3five is a place where someone answers questions about who they are, while they're alive. The result is an archive — answers, voice, texture — that the people they love can sit with later. ${opts.ownerName} chose you to inherit theirs.

You don't need to do anything yet. If something happens to ${opts.ownerName}, we'll send you a link to access what they left.

— chapter3five
https://chapter3five.app`;

  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    text,
  });
}

export async function sendBeneficiaryActivationEmail(opts: {
  to: string;
  ownerName: string;
  claimUrl: string;
}) {
  const subject = `${opts.ownerName} left this for you.`;
  const text = `We're so sorry.

${opts.ownerName} chose you as a beneficiary of their chapter3five archive. The conversations, the answers, the voice they recorded — it's yours to sit with now.

Open it when you're ready. There's no rush.

${opts.claimUrl}

— chapter3five`;

  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    text,
  });
}

export async function sendOutreachEmail(opts: {
  to: string;
  oracleName: string;
  language: "en" | "es";
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

  return resend.emails.send({
    from: FROM,
    to: opts.to,
    subject,
    text: body,
  });
}
