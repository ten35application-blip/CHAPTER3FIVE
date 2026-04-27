"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateShareCode } from "@/lib/share";
import { isAdmin } from "@/lib/admin";
import {
  sendBeneficiaryDesignationEmail,
  sendBeneficiaryRemovedEmail,
  recordAudit,
} from "@/lib/notifications";

const FREE_BENEFICIARIES = 3;

function generateClaimToken(): string {
  // 32-char URL-safe token, ~190 bits entropy.
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Toggle a conversation as favorited (or unfavorited) for the
 * current user. Powers the favorites row at the top of /dashboard.
 *
 * The favorites array on profiles holds { kind, id } pointers; we
 * filter out a matching entry on toggle-off, append on toggle-on.
 */
const FAVORITE_KINDS = new Set(["owned", "shared", "group", "together"]);

export async function toggleFavorite(formData: FormData) {
  const kind = String(formData.get("kind") ?? "").trim();
  const id = String(formData.get("id") ?? "").trim();
  if (!FAVORITE_KINDS.has(kind) || !id) {
    redirect("/dashboard?error=Bad%20favorite%20input");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("favorites")
    .eq("id", user.id)
    .single();

  type FavEntry = { kind: string; id: string };
  const current = Array.isArray(profile?.favorites)
    ? (profile!.favorites as FavEntry[])
    : [];
  const exists = current.some((f) => f.kind === kind && f.id === id);
  const next = exists
    ? current.filter((f) => !(f.kind === kind && f.id === id))
    : [...current, { kind, id }];

  await supabase
    .from("profiles")
    .update({ favorites: next })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateTheme(formData: FormData) {
  const raw = String(formData.get("theme") ?? "").trim();
  const theme = raw === "daylight" ? "daylight" : "dusk";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { error } = await supabase
    .from("profiles")
    .update({ theme })
    .eq("id", user.id);

  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/account?saved=theme");
}

export async function updateLanguage(formData: FormData) {
  const language = String(formData.get("language") ?? "en").trim();
  if (language !== "en" && language !== "es") {
    redirect("/account?error=Invalid%20language");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { error } = await supabase
    .from("profiles")
    .update({ preferred_language: language })
    .eq("id", user.id);

  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/account");
  redirect("/account?saved=language");
}

export async function updateTextingStyle(formData: FormData) {
  const style = String(formData.get("texting_style") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { error } = await supabase
    .from("profiles")
    .update({ texting_style: style || null })
    .eq("id", user.id);

  if (error) {
    redirect(`/sharing?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/sharing");
  redirect("/sharing?saved=style");
}

const ORIENTATION_VALUES = [
  "straight",
  "gay",
  "lesbian",
  "bi",
  "pan",
  "ace",
  "unspecified",
] as const;
const OPENNESS_VALUES = [
  "flirty",
  "warm",
  "reserved",
  "partnered",
  "uninterested",
] as const;

export async function updateTraits(formData: FormData) {
  const rawOrientation = String(formData.get("orientation") ?? "").trim();
  const rawOpenness = String(formData.get("openness") ?? "").trim();

  const orientation =
    (ORIENTATION_VALUES as readonly string[]).includes(rawOrientation)
      ? rawOrientation
      : null;
  const openness =
    (OPENNESS_VALUES as readonly string[]).includes(rawOpenness)
      ? rawOpenness
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_oracle_id")
    .eq("id", user.id)
    .single();
  if (!profile?.active_oracle_id) {
    redirect("/sharing?error=No%20active%20identity");
  }

  const { error } = await supabase
    .from("oracles")
    .update({
      orientation,
      relationship_openness: openness,
      traits_extracted_at: new Date().toISOString(),
    })
    .eq("id", profile.active_oracle_id);

  if (error) {
    redirect(`/sharing?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/sharing");
  redirect("/sharing?saved=traits");
}

export async function updateLocation(formData: FormData) {
  const raw = String(formData.get("location") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_oracle_id")
    .eq("id", user.id)
    .single();
  if (!profile?.active_oracle_id) {
    redirect("/sharing?error=No%20active%20identity");
  }

  // Owner-supplied locations are stored as a single freeform string in
  // the `city` slot. The chat-side prompt block joins parts with commas
  // — a comma-separated string also flows through naturally without a
  // structured parse.
  const anchor = raw ? { city: raw } : {};

  const { error } = await supabase
    .from("oracles")
    .update({
      location_anchor: anchor,
      location_extracted_at: new Date().toISOString(),
    })
    .eq("id", profile.active_oracle_id);

  if (error) {
    redirect(`/sharing?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/sharing");
  redirect("/sharing?saved=location");
}

function isoDate(input: string | null | undefined): string {
  if (!input) return "";
  return new Date(input).toISOString().slice(0, 10);
}

function namesMatch(typed: string, actual: string | null | undefined): boolean {
  if (!actual) return false;
  return typed.trim().toLowerCase() === actual.trim().toLowerCase();
}

export async function toggleOutreach(formData: FormData) {
  const enabled = formData.get("enabled") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { error } = await supabase
    .from("profiles")
    .update({ outreach_enabled: enabled })
    .eq("id", user.id);

  if (error) {
    redirect(`/account?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/account");
  redirect(`/account?saved=outreach`);
}

export async function deleteOracle(formData: FormData) {
  const typedName = String(formData.get("confirm_name") ?? "");
  const typedDate = String(formData.get("confirm_date") ?? "").trim();
  // Optional explicit target id (from the per-identity card on
  // /identities). Falls back to the active oracle for back-compat
  // with any older form that didn't pass an id.
  const explicitId = String(formData.get("oracle_id") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, created_at, active_oracle_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/identities?error=Profile%20not%20found");
  }

  // Resolve which identity we're actually deleting + its name + created.
  let oracleId = explicitId || profile.active_oracle_id || "";
  let targetName: string | null = null;
  let targetCreatedIso = "";
  if (oracleId) {
    const { data: target } = await supabase
      .from("oracles")
      .select("name, created_at, user_id")
      .eq("id", oracleId)
      .maybeSingle();
    if (!target || target.user_id !== user.id) {
      redirect("/identities?error=Identity%20not%20found");
    }
    targetName = target.name;
    targetCreatedIso = isoDate(target.created_at);
  }

  if (!oracleId) {
    redirect("/identities?error=No%20identity%20selected");
  }

  if (!namesMatch(typedName, targetName)) {
    redirect(
      "/identities?error=Name%20does%20not%20match%20-%20delete%20cancelled",
    );
  }
  if (typedDate !== targetCreatedIso) {
    redirect(
      "/identities?error=Created%20date%20does%20not%20match%20-%20delete%20cancelled",
    );
  }

  const now = new Date();
  const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error: oracleErr } = await supabase
    .from("oracles")
    .update({
      deleted_at: now.toISOString(),
      scheduled_purge_at: purgeAt.toISOString(),
    })
    .eq("id", oracleId)
    .eq("user_id", user.id);
  if (oracleErr) {
    redirect(`/identities?error=${encodeURIComponent(oracleErr.message)}`);
  }

  // If we just deleted the ACTIVE identity, detach + reset profile
  // (same as before). If we deleted a non-active one, leave profile
  // alone so the user keeps using their current active identity.
  if (oracleId === profile.active_oracle_id) {
    await supabase
      .from("profiles")
      .update({
        active_oracle_id: null,
        oracle_name: null,
        mode: "real",
        texting_style: null,
        onboarding_completed: false,
      })
      .eq("id", user.id);
  }

  await recordAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    action: "oracle_soft_deleted",
    targetUserId: user.id,
    targetId: oracleId,
    details: { scheduled_purge_at: purgeAt.toISOString() },
  });

  // Active deletion → goes through onboarding. Non-active → back to
  // the identities list with confirmation.
  if (oracleId === profile.active_oracle_id) {
    redirect("/onboarding?notice=oracle-deleted");
  }
  redirect("/identities?saved=deleted");
}

export async function createShareCode(formData: FormData) {
  const label = String(formData.get("label") ?? "").trim().slice(0, 80) || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Generate a code, retry on the (extremely unlikely) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode();
    const { error } = await supabase.from("shares").insert({
      source_user_id: user.id,
      code,
      label,
    });
    if (!error) {
      revalidatePath("/sharing");
      redirect(`/sharing?saved=share&code=${encodeURIComponent(code)}`);
    }
    // 23505 = unique violation. Anything else, abort.
    const e = error as { code?: string; message?: string };
    if (e.code !== "23505") {
      redirect(`/sharing?error=${encodeURIComponent(e.message ?? "Could not create share code")}`);
    }
  }
  redirect("/sharing?error=Could%20not%20generate%20a%20unique%20share%20code");
}

export async function createArchiveInvite(formData: FormData) {
  const inviteEmail =
    String(formData.get("invitee_email") ?? "").trim().toLowerCase() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("active_oracle_id")
    .eq("id", user.id)
    .single();
  if (!profile?.active_oracle_id) {
    redirect("/sharing?error=No%20active%20identity");
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShareCode();
    const { error } = await supabase.from("archive_invites").insert({
      oracle_id: profile.active_oracle_id,
      inviter_user_id: user.id,
      invitee_email: inviteEmail,
      code,
    });
    if (!error) {
      revalidatePath("/sharing");
      redirect(`/sharing?saved=invite&code=${encodeURIComponent(code)}`);
    }
    const e = error as { code?: string; message?: string };
    if (e.code !== "23505") {
      redirect(`/sharing?error=${encodeURIComponent(e.message ?? "Could not create invite")}`);
    }
  }
  redirect("/sharing?error=Could%20not%20generate%20a%20unique%20invite");
}

export async function revokeArchiveInvite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/sharing?error=Missing%20code");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  await supabase
    .from("archive_invites")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("code", code)
    .eq("inviter_user_id", user.id);

  revalidatePath("/sharing");
  redirect("/sharing?saved=invite-revoked");
}

export async function revokeArchiveGrant(formData: FormData) {
  const grantId = String(formData.get("grant_id") ?? "").trim();
  if (!grantId) redirect("/sharing?error=Missing%20id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Validate the caller actually owns the oracle this grant was issued on.
  // Without this, anyone could revoke anyone's grant by guessing an id.
  // RLS would also block it, but defense-in-depth: check explicitly here.
  const { data: grant } = await supabase
    .from("archive_grants")
    .select("id, oracle_id, oracles!inner(user_id)")
    .eq("id", grantId)
    .maybeSingle();

  const oracleOwnerId =
    (grant?.oracles as unknown as { user_id: string } | { user_id: string }[] | null)
      ?.constructor === Array
      ? (grant?.oracles as unknown as { user_id: string }[])[0]?.user_id
      : (grant?.oracles as unknown as { user_id: string } | null)?.user_id;

  if (!grant || oracleOwnerId !== user.id) {
    redirect("/sharing?error=Not%20authorized");
  }

  await supabase
    .from("archive_grants")
    .delete()
    .eq("id", grantId);

  revalidatePath("/sharing");
  redirect("/sharing?saved=grant-revoked");
}

export async function revokeShareCode(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/sharing?error=Missing%20code");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { error } = await supabase
    .from("shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("code", code)
    .eq("source_user_id", user.id);

  if (error) {
    redirect(`/sharing?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/sharing");
  redirect("/sharing?saved=revoked");
}

export async function deleteAccount(formData: FormData) {
  const typedName = String(formData.get("confirm_name") ?? "");
  const typedDate = String(formData.get("confirm_date") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, created_at")
    .eq("id", user.id)
    .single();

  // If the user has no oracle (already deleted it), they confirm with their
  // email instead of an oracle name.
  if (profile?.oracle_name) {
    if (!namesMatch(typedName, profile.oracle_name)) {
      redirect(
        "/account?error=Name%20does%20not%20match%20-%20delete%20cancelled",
      );
    }
  } else {
    if (typedName.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
      redirect(
        "/account?error=Email%20does%20not%20match%20-%20delete%20cancelled",
      );
    }
  }

  if (typedDate !== isoDate(profile?.created_at)) {
    redirect(
      "/account?error=Created%20date%20does%20not%20match%20-%20delete%20cancelled",
    );
  }

  // Soft delete: mark the profile + schedule purge 30 days out. Data is
  // hidden from the user (sign-in redirects them to /restore) but stays
  // in the DB so they can recover for a fee. The nightly purge cron does
  // the actual destructive cleanup once scheduled_purge_at is in the past.
  const now = new Date();
  const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({
      deleted_at: now.toISOString(),
      scheduled_purge_at: purgeAt.toISOString(),
    })
    .eq("id", user.id);

  await recordAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    action: "account_soft_deleted",
    targetUserId: user.id,
    details: { scheduled_purge_at: purgeAt.toISOString() },
  });

  // We DON'T delete auth.users yet — the user needs to be able to sign
  // back in within the grace window to restore. Sign them out so the
  // current session is invalidated; next sign-in will land on /restore.
  await supabase.auth.signOut();
  redirect("/account-deleted");
}

/**
 * Hard delete — bypasses the 30-day grace period and irreversibly removes
 * everything immediately. For users who want true GDPR-style "delete now."
 * Same name+date confirmation as the soft-delete path.
 */
export async function deleteAccountPermanently(formData: FormData) {
  const typedName = String(formData.get("confirm_name") ?? "");
  const typedDate = String(formData.get("confirm_date") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, created_at")
    .eq("id", user.id)
    .single();

  if (profile?.oracle_name) {
    if (!namesMatch(typedName, profile.oracle_name)) {
      redirect(
        "/account?error=Name%20does%20not%20match%20-%20delete%20cancelled",
      );
    }
  } else {
    if (typedName.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
      redirect(
        "/account?error=Email%20does%20not%20match%20-%20delete%20cancelled",
      );
    }
  }

  if (typedDate !== isoDate(profile?.created_at)) {
    redirect(
      "/account?error=Created%20date%20does%20not%20match%20-%20delete%20cancelled",
    );
  }

  // Audit BEFORE we lose the user record.
  await recordAudit({
    actorUserId: user.id,
    actorEmail: user.email ?? null,
    action: "account_purged_immediate",
    targetUserId: user.id,
  });

  const admin = createAdminClient();

  // Wipe app-side data, in dependency order. RLS-respecting deletes via
  // service-role since deleted profile RLS may already block us.
  await admin.from("answers").delete().eq("user_id", user.id);
  await admin.from("agreements").delete().eq("user_id", user.id);
  await admin.from("oracles").delete().eq("user_id", user.id);
  await admin.from("shares").delete().eq("source_user_id", user.id);
  await admin.from("payments").delete().eq("user_id", user.id);
  await admin.from("crisis_flags").delete().eq("user_id", user.id);
  await admin.from("message_reports").delete().eq("user_id", user.id);
  await admin.from("device_tokens").delete().eq("user_id", user.id);
  await admin.from("chat_usage").delete().eq("user_id", user.id);
  await admin.from("profiles").delete().eq("id", user.id);

  // Storage cleanup: avatars (flat <user_id>/<file>) + chat-photos
  // (nested <user_id>/<oracle_id>/<file>). Walk both shapes.
  try {
    const { data: avatarFiles } = await admin.storage
      .from("avatars")
      .list(user.id, { limit: 1000 });
    if (avatarFiles && avatarFiles.length > 0) {
      await admin.storage
        .from("avatars")
        .remove(avatarFiles.map((f) => `${user.id}/${f.name}`));
    }
  } catch (err) {
    console.error("avatars cleanup failed:", err);
  }

  try {
    const { data: oracleFolders } = await admin.storage
      .from("chat-photos")
      .list(user.id, { limit: 1000 });
    for (const folder of oracleFolders ?? []) {
      const { data: photos } = await admin.storage
        .from("chat-photos")
        .list(`${user.id}/${folder.name}`, { limit: 1000 });
      if (photos && photos.length > 0) {
        await admin.storage
          .from("chat-photos")
          .remove(
            photos.map((f) => `${user.id}/${folder.name}/${f.name}`),
          );
      }
    }
  } catch (err) {
    console.error("chat-photos cleanup failed:", err);
  }

  // Auth row last. Email becomes free, account is truly gone.
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    console.error("auth.users delete failed:", deleteUserError);
  }

  await supabase.auth.signOut();
  redirect("/account-deleted");
}

export async function addBeneficiary(formData: FormData) {
  const email =
    String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;

  if (!email || !email.includes("@")) {
    redirect("/sharing?error=Enter%20a%20valid%20email");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  if (email === (user.email ?? "").toLowerCase()) {
    redirect("/sharing?error=You%20can%27t%20designate%20yourself");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("paid_beneficiary_slots, oracle_name")
    .eq("id", user.id)
    .single();
  const cap = FREE_BENEFICIARIES + (profile?.paid_beneficiary_slots ?? 0);

  const { count: activeCount } = await supabase
    .from("beneficiaries")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", user.id)
    .neq("status", "removed");

  if ((activeCount ?? 0) >= cap) {
    redirect("/sharing?error=At%20cap%20-%20add%20a%20slot%20to%20designate%20more");
  }

  const claimToken = generateClaimToken();
  const { error } = await supabase.from("beneficiaries").insert({
    owner_user_id: user.id,
    email,
    name,
    claim_token: claimToken,
  });

  if (error) {
    const e = error as { code?: string; message?: string };
    if (e.code === "23505") {
      redirect("/sharing?error=That%20email%20is%20already%20a%20beneficiary");
    }
    redirect(`/sharing?error=${encodeURIComponent(e.message ?? "Could not add")}`);
  }

  // Send designation email — fire-and-forget, don't fail the action on email error.
  try {
    await sendBeneficiaryDesignationEmail({
      to: email,
      ownerName: profile?.oracle_name ?? user.email ?? "Someone",
      ownerEmail: user.email ?? "",
    });
    await supabase
      .from("beneficiaries")
      .update({ notified_at: new Date().toISOString() })
      .eq("owner_user_id", user.id)
      .eq("email", email);
  } catch (err) {
    console.error("beneficiary designation email failed:", err);
  }

  revalidatePath("/sharing");
  redirect("/sharing?saved=beneficiary-added");
}

export async function deletePersonaMemory(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/identities?error=Missing%20id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // RLS protects this, but add explicit user_id filter as defense-in-depth.
  await supabase
    .from("persona_memories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/identities");
  redirect("/identities?saved=memory-removed");
}

export async function restoreOracle(formData: FormData) {
  const oracleId = String(formData.get("oracle_id") ?? "").trim();
  if (!oracleId) redirect("/identities?error=Missing%20id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Confirm caller owns the soft-deleted oracle.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, deleted_at, scheduled_purge_at")
    .eq("id", oracleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!oracle || !oracle.deleted_at) {
    redirect("/identities?error=Not%20found%20or%20not%20deleted");
  }
  if (
    !isAdmin(user.email) &&
    oracle.scheduled_purge_at &&
    new Date(oracle.scheduled_purge_at).getTime() < Date.now()
  ) {
    redirect("/identities?error=Grace%20period%20expired");
  }

  // Admin escape hatch: skip Stripe entirely. Restoring during a
  // testing pass shouldn't cost $5 every time. Regular users still
  // go through the paid checkout flow below.
  if (isAdmin(user.email)) {
    await supabase
      .from("oracles")
      .update({ deleted_at: null, scheduled_purge_at: null })
      .eq("id", oracleId)
      .eq("user_id", user.id);
    revalidatePath("/identities");
    revalidatePath("/dashboard");
    redirect("/identities?saved=restored");
  }

  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const res = await fetch(`${origin}/api/stripe/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: headerList.get("cookie") ?? "",
    },
    body: JSON.stringify({
      purpose: "restore_oracle",
      oracle_id: oracleId,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.url) {
    redirect(
      `/sharing?error=${encodeURIComponent(data.error ?? "Could not start checkout")}`,
    );
  }
  redirect(data.url);
}

/**
 * Unified "add family member" action used by /sharing's merged
 * Family section. Branches on checkboxes:
 *  - access_now=on  → creates an archive invite (live access)
 *  - access_after=on → creates a beneficiary slot (inheritance)
 * At least one must be set.
 *
 * Does the work inline rather than calling the legacy actions because
 * those redirect on success/error. We need to do both before
 * redirecting once.
 */
export async function addFamilyMember(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim() || null;
  const accessNow = formData.get("access_now") === "on";
  const accessAfter = formData.get("access_after") === "on";

  if (!email || !email.includes("@")) {
    redirect("/sharing?error=Enter%20a%20valid%20email");
  }
  if (!accessNow && !accessAfter) {
    redirect("/sharing?error=Choose%20at%20least%20one%20access%20type");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const admin = createAdminClient();

  // Branch 1: live access invite.
  if (accessNow) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("active_oracle_id, oracle_name")
      .eq("id", user.id)
      .single();
    if (!profile?.active_oracle_id) {
      redirect("/sharing?error=No%20active%20identity");
    }
    let attempts = 0;
    while (attempts < 5) {
      const code = generateShareCode();
      const { error: insertErr } = await admin.from("archive_invites").insert({
        inviter_user_id: user.id,
        oracle_id: profile.active_oracle_id,
        invitee_email: email,
        code,
        status: "pending",
      });
      if (!insertErr) break;
      const e = insertErr as { code?: string };
      if (e.code === "23505") {
        attempts++;
        continue;
      }
      redirect(
        `/sharing?error=${encodeURIComponent(e.code ?? "Could not create invite")}`,
      );
    }
  }

  // Branch 2: beneficiary slot.
  if (accessAfter) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("paid_beneficiary_slots, oracle_name, deceased_at")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile) redirect("/sharing?error=No%20profile");

    if (email === user.email) {
      redirect("/sharing?error=You%20can%27t%20designate%20yourself");
    }

    const FREE = 3;
    const cap = FREE + (profile.paid_beneficiary_slots ?? 0);
    const { count: usedCount } = await admin
      .from("beneficiaries")
      .select("id", { count: "exact", head: true })
      .eq("owner_user_id", user.id)
      .neq("status", "removed");
    if ((usedCount ?? 0) >= cap) {
      redirect(
        "/sharing?error=At%20cap%20-%20add%20a%20slot%20to%20designate%20more",
      );
    }

    const { data: existing } = await admin
      .from("beneficiaries")
      .select("id")
      .eq("owner_user_id", user.id)
      .eq("email", email)
      .neq("status", "removed")
      .maybeSingle();
    if (existing) {
      // Already designated — skip silently rather than erroring;
      // user might be just adding the live-invite to an existing
      // beneficiary.
    } else {
      const claimToken = generateClaimToken();
      const { error: insertErr } = await admin.from("beneficiaries").insert({
        owner_user_id: user.id,
        email,
        name,
        status: "designated",
        claim_token: claimToken,
      });
      if (insertErr) {
        redirect(
          `/sharing?error=${encodeURIComponent(insertErr.message ?? "Could not add beneficiary")}`,
        );
      }

      sendBeneficiaryDesignationEmail({
        to: email,
        ownerName: profile.oracle_name ?? "your loved one",
        ownerEmail: user.email ?? "(unknown)",
      }).catch((e) => console.error("designation email failed:", e));

      await recordAudit({
        actorUserId: user.id,
        actorEmail: user.email ?? null,
        action: "beneficiary_added",
        targetUserId: user.id,
        targetId: null,
        details: { email, via: "family_section" },
      });
    }
  }

  revalidatePath("/sharing");
  redirect("/sharing?saved=family-added");
}

export async function buyBeneficiarySlot() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const res = await fetch(`${origin}/api/stripe/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: headerList.get("cookie") ?? "",
    },
    body: JSON.stringify({ purpose: "beneficiary_slot" }),
  });

  const data = await res.json();
  if (!res.ok || !data.url) {
    redirect(
      `/sharing?error=${encodeURIComponent(data.error ?? "Could not start checkout")}`,
    );
  }
  redirect(data.url);
}

export async function removeBeneficiary(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/sharing?error=Missing%20id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Look up the row before delete so we know who to notify.
  const { data: ben } = await supabase
    .from("beneficiaries")
    .select("email, status")
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .maybeSingle();

  // Hard-delete: a removed beneficiary slot should free up so they can
  // designate someone else without bumping into the cap.
  await supabase
    .from("beneficiaries")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", user.id);

  // Notify the beneficiary they've been removed — only if they were
  // previously notified (designation email already went out) or had
  // already claimed. Skip in the silent-removal case (added then
  // immediately removed before email landed).
  if (ben?.email && (ben.status === "designated" || ben.status === "claimed")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("oracle_name")
      .eq("id", user.id)
      .maybeSingle();
    sendBeneficiaryRemovedEmail({
      to: ben.email,
      ownerName: profile?.oracle_name ?? user.email ?? "Someone",
      ownerUserId: user.id,
    }).catch((err) =>
      console.error("beneficiary removed email failed:", err),
    );
  }

  revalidatePath("/sharing");
  redirect("/sharing?saved=beneficiary-removed");
}
