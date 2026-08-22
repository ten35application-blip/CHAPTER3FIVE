import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  LEGACY_QUESTIONS,
  LEGACY_CATEGORY_LABELS,
} from "@/lib/legacy/questions";
import { UpdateArchiveForm } from "./UpdateArchiveForm";

export const metadata = {
  title: "Update your archive · chapter3five",
};

/**
 * Update your own archive — web twin of the mobile
 * app/identity/legacy/update.tsx.
 *
 * Deliberately NOT the 45-step walk. That flow is for writing your
 * life the first time; this is for touching up, so everything sits on
 * one page and you go straight to the thing you want to change.
 *
 * Every rule is re-enforced in updateOwnArchive() on save. The checks
 * here decide what a person is allowed to OPEN — a redeemed copy or an
 * archive about someone else never renders the form at all.
 */
export default async function UpdateArchivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: row } = await createAdminClient()
    .from("oracles")
    .select(
      "id, name, avatar_url, legacy_answers, user_id, is_legacy, inherited_at, deleted_at",
    )
    .eq("id", id)
    .maybeSingle();

  // Not yours, not real, or gone — the same answer for all three, so
  // nothing here confirms whether an archive exists.
  if (!row || row.user_id !== user.id || row.deleted_at || !row.is_legacy) {
    redirect("/settings");
  }
  // A redeemed copy is is_legacy AND owned by the caller. This is the
  // filter that stops someone rewriting a stranger's dead relative for
  // the whole family that holds it.
  if (row.inherited_at) redirect("/settings");

  const stored = (row.legacy_answers ?? {}) as {
    subject?: { mode?: unknown };
    answers?: Record<string, string>;
  };
  // "You can only edit YOUR OWN WALK and not that you helped create for
  // someone else." (Wilson 2026-08-22)
  if (stored.subject?.mode !== "self") redirect("/settings");

  return (
    <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10">
      <Link
        href="/settings"
        className="text-sm text-warm-300 transition-colors hover:text-warm-100"
      >
        ← Settings
      </Link>
      <UpdateArchiveForm
        oracleId={row.id as string}
        photoUrl={(row.avatar_url as string | null) ?? null}
        questions={LEGACY_QUESTIONS}
        categoryLabels={LEGACY_CATEGORY_LABELS}
        initialAnswers={stored.answers ?? {}}
      />
    </main>
  );
}
