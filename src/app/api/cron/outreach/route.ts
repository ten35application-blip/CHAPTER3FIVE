import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendOutreachEmail } from "@/lib/notifications";

/**
 * Daily cron — emails users whose thirtyfives haven't heard from them in a
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

  const sevenAgo = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const fourteenAgo = new Date(Date.now() - FOURTEEN_DAYS_MS).toISOString();

  const { data: candidates, error } = await supabase
    .from("profiles")
    .select(
      "id, oracle_name, preferred_language, last_active_at, last_outreach_at",
    )
    .lt("last_active_at", sevenAgo)
    .or(`last_outreach_at.is.null,last_outreach_at.lt.${fourteenAgo}`)
    .eq("outreach_enabled", true)
    .eq("onboarding_completed", true)
    .is("deceased_at", null)
    .limit(BATCH_LIMIT);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  for (const profile of candidates) {
    try {
      const { data: u } = await supabase.auth.admin.getUserById(profile.id);
      const email = u?.user?.email;
      if (!email) continue;

      await sendOutreachEmail({
        to: email,
        oracleName: profile.oracle_name ?? "your thirtyfive",
        language: (profile.preferred_language ?? "en") as "en" | "es",
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

  return NextResponse.json({ sent });
}
