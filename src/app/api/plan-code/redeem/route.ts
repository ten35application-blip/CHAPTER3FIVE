import { NextResponse, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAudit } from "@/lib/notifications";

export const runtime = "nodejs";

/**
 * POST /api/plan-code/redeem — "Have a code?" in Settings (web + phone).
 *
 * A plan code (public.plan_codes, 0174) puts the account on Pro for a
 * month, a year, or forever, for a set number of accounts. All the
 * rules live in the redeem_plan_code RPC, atomically: unknown or
 * disabled → invalid, past expires_at → expired, one redemption per
 * account per code, uses < max_uses. Cookie or Bearer auth so the app
 * can call it. Wilson 2026-09-10: no codes exist yet; this is the slot.
 */

const MESSAGES: Record<string, string> = {
  invalid: "That code didn't open anything. Check it letter by letter and try again.",
  expired: "That code has expired.",
  already_redeemed: "You've already used this code on this account.",
  used_up: "That code has been used the maximum number of times.",
};

const GRANT_LABEL: Record<string, string> = {
  pro_month: "Pro for a month",
  pro_year: "Pro for a year",
  pro_forever: "Pro, for good",
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const auth = request.headers.get("authorization") ?? "";
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) {
      const tokenClient = createPlainClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        { global: { headers: { Authorization: `Bearer ${m[1]}` } } },
      );
      user = (await tokenClient.auth.getUser(m[1])).data.user ?? null;
    }
  }
  if (!user) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  let body: { code?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (code.length < 4 || code.length > 64) {
    return NextResponse.json({ ok: false, error: MESSAGES.invalid }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("redeem_plan_code", { p_user_id: user.id, p_code: code });
  if (error) {
    console.error("[plan-code] redeem rpc failed:", error);
    return NextResponse.json({ ok: false, error: "Something hiccuped. Try again in a moment." }, { status: 500 });
  }
  const result = (data ?? {}) as { ok?: boolean; error?: string; grant?: string; pro_until?: string };
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: MESSAGES[result.error ?? "invalid"] ?? MESSAGES.invalid }, { status: 400 });
  }
  await recordAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    action: "plan_code_redeemed",
    targetUserId: user.id,
    targetId: null,
    details: { grant: result.grant, pro_until: result.pro_until },
  }).catch(() => {});
  return NextResponse.json({
    ok: true,
    grant: result.grant,
    pro_until: result.pro_until,
    message: `${GRANT_LABEL[result.grant ?? ""] ?? "Pro"} is on this account now.`,
  });
}
