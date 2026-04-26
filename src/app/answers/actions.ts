"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateAnswer(formData: FormData) {
  const questionId = Number(formData.get("question_id"));
  const body = String(formData.get("body") ?? "").trim();

  if (!Number.isInteger(questionId) || questionId < 1) {
    redirect("/answers?error=Invalid%20question");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, active_oracle_id")
    .eq("id", user.id)
    .single();

  const oracleId = profile?.active_oracle_id;
  if (!oracleId) redirect("/onboarding");
  const language = profile?.preferred_language ?? "en";

  if (!body) {
    // Empty body = delete the answer.
    await supabase
      .from("answers")
      .delete()
      .eq("oracle_id", oracleId)
      .eq("question_id", questionId)
      .eq("variant", 1);
  } else {
    await supabase.from("answers").upsert(
      {
        user_id: user.id,
        oracle_id: oracleId,
        question_id: questionId,
        language,
        variant: 1,
        body,
      },
      { onConflict: "oracle_id,question_id,variant" },
    );
  }

  revalidatePath("/answers");
  redirect(`/answers?saved=${questionId}#q${questionId}`);
}
