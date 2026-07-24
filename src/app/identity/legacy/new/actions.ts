"use server";

import { redirect } from "next/navigation";
import { redirectWithError } from "@/lib/action-errors";
import { SynthesisError } from "@/lib/identity/synthesize";
import { fingerprintLegacyAnswers } from "@/lib/legacy/fingerprint";
import { mintInheritCode } from "@/lib/legacy/mint";
import {
  LEGACY_QUESTION_COUNT,
  LEGACY_QUESTIONS,
} from "@/lib/legacy/questions";
import {
  synthesizeLegacyPersona,
  type LegacySubject,
} from "@/lib/legacy/synthesize";
import { createClient } from "@/lib/supabase/server";

/** Enough answers to weave a real person from — half the bank. */
const MIN_ANSWERS = 20;
const MAX_ANSWER_CHARS = 4000;
const MAX_SUBJECT_FIELD_CHARS = 200;

const KNOWN_QUESTION_IDS = new Set(LEGACY_QUESTIONS.map((q) => q.id));

type DraftPayload = {
  subject: LegacySubject;
  answers: Record<string, string>;
  currentStep: number;
};

function sanitizeSubject(subject: LegacySubject): LegacySubject {
  const clean = (v: unknown) =>
    typeof v === "string" ? v.trim().slice(0, MAX_SUBJECT_FIELD_CHARS) : "";
  return {
    name: clean(subject?.name),
    relationship: clean(subject?.relationship),
    era: clean(subject?.era),
    heritage: clean(subject?.heritage),
  };
}

function sanitizeAnswers(
  answers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, value] of Object.entries(answers ?? {})) {
    if (!KNOWN_QUESTION_IDS.has(id)) continue;
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, MAX_ANSWER_CHARS);
    if (trimmed.length > 0) out[id] = trimmed;
  }
  return out;
}

/**
 * Autosave. Upserts the caller's single draft row so they can leave and
 * come back mid-flow. Fire-and-forget from the client — errors are logged
 * server-side but never surface (losing one debounce tick is fine; the next
 * keystroke saves again).
 */
export async function saveLegacyDraft(payload: DraftPayload): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const step = Number.isInteger(payload.currentStep)
    ? Math.max(0, Math.min(LEGACY_QUESTION_COUNT, payload.currentStep))
    : 0;

  const { error } = await supabase.from("legacy_drafts").upsert(
    {
      user_id: user.id,
      subject: sanitizeSubject(payload.subject),
      answers: sanitizeAnswers(payload.answers),
      current_step: step,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("[saveLegacyDraft] upsert failed", error);
  }
}

/**
 * The completion flow:
 *   1. Auth gate + sanitize + validate (name, enough answers)
 *   2. Fingerprint the source material (SHA-256 of subject + answers)
 *   3. Claude weaves the persona (name, hook, persona_prompt, traits)
 *   4. Insert into oracles with is_legacy = true + legacy_answers
 *   5. Mint an inherit code (best-effort — share page can retry)
 *   6. Delete the draft, redirect to the share moment
 */
export async function completeLegacyIdentity(payload: {
  subject: LegacySubject;
  answers: Record<string, string>;
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  const subject = sanitizeSubject(payload.subject);
  const answers = sanitizeAnswers(payload.answers);

  if (!subject.name) {
    redirectWithError(
      "/identity/legacy/new",
      "Give them their name first — it's on the first page.",
    );
  }
  if (Object.keys(answers).length < MIN_ANSWERS) {
    redirectWithError(
      "/identity/legacy/new",
      `A person takes at least ${MIN_ANSWERS} answers to hold together. Answer a few more.`,
    );
  }

  const fingerprint = fingerprintLegacyAnswers(subject, answers);

  let persona;
  try {
    persona = await synthesizeLegacyPersona(subject, answers);
  } catch (err) {
    if (err instanceof SynthesisError && err.kind === "refusal") {
      redirectWithError(
        "/identity/legacy/new",
        "Something in the answers didn't sit right. Soften anything graphic and try again.",
        err,
      );
    }
    redirectWithError(
      "/identity/legacy/new",
      "Couldn't finish weaving them together. Your answers are saved — try again.",
      err,
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("oracles")
    .insert({
      user_id: user.id,
      created_by: user.id,
      is_legacy: true,
      legacy_answers: { subject, answers },
      traits: persona.traits,
      fingerprint,
      name: persona.name,
      one_line_hook: persona.one_line_hook,
      persona_prompt: persona.persona_prompt,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      // fingerprint unique index — this exact set of answers already exists
      redirectWithError(
        "/identity/legacy/new",
        "This exact story has already been woven. Check your identities on the dashboard.",
        insertError,
      );
    }
    redirectWithError(
      "/identity/legacy/new",
      "Couldn't save them. Your answers are still here — try again.",
      insertError,
    );
  }

  // Best-effort: if minting somehow fails, the share page offers a retry.
  await mintInheritCode(supabase, inserted.id, user.id);

  // The draft has served its purpose.
  await supabase.from("legacy_drafts").delete().eq("user_id", user.id);

  redirect(`/identity/legacy/${inserted.id}/share`);
}
