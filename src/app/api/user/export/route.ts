import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GDPR / CCPA data export — returns a JSON dump of everything the app
 * stores about the calling user. Auth required (their data only). Uses
 * the user-scoped client so RLS limits the result to rows they own.
 *
 * Service-role admin client is used only for auth.users metadata
 * (created_at, last_sign_in_at, email) which RLS hides.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();

  const [
    profile,
    oracles,
    answers,
    messages,
    payments,
    shares,
    invitesIMade,
    grantsIReceived,
    beneficiariesIDesignated,
    memoriesAboutMe,
    crisisFlags,
    messageReports,
    agreements,
    chatUsage,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("oracles")
      // Explicit column list, not "*": persona_prompt is server-side only
      // (it carries the persona's safety instructions) and is not
      // selectable by the user-scoped client.
      .select(
        "id, user_id, name, mode, preferred_language, texting_style, onboarding_completed, created_at, updated_at, personality_type, emotional_flavor, timezone, avatar_url, deleted_at, scheduled_purge_at, bio, location_anchor, location_extracted_at, orientation, relationship_openness, identity_quirks, traits_extracted_at, ambient_cast, cast_extracted_at, weekly_context, weekly_context_until, sports_fandom, sports_extracted_at, memory_seed, memory_last_asked_at, traits, fingerprint, one_line_hook, is_legacy, legacy_answers, created_by, is_starred, manually_unread, face_generation_status, face_generation_error, avatar_hash, blocked_at, block_reason, significant_events, creation_source",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("answers")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("payments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("shares")
      .select("*")
      .eq("source_user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("archive_invites")
      .select("*")
      .eq("inviter_user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("archive_grants")
      .select("*")
      .eq("user_id", user.id)
      .order("granted_at", { ascending: false }),
    supabase
      .from("beneficiaries")
      .select("*")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("persona_memories")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("crisis_flags")
      .select("*")
      .eq("user_id", user.id)
      .order("flagged_at", { ascending: false }),
    supabase
      .from("message_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("reported_at", { ascending: false }),
    supabase
      .from("agreements")
      .select("*")
      .eq("user_id", user.id)
      .order("agreed_at", { ascending: false }),
    supabase
      .from("chat_usage")
      .select("*")
      .eq("user_id", user.id)
      .order("day", { ascending: false })
      .limit(365),
  ]);

  const dump = {
    exported_at: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    profile: profile.data,
    oracles: oracles.data ?? [],
    answers: answers.data ?? [],
    messages: messages.data ?? [],
    payments: payments.data ?? [],
    shares: shares.data ?? [],
    archive_invites_i_sent: invitesIMade.data ?? [],
    archive_grants_i_received: grantsIReceived.data ?? [],
    beneficiaries_i_designated: beneficiariesIDesignated.data ?? [],
    persona_memories_about_me: memoriesAboutMe.data ?? [],
    crisis_flags: crisisFlags.data ?? [],
    message_reports: messageReports.data ?? [],
    agreements: agreements.data ?? [],
    chat_usage_last_year: chatUsage.data ?? [],
    notes: {
      excluded:
        "Avatar image files (in Supabase Storage) are not included in this JSON. They remain accessible via the avatar_url field on your oracles + profile. Authentication system rows (auth.users session metadata) are also excluded by design.",
      ai: "Conversations are processed by Anthropic at message time; chapter3five does not retain conversation data with Anthropic.",
      contact:
        "Questions: care@chapter3five.app. To delete everything in this export, use Settings → Delete account.",
    },
  };

  // Surface admin-only metadata about whether this user has been marked
  // deceased (relevant if a beneficiary is exporting their own data and
  // is asked about the relationship).
  const { data: authUser } = await admin.auth.admin.getUserById(user.id);
  if (authUser?.user) {
    dump.user.created_at = authUser.user.created_at ?? dump.user.created_at;
  }

  const filename = `chapter3five-export-${user.id.slice(0, 8)}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
