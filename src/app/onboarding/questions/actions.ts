"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { questions } from "@/content/questions";

export async function saveAnswer(formData: FormData) {
  const questionId = Number(formData.get("question_id"));
  const body = String(formData.get("body") ?? "").trim();

  if (!Number.isInteger(questionId) || questionId < 1) {
    redirect("/onboarding/questions?error=Invalid%20question");
  }

  const question = questions.find((q) => q.id === questionId);
  if (!question) {
    redirect("/onboarding/questions?error=Question%20not%20found");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language")
    .eq("id", user.id)
    .single();

  const language = profile?.preferred_language ?? "en";

  if (!body) {
    redirect(`/onboarding/questions?error=Please%20write%20an%20answer`);
  }

  const { error } = await supabase.from("answers").upsert(
    {
      user_id: user.id,
      question_id: questionId,
      language,
      variant: 1,
      body,
    },
    { onConflict: "user_id,question_id,variant" },
  );

  if (error) {
    redirect(`/onboarding/questions?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/onboarding/questions");
  redirect("/onboarding/questions");
}

export async function skipForNow() {
  redirect("/dashboard");
}
