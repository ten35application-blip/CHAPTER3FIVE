import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * One-click unsubscribe for the outreach check-in emails.
 *
 * Exists because the Settings consolidation (2026-08-06) removed the
 * in-app outreach toggle, which left email recipients with NO
 * self-serve way to stop these — a CAN-SPAM problem and, worse, a
 * decency problem: a grieving person who finds the reminders painful
 * should not have to write to support to make them stop.
 *
 * The link is signed (HMAC of the user id, keyed on CRON_SECRET — the
 * same secret that gates the cron that SENDS these), so nobody can
 * unsubscribe someone else by guessing ids. Serves both the email
 * footer link and the mail client's own List-Unsubscribe chip; the
 * POST handler is what Gmail's one-click header flow calls.
 *
 * Writes profiles.outreach_enabled = false — the exact column every
 * outreach cron filters on, so OFF means the message is never composed
 * at all, not merely hidden.
 */

function verify(userId: string, token: string): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !userId || !token) return false;
  const expected = createHmac("sha256", secret).update(userId).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function unsubscribe(userId: string): Promise<boolean> {
  const { error } = await createAdminClient()
    .from("profiles")
    .update({ outreach_enabled: false })
    .eq("id", userId);
  return !error;
}

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${title}</title></head>
<body style="margin:0;padding:48px 24px;background:#fcf5ec;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,system-ui,sans-serif;color:#1c1c1a;">
<div style="max-width:480px;margin:0 auto;background:#fffefb;border-radius:24px;padding:40px 32px;box-shadow:0 12px 40px -16px rgba(28,28,26,0.16);text-align:center;">
<p style="margin:0 0 24px;font-size:18px;font-weight:700;">chapter<span style="color:#e88a76;">3</span>five</p>
<h1 style="margin:0 0 12px;font-size:20px;">${title}</h1>
<p style="margin:0;font-size:15px;line-height:1.55;color:#4a4a48;">${body}</p>
</div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u") ?? "";
  const t = request.nextUrl.searchParams.get("t") ?? "";
  if (!verify(u, t)) {
    return page(
      "That link didn't work",
      "It may be old or incomplete. You can also turn check-ins off from Settings inside the app, or write to hello@chapter3five.app.",
    );
  }
  const ok = await unsubscribe(u);
  return ok
    ? page(
        "You won't get these check-ins anymore.",
        "Your companions are still here whenever you want them — this only stops the emails. Changed your mind? Write to hello@chapter3five.app.",
      )
    : page(
        "Something went sideways",
        "Give the link one more try in a moment, or write to hello@chapter3five.app and we'll turn it off by hand.",
      );
}

/** Gmail/Yahoo one-click (RFC 8058) POST with no body semantics. */
export async function POST(request: NextRequest) {
  const u = request.nextUrl.searchParams.get("u") ?? "";
  const t = request.nextUrl.searchParams.get("t") ?? "";
  if (!verify(u, t)) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const ok = await unsubscribe(u);
  return NextResponse.json(ok ? { ok: true } : { error: "failed" }, {
    status: ok ? 200 : 500,
  });
}
