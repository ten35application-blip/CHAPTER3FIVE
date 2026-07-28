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

// Server-action budget for the Weaving step. `completeLegacyIdentity`
// synthesizes a full persona from up to 40 answers via Anthropic; a
// long batch can push past the Vercel Hobby default (60s) and hang
// the user on the WeavingScreen with no error. 300s is the Pro-plan
// ceiling and covers even the slowest real-world synthesis by a wide
// margin. The client-side finish() also carries its own abort timer
// (see LegacyFlow.tsx) so a stuck request surfaces as an error toast
// instead of a stuck screen.
export const maxDuration = 300;

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
  searchParams: Promise<{
    error?: string;
    mode?: string;
    paid?: string;
    cancelled?: string;
  }>;
}) {
  const {
    error,
    mode: modeParam,
    paid: paidParam,
    cancelled: cancelledParam,
  } = await searchParams;

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

  // Mode resolution priority: URL ?mode= param wins (user just clicked
  // a picker card, honor that intent), else fall back to draft, else
  // "other" as a safe default for direct visits without either signal.
  // Enum-narrow both sources so a corrupted draft or crafted URL can't
  // leak an arbitrary string. Wilson's ask 2026-07-28: clicking either
  // legacy picker card was landing users on the same-looking page
  // because the older-wins policy kept a self-mode draft glued to the
  // self voice even when they clicked "Someone you love".
  const draftMode = draft?.subject?.mode;
  const draftModeValid: "self" | "other" | null =
    draftMode === "self" || draftMode === "other" ? draftMode : null;
  const urlModeValid: "self" | "other" | null =
    modeParam === "self" || modeParam === "other" ? modeParam : null;
  const resolvedMode: "self" | "other" =
    urlModeValid ?? draftModeValid ?? "other";
  const subject: LegacySubject = {
    name: draft?.subject?.name ?? "",
    // In self mode the relationship field is hidden and the draft
    // should carry an empty string; mirror sanitizeSubject's invariant
    // here so a self-picker click over an old other-mode draft doesn't
    // leave a stale "My mother" hidden in state.
    relationship:
      resolvedMode === "self" ? "" : draft?.subject?.relationship ?? "",
    era: draft?.subject?.era ?? "",
    heritage: draft?.subject?.heritage ?? "",
    // photoUrl is required (saveLegacyDraft persists it, canContinue
    // gates on it). Dropping it here on resume left users with 30
    // answers stuck on Step 0 until they re-uploaded.
    photoUrl: draft?.subject?.photoUrl ?? undefined,
    mode: resolvedMode,
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
      // Stripe round-trip signals (other-mode mint gate). ?paid=1 is
      // the success_url — swap the Finish CTA for "You're paid —
      // finish it" (Wilson's option B: one transparent extra click).
      // ?cancelled=1 is the cancel_url — reassure that the answers
      // survived. Cosmetic only: the server action re-checks the paid
      // credit on every Finish regardless of what the URL claims.
      paid={paidParam === "1"}
      cancelled={cancelledParam === "1"}
    />
  );
}
