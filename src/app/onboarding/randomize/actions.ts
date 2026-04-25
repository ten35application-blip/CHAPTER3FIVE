"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  questions,
  indexesForGender,
  type GenderFilter,
} from "@/content/questions";

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
    .select("preferred_language, mode")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/onboarding");
  }

  const language = (profile.preferred_language ?? "en") as "en" | "es";
  const allowed = indexesForGender(gender);
  if (allowed.length === 0) {
    redirect("/onboarding/randomize?error=No%20personas%20match%20that%20pick");
  }

  // Per-question independent random pick from the gender-filtered pool.
  const rows = questions
    .filter((q) => q.randomizeOptions)
    .map((q) => {
      const idx = allowed[Math.floor(Math.random() * allowed.length)];
      return {
        user_id: user.id,
        question_id: q.id,
        language,
        variant: 1,
        body: q.randomizeOptions[language][idx],
      };
    });

  const { error: insertError } = await supabase
    .from("answers")
    .upsert(rows, { onConflict: "user_id,question_id,variant" });

  if (insertError) {
    redirect(
      `/onboarding/randomize?error=${encodeURIComponent(insertError.message)}`,
    );
  }

  redirect("/agreements");
}
