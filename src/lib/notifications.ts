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
