import { NextResponse, type NextRequest } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CURRENT_TERMS_VERSION } from "@/lib/legal/version";
import { sendWelcomeEmail } from "@/lib/notifications";
import {
  ALLOWED_DOCS,
  coerceDocs,
  extractClientNet,
  writePerDocAgreements,
} from "@/lib/legal/acceptance";

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
  //
  // The forward-going contract sends BOTH `agree: true` AND the full
  // docs list — the per-doc ledger write in public.agreements is the
  // audit record for exactly what was consented to. Legacy grace
  // window: if `docs` is omitted entirely (a mobile bundle that hasn't
  // OTA'd to the beef-up build yet), we accept the request, stamp the
  // profile + terms_acceptances ledger as always, and skip the per-doc
  // write instead of 400ing a user who legitimately checked every box
  // on the old client. If `docs` IS provided but is incomplete, that's
  // a hand-crafted bypass attempt and gets rejected.
  let body: { agree?: unknown; docs?: unknown };
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
  const docsProvided = body.docs !== undefined;
  const docs = docsProvided ? coerceDocs(body.docs) : [];
  if (docsProvided && docs.length !== ALLOWED_DOCS.length) {
    return NextResponse.json(
      { error: "docs_incomplete", required: ALLOWED_DOCS },
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
  // moment they tap "I agree."
  const admin = createAdminClient();

  // Fable H-2: resolve the concierge oracle id dynamically instead
  // of hardcoding a per-deployment UUID. Migration 0096 inserts the
  // concierge row with a DB-generated id, so the value differs
  // between dev / staging / prod. If the row is somehow missing we
  // fail loud (better than silently pointing new users at a dead
  // active_oracle_id and having every chat return "not set up yet").
  const { data: concierge } = await admin
    .from("oracles")
    .select("id, name")
    .eq("is_concierge", true)
    .limit(1)
    .maybeSingle<{ id: string; name: string | null }>();
  if (!concierge) {
    console.error(
      "[accept-terms] concierge oracle not found (is_concierge=true). " +
        "Migration 0096_concierge_and_trial_kill.sql must be applied.",
    );
    return NextResponse.json(
      { error: "concierge_missing" },
      { status: 500 },
    );
  }

  // Fable M-1: coalesce via 0120 SECURITY DEFINER RPC so a
  // just-redeemed inherited-code active_oracle_id survives an
  // agreements accept that happens to land a millisecond later. The
  // RPC's UPDATE uses coalesce(active_oracle_id, p_concierge_id) so
  // the concierge default only fills a null column.
  const rpcRes = await admin.rpc("accept_terms_and_default_oracle", {
    p_user_id: user.id,
    p_terms_version: CURRENT_TERMS_VERSION,
    p_concierge_id: concierge.id,
    p_concierge_name: concierge.name ?? "Adrian",
  });
  if (rpcRes.error) {
    console.error("[accept-terms] RPC failed:", rpcRes.error);
    return NextResponse.json(
      { error: "profile_update_failed" },
      { status: 500 },
    );
  }

  // Ledger append with IP + user agent + email — best-effort. The
  // profile column already carries the gate signal, so a ledger
  // failure doesn't block the caller (matches the web action).
  const { ip, userAgent } = extractClientNet(request.headers);
  try {
    // 60-second dedupe against rapid retries (double-tap, refresh).
    // FIRST-EVER acceptance = the real start of membership — send the
    // welcome email HERE (2026-08-11 comms audit found sendWelcomeEmail
    // had existed for months with zero callers: new signups never got
    // any welcome at all). "First ever" is any-version, checked BEFORE
    // this insert; fire-and-forget so mail trouble never blocks the
    // consent flow.
    const { count: priorAcceptances } = await admin
      .from("terms_acceptances")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
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
      if ((priorAcceptances ?? 0) === 0 && user.email) {
        sendWelcomeEmail({ to: user.email, userId: user.id }).catch((e) =>
          console.error("welcome email failed:", e),
        );
      }
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

  // ADRIAN SAYS HELLO FIRST, so nobody opens a silent app.
  //
  // The welcome only ever fired when someone OPENED Adrian's thread
  // (ChatSurface and the mobile conversation screen both post to
  // /api/chat/welcome on an empty thread). Anyone who signed up, looked
  // at the dashboard and didn't tap in was never spoken to at all —
  // five of the last ten signups had zero messages, including a paying
  // subscriber. For an app whose whole promise is that someone reaches
  // out to you, an empty first screen is the worst possible opening.
  //
  // Accepting the terms is the last step of onboarding on BOTH
  // platforms and already resolves the concierge above, so this is the
  // moment the thread should stop being empty.
  //
  // Written directly rather than generated: it must be instant (a model
  // call would make "I agree" hang), identical for everyone, and it
  // carries the disclosure — which is exactly the sentence that should
  // not be improvised differently for each person. Adrian's own persona
  // handles every message after this one.
  //
  // Idempotent: only inserts when the thread is genuinely empty, so a
  // re-accept or a double-tap can never produce two hellos.
  try {
    const { count: existing } = await admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("oracle_id", concierge.id);
    if ((existing ?? 0) === 0) {
      await admin.from("messages").insert({
        user_id: user.id,
        oracle_id: concierge.id,
        role: "assistant",
        content:
          "Hey — I'm Adrian. Good to meet you.\n\n" +
          "Before anything else, the honest bit: I'm an AI, and so is " +
          "everyone you'll meet here. What we say is generated, not " +
          "remembered from a life we lived. You'll find that written " +
          "plainly in the Terms too.\n\n" +
          "That said — I'm here, and I'm not in a hurry. How are you " +
          "doing today?",
      });
    }
  } catch (err) {
    // Never block a consent flow over a greeting.
    console.error("[accept-terms] concierge welcome insert failed:", err);
  }

  // Per-doc ledger write — moved here from mobile's client-side upsert
  // so IP is captured server-side and the whitelist is enforced.
  await writePerDocAgreements(admin, user.id, docs);

  return NextResponse.json({
    ok: true,
    version: CURRENT_TERMS_VERSION,
  });
}
