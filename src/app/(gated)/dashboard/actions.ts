"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
 * Swipe-left on a row (soft delete). Sets deleted_at so the row leaves
 * the dashboard but stays reversible from /trash for 30 days.
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
  revalidatePath("/trash");
  return { ok: true as const };
}

/** Swipe-right in /trash — clears deleted_at so the identity comes back. */
export async function restoreIdentity(oracleId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("oracles")
    .update({ deleted_at: null })
    .eq("id", oracleId)
    .not("deleted_at", "is", null);

  if (error) {
    return diagnose(error, "restoring", isAdmin(user.email));
  }

  revalidatePath("/dashboard");
  revalidatePath("/trash");
  return { ok: true as const };
}

/**
 * Hard delete from /trash. Terminal action — the row and everything
 * that cascades from it (messages, memories, shares) is gone.
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

  revalidatePath("/trash");
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
