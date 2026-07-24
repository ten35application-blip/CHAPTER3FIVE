import { redirect } from "next/navigation";
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
  };

  return (
    <LegacyFlow
      initialSubject={subject}
      initialAnswers={draft?.answers ?? {}}
      initialStep={draft?.current_step ?? 0}
      serverError={error ?? null}
    />
  );
}
