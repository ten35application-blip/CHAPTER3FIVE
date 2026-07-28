import { redirect } from "next/navigation";
import {
  LEGACY_CATEGORY_LABELS,
  LEGACY_QUESTIONS,
} from "@/lib/legacy/questions";
import type { LegacySubject } from "@/lib/legacy/synthesize";
import { createClient } from "@/lib/supabase/server";
import { LegacyFlow } from "./LegacyFlow";

export const metadata = {
  title: "Someone to keep · chapter3five",
};

type DraftRow = {
  subject: Partial<LegacySubject> | null;
  answers: Record<string, string> | null;
  current_step: number | null;
};

/**
 * The legacy creation flow — server shell. Loads the caller's autosaved
 * draft (if any) so they resume exactly where they left off, then hands
 * everything to the client-side flow.
 */
export default async function LegacyNewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/signin");
  }

  // NO plan gate — since the July 2026 flat-fee rework ANY signed-in
  // account (Free included) can record a legacy archive and mint an
  // inherit code. The recipient side is gated separately (flat $5
  // per code) in /identity/inherit/actions.ts.

  const { data: draft } = await supabase
    .from("legacy_drafts")
    .select("subject, answers, current_step")
    .eq("user_id", user.id)
    .maybeSingle<DraftRow>();

  const subject: LegacySubject = {
    name: draft?.subject?.name ?? "",
    relationship: draft?.subject?.relationship ?? "",
    era: draft?.subject?.era ?? "",
    heritage: draft?.subject?.heritage ?? "",
    // photoUrl is required (saveLegacyDraft persists it, canContinue
    // gates on it). Dropping it here on resume left users with 30
    // answers stuck on Step 0 until they re-uploaded.
    photoUrl: draft?.subject?.photoUrl ?? undefined,
  };

  // The questions bank is server-only content — it reaches the
  // client exclusively through these props, behind the auth gate
  // above, never via a client-side import (see questions.ts).
  return (
    <LegacyFlow
      questions={LEGACY_QUESTIONS}
      categoryLabels={LEGACY_CATEGORY_LABELS}
      initialSubject={subject}
      initialAnswers={draft?.answers ?? {}}
      initialStep={draft?.current_step ?? 0}
      serverError={error ?? null}
    />
  );
}
