"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin/allowlist";

/**
 * Dashboard mutations. All are server actions so the client can call
 * them from swipe handlers / star buttons without needing an API route.
 *
 * Every action re-authenticates via getUser() and relies on the oracles
 * RLS from 0002 (auth.uid() = user_id) to prevent cross-user writes —
 * belt-and-suspenders alongside the client-provided oracle id.
 */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");
  return { supabase, user };
}

/** Toggle the pinned/starred flag. Called from the star icon on each row. */
export async function toggleStar(oracleId: string, nextStarred: boolean) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("oracles")
    .update({ is_starred: nextStarred })
    .eq("id", oracleId)
    .is("deleted_at", null);

  if (error) {
    return diagnose(error, "toggling favorite", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Swipe-left on a dashboard row (archive). CONVERSATION-scoped: hides
 * this thread from the Messages inbox and stashes it in the Archived
 * sub-panel. The identity itself STAYS in Contacts either way —
 * Wilson's rule is that identities only leave Contacts via explicit
 * swipe-Delete in the Contacts panel. Reversible for free from the
 * Archived sub-panel with `unarchiveIdentity`.
 */
export async function archiveIdentity(oracleId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("oracles")
    .update({ conversation_archived_at: new Date().toISOString() })
    .eq("id", oracleId)
    .is("deleted_at", null)
    .is("conversation_archived_at", null);

  if (error) {
    return diagnose(error, "archiving", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** Unarchive a conversation — thread returns to the dashboard. Free. */
export async function unarchiveIdentity(oracleId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("oracles")
    .update({ conversation_archived_at: null })
    .eq("id", oracleId)
    .is("deleted_at", null)
    .not("conversation_archived_at", "is", null);

  if (error) {
    return diagnose(error, "unarchiving", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** Swipe-right on a row. Persists the "unread" flag the AI reads later. */
export async function markUnread(oracleId: string, nextUnread: boolean) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("oracles")
    .update({ manually_unread: nextUnread })
    .eq("id", oracleId)
    .is("deleted_at", null);

  if (error) {
    return diagnose(error, "marking unread", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Contacts swipe → Delete identity (Trail B). Soft-deletes the oracle
 * row itself; restore requires the $5 paywall (webhook clears
 * deleted_at). Conversation history rides along and comes back on
 * successful restore.
 */
export async function softDeleteIdentity(oracleId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("oracles")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", oracleId)
    .is("deleted_at", null);

  if (error) {
    return diagnose(error, "deleting", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Dashboard swipe → Delete conversation (Trail A). Soft-deletes every
 * message between this user and the given oracle so the thread leaves
 * the dashboard Messages view. Identity stays put in Contacts and can
 * be messaged again from a blank slate.
 *
 * Free to invoke, free to recover from the trash sub-panel, free to
 * hard-delete forever. The paywall applies only to Trail B (identity).
 */
export async function deleteConversation(oracleId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("oracle_id", oracleId)
    .is("deleted_at", null);

  if (error) {
    return diagnose(error, "deleting conversation", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** Recover a soft-deleted conversation (Trail A undo). Free. */
export async function recoverConversation(oracleId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("messages")
    .update({ deleted_at: null })
    .eq("user_id", user.id)
    .eq("oracle_id", oracleId)
    .not("deleted_at", "is", null);

  if (error) {
    return diagnose(error, "recovering conversation", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Hard-delete the soft-deleted messages between this user and the
 * given oracle. Terminal — rows are gone. Runs under the admin client
 * so the (planned) audit hook has a single choke point later.
 */
export async function purgeConversation(oracleId: string) {
  const { user } = await requireUser();
  const admin = createAdminClient();

  const { error } = await admin
    .from("messages")
    .delete()
    .eq("user_id", user.id)
    .eq("oracle_id", oracleId)
    .not("deleted_at", "is", null);

  if (error) {
    return diagnose(error, "permanently deleting", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

/**
 * Hard delete an identity from the recently-deleted trash. Terminal
 * action — the row and everything that cascades from it (messages,
 * memories, shares) is gone. Restore's $5 window ends here.
 */
export async function permanentDeleteIdentity(oracleId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("oracles")
    .delete()
    .eq("id", oracleId)
    .not("deleted_at", "is", null);

  if (error) {
    return diagnose(error, "permanently deleting", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** Sign out from the user menu. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

/**
 * Turn a Supabase error into a message the caller can display without
 * leaking column/table names to regular users. Admins see the raw
 * diagnostic — same treatment as the onboarding action.
 */
function diagnose(
  error: { message?: string; code?: string; hint?: string },
  verb: string,
  admin: boolean,
) {
  if (admin) {
    const code = error.code ? ` [${error.code}]` : "";
    const hint = error.hint ? ` Hint: ${error.hint}.` : "";
    return {
      ok: false as const,
      error: `Admin: ${verb} failed${code} — ${error.message ?? "unknown error"}.${hint}`,
    };
  }
  return {
    ok: false as const,
    error: `Sorry — we couldn't finish ${verb} that. Please try again.`,
  };
}
