"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdmin } from "@/lib/admin";

const PROFILE_COLUMNS =
  "oracle_name, mode, preferred_language, texting_style, personality_type, emotional_flavor, timezone, onboarding_completed";

async function syncProfileToOracle(
  supabase: SupabaseClient,
  userId: string,
  oracleId: string,
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .single();
  if (!profile) return;

  await supabase
    .from("oracles")
    .update({
      name: profile.oracle_name ?? "untitled",
      mode: profile.mode ?? "real",
      preferred_language: profile.preferred_language ?? "en",
      texting_style: profile.texting_style,
      personality_type: profile.personality_type,
      emotional_flavor: profile.emotional_flavor,
      timezone: profile.timezone,
      onboarding_completed: profile.onboarding_completed ?? false,
    })
    .eq("id", oracleId)
    .eq("user_id", userId);
}

export async function newOracle() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_oracle_id, extra_oracle_credits")
    .eq("id", user.id)
    .single();

  // First identity (the auto-created one on signup) is free. Every
  // additional identity needs a credit ($5 via Stripe). Admin
  // emails get unlimited free creates for testing + dogfooding.
  const { count: oracleCount } = await supabase
    .from("oracles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const hasAtLeastOne = (oracleCount ?? 0) >= 1;
  const credits = profile?.extra_oracle_credits ?? 0;

  if (hasAtLeastOne && credits <= 0 && !isAdmin(user.email)) {
    redirect("/oracle/pay");
  }

  if (profile?.active_oracle_id) {
    await syncProfileToOracle(supabase, user.id, profile.active_oracle_id);
  }

  const { data: created, error } = await supabase
    .from("oracles")
    .insert({
      user_id: user.id,
      name: "untitled",
      mode: "real",
      preferred_language: "en",
    })
    .select("id")
    .single();

  if (error || !created) {
    redirect("/dashboard?error=Could%20not%20create%20a%20new%20identity");
  }

  // Decrement credit if this was a paid creation (not the first).
  const updates: Record<string, unknown> = {
    active_oracle_id: created.id,
    oracle_name: null,
    mode: "real",
    texting_style: null,
    personality_type: null,
    emotional_flavor: null,
    onboarding_completed: false,
  };
  if (hasAtLeastOne) {
    updates.extra_oracle_credits = Math.max(0, credits - 1);
  }

  await supabase.from("profiles").update(updates).eq("id", user.id);

  redirect("/onboarding");
}

/**
 * Rename a non-random identity. Only allowed for "real" mode oracles
 * (the user named them) — randomized identities have generated names
 * tied to the persona and shouldn't be edited from here.
 *
 * Updates oracles.name and (if this is the active identity) keeps
 * profiles.oracle_name in sync so the dashboard / nav reflect the
 * new name immediately.
 */
export async function renameOracle(formData: FormData) {
  const oracleId = String(formData.get("oracle_id") ?? "").trim();
  const rawName = String(formData.get("name") ?? "").trim();
  if (!oracleId) redirect("/identities?error=Missing%20id");
  if (!rawName)
    redirect(`/identities?error=${encodeURIComponent("Name can't be empty")}`);
  const name = rawName.slice(0, 60);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, mode, user_id")
    .eq("id", oracleId)
    .maybeSingle();
  if (!oracle || oracle.user_id !== user.id) {
    redirect("/identities?error=Identity%20not%20found");
  }
  if (oracle.mode === "randomize") {
    redirect(
      `/identities?error=${encodeURIComponent("Randomized identities can't be renamed")}`,
    );
  }

  await supabase
    .from("oracles")
    .update({ name })
    .eq("id", oracleId)
    .eq("user_id", user.id);

  // Keep the active-identity name in profile in sync.
  const { data: profile } = await supabase
    .from("profiles")
    .select("active_oracle_id")
    .eq("id", user.id)
    .single();
  if (profile?.active_oracle_id === oracleId) {
    await supabase
      .from("profiles")
      .update({ oracle_name: name })
      .eq("id", user.id);
  }

  revalidatePath("/identities");
  revalidatePath("/dashboard");
  redirect("/identities?saved=renamed");
}

export async function switchOracle(formData: FormData) {
  const targetId = String(formData.get("oracle_id") ?? "").trim();
  if (!targetId) redirect("/dashboard?error=No%20identity%20selected");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_oracle_id")
    .eq("id", user.id)
    .single();

  if (profile?.active_oracle_id === targetId) {
    redirect("/dashboard");
  }

  if (profile?.active_oracle_id) {
    await syncProfileToOracle(supabase, user.id, profile.active_oracle_id);
  }

  const { data: target } = await supabase
    .from("oracles")
    .select(
      "name, mode, preferred_language, texting_style, personality_type, emotional_flavor, timezone, onboarding_completed",
    )
    .eq("id", targetId)
    .eq("user_id", user.id)
    .single();

  if (!target) {
    redirect("/dashboard?error=Identity%20not%20found");
  }

  await supabase
    .from("profiles")
    .update({
      active_oracle_id: targetId,
      oracle_name: target.name,
      mode: target.mode,
      preferred_language: target.preferred_language,
      texting_style: target.texting_style,
      personality_type: target.personality_type,
      emotional_flavor: target.emotional_flavor,
      timezone: target.timezone,
      onboarding_completed: target.onboarding_completed,
    })
    .eq("id", user.id);

  redirect(target.onboarding_completed ? "/dashboard" : "/onboarding");
}
