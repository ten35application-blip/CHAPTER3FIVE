import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { normalizeLanguage } from "@/lib/i18n/language";
import { isOracleMuted } from "@/lib/muted";
import { sendOutreachEmail } from "@/lib/notifications";

export const runtime = "nodejs";
// Literal, not the shared constant: Next reads segment config
// statically, so an imported value fails the build with
// "Invalid segment configuration export detected". Keep in sync
// with CRON_MAX_DURATION in lib/cron/budget.ts.
export const maxDuration = 300;

/**
 * Daily cron — emails users whose identities haven't heard from them in a
 * week. Skips users who have been emailed in the last fortnight, who've
 * disabled outreach, or who haven't completed onboarding.
 *
 * Triggered by Vercel Cron (see vercel.json). Authenticates via
 * CRON_SECRET. Uses the service-role Supabase client to read across
 * profiles + auth.users.
 */

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 100;

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const startedAt = Date.now();

  const sevenAgo = new Date(startedAt - SEVEN_DAYS_MS).toISOString();
  const fourteenAgo = new Date(startedAt - FOURTEEN_DAYS_MS).toISOString();

  const { data: candidates, error } = await supabase
    .from("profiles")
    .select(
      "id, oracle_name, preferred_language, last_active_at, last_outreach_at, active_oracle_id",
    )
    .lt("last_active_at", sevenAgo)
    .or(`last_outreach_at.is.null,last_outreach_at.lt.${fourteenAgo}`)
    .eq("outreach_enabled", true)
    .eq("onboarding_completed", true)
    .is("deceased_at", null)
    .is("deleted_at", null)
    .limit(BATCH_LIMIT);

  if (error) {
    await supabase.from("cron_runs").insert({
      job: "outreach",
      status: "error",
      error: error.message,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    await supabase.from("cron_runs").insert({
      job: "outreach",
      processed: 0,
      duration_ms: Date.now() - startedAt,
    });
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  for (const profile of candidates) {
    try {
      // Skip if user muted their active conversation. Read separately
      // so a missing column doesn't break the cron on older deploys.
      type MuteEntry = { kind?: string; id?: string };
      let muted: MuteEntry[] = [];
      try {
        const { data: row } = await supabase
          .from("profiles")
          .select("muted_conversations")
          .eq("id", profile.id)
          .maybeSingle();
        if (
          Array.isArray(
            (row as { muted_conversations?: unknown } | null)
              ?.muted_conversations,
          )
        ) {
          muted = (row as { muted_conversations: MuteEntry[] })
            .muted_conversations;
        }
      } catch {
        muted = [];
      }
      // NEVER EMAIL ABOUT A GHOST (Wilson 2026-08-11, holding a
      // "your identity hasn't heard from you" email about an identity
      // deleted long ago). profiles.oracle_name is a single-oracle-era
      // column that nothing keeps current, and the old fallback mailed
      // the generic phrase whenever it was stale. Resolve a LIVE
      // companion instead — undeleted, unblocked, unarchived —
      // preferring a personal one over the shared concierge; if the
      // user has none, there is nobody to miss them: skip, no email.
      const { data: liveOracles } = await supabase
        .from("oracles")
        .select("id, name, is_concierge")
        .eq("user_id", profile.id)
        .is("deleted_at", null)
        .is("blocked_at", null)
        .is("conversation_archived_at", null)
        .order("is_concierge", { ascending: true })
        .limit(5);
      const companion = (liveOracles ?? []).find(
        (o) => o.name && !isOracleMuted(muted, o.id),
      );
      if (!companion) continue;

      const { data: u } = await supabase.auth.admin.getUserById(profile.id);
      const email = u?.user?.email;
      if (!email) continue;

      await sendOutreachEmail({
        to: email,
        oracleName: companion.name as string,
        language: normalizeLanguage(profile.preferred_language),
        // Powers the unsubscribe link + header, and email_log attribution.
        userId: profile.id,
      });

      await supabase
        .from("profiles")
        .update({ last_outreach_at: new Date().toISOString() })
        .eq("id", profile.id);

      sent++;
    } catch (err) {
      console.error(`outreach: failed for ${profile.id}`, err);
    }
  }

  await supabase.from("cron_runs").insert({
    job: "outreach",
    processed: sent,
    duration_ms: Date.now() - startedAt,
  });

  return NextResponse.json({ sent });
}
