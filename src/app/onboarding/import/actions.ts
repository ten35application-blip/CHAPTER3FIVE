"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatShareCode, normalizeShareCode } from "@/lib/share";

export async function importFromCode(formData: FormData) {
  const raw = String(formData.get("code") ?? "");
  const normalized = normalizeShareCode(raw);
  if (normalized.length !== 12) {
    redirect("/onboarding/import?error=Code%20should%20be%2012%20letters%20and%20numbers");
  }
  const code = formatShareCode(normalized);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Look up the share. Must exist and not be revoked.
  const { data: share } = await supabase
    .from("shares")
    .select("source_user_id, revoked_at")
    .eq("code", code)
    .maybeSingle();

  if (!share) {
    redirect("/onboarding/import?error=Code%20not%20found");
  }
  if (share.revoked_at) {
    redirect("/onboarding/import?error=This%20code%20has%20been%20revoked");
  }
  if (share.source_user_id === user.id) {
    redirect("/onboarding/import?error=You%20can't%20import%20your%20own%20share");
  }

  // Read the source profile.
  const { data: source } = await supabase
    .from("profiles")
    .select(
      "oracle_name, mode, preferred_language, texting_style, personality_type, emotional_flavor",
    )
    .eq("id", share.source_user_id)
    .single();

  if (!source) {
    redirect("/onboarding/import?error=Source%20archive%20not%20found");
  }

  // Read the source's answers.
  const { data: sourceAnswers } = await supabase
    .from("answers")
    .select("question_id, language, variant, body")
    .eq("user_id", share.source_user_id);

  if (!sourceAnswers || sourceAnswers.length === 0) {
    redirect(
      "/onboarding/import?error=The%20source%20archive%20has%20no%20answers%20yet",
    );
  }

  // Copy the profile fields onto the recipient. Keep the recipient's chosen
  // oracle_name (they may have entered their own) — but if it was empty,
  // use the source's name.
  const { data: existing } = await supabase
    .from("profiles")
    .select("oracle_name")
    .eq("id", user.id)
    .single();

  const oracleName =
    existing?.oracle_name && existing.oracle_name.trim()
      ? existing.oracle_name
      : source.oracle_name;

  const { error: profErr } = await supabase
    .from("profiles")
    .update({
      oracle_name: oracleName,
      mode: "import",
      preferred_language: source.preferred_language ?? "en",
      texting_style: source.texting_style,
      personality_type: source.personality_type,
      emotional_flavor: source.emotional_flavor,
    })
    .eq("id", user.id);
  if (profErr) {
    redirect(`/onboarding/import?error=${encodeURIComponent(profErr.message)}`);
  }

  // Copy the answers, retargeted at the recipient.
  const rows = sourceAnswers.map((a) => ({
    user_id: user.id,
    question_id: a.question_id,
    language: a.language,
    variant: a.variant,
    body: a.body,
  }));

  const { error: ansErr } = await supabase
    .from("answers")
    .upsert(rows, { onConflict: "user_id,question_id,variant" });
  if (ansErr) {
    redirect(`/onboarding/import?error=${encodeURIComponent(ansErr.message)}`);
  }

  redirect("/agreements");
}
