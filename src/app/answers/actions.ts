"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Set just the text body of an answer without redirecting. Used by the
 * VoiceAnswer client component when the user accepts a Whisper
 * transcript. Preserves any audio columns on the row.
 */
export async function setAnswerBody(opts: {
  questionId: number;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!Number.isInteger(opts.questionId) || opts.questionId < 1) {
    return { ok: false, error: "Invalid question" };
  }
  const body = opts.body.trim();
  if (!body) return { ok: false, error: "Empty body" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_language, active_oracle_id")
    .eq("id", user.id)
    .single();
  const oracleId = profile?.active_oracle_id;
  if (!oracleId) return { ok: false, error: "No active identity" };
  const language = profile?.preferred_language ?? "en";

  const { data: ownedOracle } = await supabase
    .from("oracles")
    .select("id")
    .eq("id", oracleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ownedOracle) return { ok: false, error: "Not authorized" };

  // Update the body, preserving audio columns. If the row doesn't
  // exist (audio-only flow somehow without an inserted row), insert.
  const { data: existing } = await supabase
    .from("answers")
    .select("id")
    .eq("oracle_id", oracleId)
    .eq("question_id", opts.questionId)
    .eq("variant", 1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("answers")
      .update({ body, language })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("answers").insert({
      user_id: user.id,
      oracle_id: oracleId,
      question_id: opts.questionId,
      variant: 1,
      language,
      body,
    });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/answers");
  return { ok: true };
}

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

  // Verify this oracle belongs to the caller. active_oracle_id should
  // always point at their own oracle, but defense-in-depth — if it ever
  // drifts to someone else's id, we don't want answer writes leaking.
  const { data: ownedOracle } = await supabase
    .from("oracles")
    .select("id")
    .eq("id", oracleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ownedOracle) redirect("/answers?error=Not%20authorized");

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
