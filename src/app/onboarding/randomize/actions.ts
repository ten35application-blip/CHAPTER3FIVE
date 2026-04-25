"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { questions, PERSONA_COUNT } from "@/content/questions";

export async function generateRandomizedArchive() {
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

  // Per-question independent random pick. Yields 4^N unique chimera personas
  // — every user gets a character no one else ever will. Trade-off: voice
  // can shift across topics, by design.
  const rows = questions
    .filter((q) => q.randomizeOptions)
    .map((q) => {
      const idx = Math.floor(Math.random() * PERSONA_COUNT);
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
