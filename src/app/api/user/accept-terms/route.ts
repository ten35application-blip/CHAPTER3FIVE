import { NextResponse, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/version";

export const runtime = "nodejs";

/**
 * Mobile-callable terms-acceptance endpoint. Mirrors the acceptTerms
 * server action used by the web /onboarding page (src/app/onboarding/
 * actions.ts) — same admin-client write to profiles.terms_accepted_at
 * + terms_version_accepted (0087 blocks authenticated-role writes to
 * those columns), same terms_acceptances ledger append (0086) with
 * IP + user agent + email captured server-side, same 60-second dedupe
 * window against rapid double-submits.
 *
 * Without this endpoint, mobile-onboarded users can never satisfy
 * the /api/chat requireTermsAccepted gate — every message 428s
 * forever. Fable audit 2026-07-28.
 *
 * Auth: cookie OR Bearer (same pattern as /api/user/delete-account
 * and /api/chat) so Expo can call it. Idempotent: submitting the
 * same version twice is a no-op on the profile column and dedupes
 * on the ledger.
 */
export async function POST(request: NextRequest) {
  // Cookie-first, then Bearer.
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
      const r = await tokenClient.auth.getUser(m[1]);
      user = r.data.user ?? null;
    }
  }
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Belt-and-suspenders: the mobile client only sends the accept POST
  // after every disclosure checkbox is checked, but a hand-crafted
  // POST shouldn't be able to skip an explicit acknowledgment.
  let body: { agree?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (body.agree !== true) {
    return NextResponse.json(
      { error: "agree_required" },
      { status: 400 },
    );
  }

  // Admin write: 0087 trigger blocks authenticated-role writes to
  // terms_accepted_at / terms_version_accepted so a mobile client
  // can't PATCH the columns directly. Service role bypasses the
  // trigger — the correct path for an audited acceptance flow.
  //
  // Post 2026-07-29 reset: mobile agreements is the LAST step of
  // onboarding. The 355-question flow was scrapped; new signups
  // land straight in the Adrian chat. So the server also sets
  // active_oracle_id + oracle_name + onboarding_completed here in
  // the same transaction so a fresh mobile user is chat-ready the
  // moment they tap "I agree." Existing users with an
  // active_oracle_id keep it (this only fills in missing values).
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("active_oracle_id, oracle_name, onboarding_completed")
    .eq("id", user.id)
    .maybeSingle<{
      active_oracle_id: string | null;
      oracle_name: string | null;
      onboarding_completed: boolean | null;
    }>();

  const CONCIERGE_ORACLE_ID = "1648e299-748a-488b-95c2-9d040673d36b";
  const CONCIERGE_NAME = "Adrian";

  const { error: upsertErr } = await admin.from("profiles").upsert({
    id: user.id,
    terms_accepted_at: new Date().toISOString(),
    terms_version_accepted: CURRENT_TERMS_VERSION,
    // Only set defaults if the caller doesn't already have them --
    // an inherited-code user might have a different active oracle
    // that we don't want to overwrite.
    active_oracle_id: existing?.active_oracle_id ?? CONCIERGE_ORACLE_ID,
    oracle_name: existing?.oracle_name ?? CONCIERGE_NAME,
    onboarding_completed: true,
  });
  if (upsertErr) {
    console.error("[accept-terms] profile upsert failed:", upsertErr);
    return NextResponse.json(
      { error: "profile_update_failed" },
      { status: 500 },
    );
  }

  // Ledger append with IP + user agent + email — best-effort. The
  // profile column already carries the gate signal, so a ledger
  // failure doesn't block the caller (matches the web action).
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : (request.headers.get("x-real-ip") ?? null);
    const userAgent = request.headers.get("user-agent");
    // 60-second dedupe against rapid retries (double-tap, refresh).
    const cutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: recent } = await admin
      .from("terms_acceptances")
      .select("id")
      .eq("user_id", user.id)
      .eq("terms_version", CURRENT_TERMS_VERSION)
      .gt("accepted_at", cutoff)
      .limit(1)
      .maybeSingle();
    if (!recent) {
      const { error: ledgerErr } = await admin
        .from("terms_acceptances")
        .insert({
          user_id: user.id,
          user_email: user.email ?? null,
          terms_version: CURRENT_TERMS_VERSION,
          ip_address: ip,
          user_agent: userAgent,
        });
      // 23505 = duplicate on the (user_id, terms_version) unique
      // index from 0089. Concurrent double-submit that slipped past
      // the read-check; the losing insert is the idempotent no-op.
      if (ledgerErr && ledgerErr.code !== "23505") {
        console.error(
          "[accept-terms] terms_acceptances ledger insert failed:",
          ledgerErr,
        );
      }
    }
  } catch (err) {
    console.error("[accept-terms] terms_acceptances ledger threw:", err);
  }

  return NextResponse.json({
    ok: true,
    version: CURRENT_TERMS_VERSION,
  });
}
