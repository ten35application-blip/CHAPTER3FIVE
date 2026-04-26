"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  questions,
  eligibleAnswerIndexes,
  type GenderFilter,
} from "@/content/questions";
import { pickPersonality, pickFlavor } from "@/content/personality";

export async function generateRandomizedArchive(formData: FormData) {
  const genderRaw = String(formData.get("gender") ?? "any");
  const gender: GenderFilter =
    genderRaw === "female" || genderRaw === "male" ? genderRaw : "any";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, mode, active_oracle_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }
  if (!profile.active_oracle_id) {
    redirect("/onboarding");
  }

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const oracleId = profile.active_oracle_id;

  // Per-question independent random pick from the gender-filtered pool.
  // Each question is sampled independently — the resulting character is a
  // one-of-a-kind combination across the entire archive.
  const rows = questions
    .filter((q) => q.randomizeOptions && q.randomizeOptions[language]?.length)
    .map((q) => {
      const options = q.randomizeOptions[language];
      const allowed = eligibleAnswerIndexes(options.length, gender);
      if (allowed.length === 0) return null;
      const idx = allowed[Math.floor(Math.random() * allowed.length)];
      return {
        user_id: user.id,
        oracle_id: oracleId,
        question_id: q.id,
        language,
        variant: 1,
        body: options[idx],
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) {
    redirect("/onboarding/randomize?error=No%20answers%20match%20that%20pick");
  }

  const { error: insertError } = await supabase
    .from("answers")
    .upsert(rows, { onConflict: "oracle_id,question_id,variant" });

  if (insertError) {
    redirect(
      `/onboarding/randomize?error=${encodeURIComponent(insertError.message)}`,
    );
  }

  // Layer a coherent character on top: an MBTI-style type + an emotional flavor.
  const personalityType = pickPersonality();
  const emotionalFlavor = pickFlavor();

  await supabase
    .from("profiles")
    .update({
      personality_type: personalityType,
      emotional_flavor: emotionalFlavor,
    })
    .eq("id", user.id);

  redirect("/agreements");
}
