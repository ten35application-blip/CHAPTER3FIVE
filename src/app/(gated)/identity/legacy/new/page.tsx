import { redirect } from "next/navigation";
import {
  LEGACY_CATEGORY_LABELS,
  LEGACY_QUESTIONS,
} from "@/lib/legacy/questions";
import type { LegacySubject } from "@/lib/legacy/synthesize";
import { createClient } from "@/lib/supabase/server";
import { requirePro } from "@/lib/subscription";
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

  // Creator side needs ANY active paid plan — Basic or Pro — since
  // the July 2026 second rework (was Pro-only; requirePro despite
  // its name passes any paid window, trial, or admin). Free users
  // bounce to /upgrade. Recipient side is gated separately (per-code
  // payment + memorial waiver) in /identity/inherit/actions.ts. The
  // draft is autosaved even during a lapsed state, so an in-progress
  // draft survives a subscription hiccup.
  const gate = await requirePro("/identity/legacy/new");
  if (!gate.ok) redirect(gate.redirectTo);

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

  // The questions bank is server-only paid content — it reaches the
  // client exclusively through these props, behind the requirePro()
  // gate above, never via a client-side import (see questions.ts).
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
