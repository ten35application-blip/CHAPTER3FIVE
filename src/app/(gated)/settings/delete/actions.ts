"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { redirectWithError } from "@/lib/action-errors";
import { resend } from "@/lib/resend";

/**
 * Marks the profile soft-deleted (0024 grace-period pattern), soft-deletes
 * all their oracles in the same stroke, signs the user out, and lands
 * them on the "you're out" landing.
 *
 * The 30-day grace window exists at the DB level so a genuine "wait no"
 * remains technically recoverable via admin — but the UX presents this
 * as final. That's the contract we advertised on the confirmation page.
 *
 * The hard purge happens later via a scheduled sweep (out of scope for
 * this action); until then a re-sign-in with the same email during the
 * 30 days would find profiles.deleted_at set and be treated as deleted.
 */
export async function deleteAccount(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const typed = String(formData.get("email_confirmation") ?? "").trim().toLowerCase();
  const actual = (user.email ?? "").trim().toLowerCase();
  if (!typed || typed !== actual) {
    redirectWithError(
      "/settings/delete",
      "That doesn't match the email on this account. Try again — or hit back to leave everything alone.",
    );
  }

  const now = new Date().toISOString();

  // Mark the profile deleted (grace-period flag). RLS allows this via
  // the "users can update their own profile" policy from 0001.
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ deleted_at: now })
    .eq("id", user.id);
  if (profileErr) {
    redirectWithError(
      "/settings/delete",
      "Something went wrong ending the account. Give it a minute and try once more.",
      profileErr,
    );
  }

  // Cascade the delete flag to their oracles so nothing lingers on the
  // dashboard mid-signout.
  await supabase
    .from("oracles")
    .update({ deleted_at: now })
    .eq("user_id", user.id)
    .is("deleted_at", null);

  // Farewell email — best-effort, non-blocking. Supabase doesn't have a
  // built-in "account deleted" template, so this is a plain Resend send
  // from the same domain as the auth templates. If it fails we don't
  // stop the flow — the user is already signed out on the next line.
  if (user.email) {
    const to = user.email;
    void sendGoodbyeEmail(to).catch((err) => {
      console.error("[delete-account] farewell email failed:", err);
    });
  }

  await supabase.auth.signOut();
  redirect("/account-deleted");
}

/**
 * Farewell email. Kept warm but honest — the confirmation copy on
 * /settings/delete already sold the finality; this is a receipt, not
 * another warning.
 */
async function sendGoodbyeEmail(to: string): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Your chapter3five account is closed</title></head>
<body style="margin:0;padding:0;background:#fcf5ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;color:#1c1c1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcf5ec;padding:48px 24px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fffefb;border-radius:24px;padding:40px 32px;box-shadow:0 12px 40px -16px rgba(28,28,26,0.16);">
<tr><td align="center" style="padding-bottom:28px;"><p style="margin:0;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:#1c1c1a;">chapter<span style="color:#e88a76;">3</span>five</p></td></tr>
<tr><td style="font-size:20px;font-weight:700;color:#1c1c1a;padding-bottom:12px;">Your account is closed.</td></tr>
<tr><td style="font-size:16px;line-height:1.55;color:#4a4a48;padding-bottom:20px;">Every identity you made, every conversation, every photo — it&rsquo;s all been ended. There&rsquo;s no refund, and the account can&rsquo;t be brought back.</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#4a4a48;padding-bottom:20px;">If this was an accident and you&rsquo;re reading this within a few hours, write to us at <a href="mailto:support@chapter3five.app" style="color:#d97359;font-weight:600;text-decoration:none;">support@chapter3five.app</a> quickly and we&rsquo;ll do what we can.</td></tr>
<tr><td style="font-size:15px;line-height:1.55;color:#4a4a48;padding-bottom:20px;">Otherwise &mdash; thanks for the time you spent here. We meant it.</td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#8e8e8c;border-top:1px solid #e8e6e1;padding-top:20px;">chapter3five &middot; Bethlehem, PA</td></tr>
</table>
</td></tr></table>
</body></html>`;

  await resend.emails.send({
    from: "chapter3five <hello@chapter3five.app>",
    to,
    subject: "Your chapter3five account is closed",
    html,
  });
}
