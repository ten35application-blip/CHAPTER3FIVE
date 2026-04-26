"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateShareCode } from "@/lib/share";
import { sendBeneficiaryDesignationEmail } from "@/lib/notifications";

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

export async function updateLanguage(formData: FormData) {
  const language = String(formData.get("language") ?? "en").trim();
  if (language !== "en" && language !== "es") {
    redirect("/settings?error=Invalid%20language");
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
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?saved=language");
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
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?saved=style");
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
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect(`/settings?saved=outreach`);
}

export async function deleteOracle(formData: FormData) {
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

  if (!profile) {
    redirect("/settings?error=Profile%20not%20found");
  }

  if (!namesMatch(typedName, profile.oracle_name)) {
    redirect(
      "/settings?error=Name%20does%20not%20match%20-%20delete%20cancelled",
    );
  }
  if (typedDate !== isoDate(profile.created_at)) {
    redirect(
      "/settings?error=Created%20date%20does%20not%20match%20-%20delete%20cancelled",
    );
  }

  // Wipe answers and reset the profile. Account stays alive so the user can
  // start a new oracle from /onboarding.
  const { error: ansErr } = await supabase
    .from("answers")
    .delete()
    .eq("user_id", user.id);
  if (ansErr) {
    redirect(`/settings?error=${encodeURIComponent(ansErr.message)}`);
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .update({
      oracle_name: null,
      mode: "real",
      texting_style: null,
      onboarding_completed: false,
    })
    .eq("id", user.id);
  if (profErr) {
    redirect(`/settings?error=${encodeURIComponent(profErr.message)}`);
  }

  redirect("/onboarding?notice=oracle-deleted");
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
      revalidatePath("/settings");
      redirect(`/settings?saved=share&code=${encodeURIComponent(code)}`);
    }
    // 23505 = unique violation. Anything else, abort.
    const e = error as { code?: string; message?: string };
    if (e.code !== "23505") {
      redirect(`/settings?error=${encodeURIComponent(e.message ?? "Could not create share code")}`);
    }
  }
  redirect("/settings?error=Could%20not%20generate%20a%20unique%20share%20code");
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
    redirect("/settings?error=No%20active%20thirtyfive");
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
      revalidatePath("/settings");
      redirect(`/settings?saved=invite&code=${encodeURIComponent(code)}`);
    }
    const e = error as { code?: string; message?: string };
    if (e.code !== "23505") {
      redirect(`/settings?error=${encodeURIComponent(e.message ?? "Could not create invite")}`);
    }
  }
  redirect("/settings?error=Could%20not%20generate%20a%20unique%20invite");
}

export async function revokeArchiveInvite(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/settings?error=Missing%20code");

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

  revalidatePath("/settings");
  redirect("/settings?saved=invite-revoked");
}

export async function revokeArchiveGrant(formData: FormData) {
  const grantId = String(formData.get("grant_id") ?? "").trim();
  if (!grantId) redirect("/settings?error=Missing%20id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  await supabase.from("archive_grants").delete().eq("id", grantId);

  revalidatePath("/settings");
  redirect("/settings?saved=grant-revoked");
}

export async function revokeShareCode(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) redirect("/settings?error=Missing%20code");

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
    redirect(`/settings?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/settings");
  redirect("/settings?saved=revoked");
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
        "/settings?error=Name%20does%20not%20match%20-%20delete%20cancelled",
      );
    }
  } else {
    if (typedName.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
      redirect(
        "/settings?error=Email%20does%20not%20match%20-%20delete%20cancelled",
      );
    }
  }

  if (typedDate !== isoDate(profile?.created_at)) {
    redirect(
      "/settings?error=Created%20date%20does%20not%20match%20-%20delete%20cancelled",
    );
  }

  // Wipe app-side data first (RLS-respecting deletes via the user client).
  await supabase.from("answers").delete().eq("user_id", user.id);
  await supabase.from("agreements").delete().eq("user_id", user.id);
  await supabase.from("oracles").delete().eq("user_id", user.id);
  await supabase.from("shares").delete().eq("source_user_id", user.id);
  await supabase.from("payments").delete().eq("user_id", user.id);
  await supabase.from("crisis_flags").delete().eq("user_id", user.id);
  await supabase.from("message_reports").delete().eq("user_id", user.id);
  await supabase.from("profiles").delete().eq("id", user.id);

  // Then delete the auth.users row itself via the service-role admin client.
  // Without this, the email stays "taken" forever and the account isn't
  // actually gone.
  const admin = createAdminClient();
  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) {
    // Don't surface the cascade error to the user — their data is gone, the
    // residual auth row will be cleaned up by ops. Still log it for review.
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
    redirect("/settings?error=Enter%20a%20valid%20email");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  if (email === (user.email ?? "").toLowerCase()) {
    redirect("/settings?error=You%20can%27t%20designate%20yourself");
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
    redirect("/settings?error=At%20cap%20-%20add%20a%20slot%20to%20designate%20more");
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
      redirect("/settings?error=That%20email%20is%20already%20a%20beneficiary");
    }
    redirect(`/settings?error=${encodeURIComponent(e.message ?? "Could not add")}`);
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

  revalidatePath("/settings");
  redirect("/settings?saved=beneficiary-added");
}

export async function deletePersonaMemory(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/settings?error=Missing%20id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // RLS: only the user_id on the row can delete (their own memories).
  await supabase.from("persona_memories").delete().eq("id", id);

  revalidatePath("/settings");
  redirect("/settings?saved=memory-removed");
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
      `/settings?error=${encodeURIComponent(data.error ?? "Could not start checkout")}`,
    );
  }
  redirect(data.url);
}

export async function removeBeneficiary(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/settings?error=Missing%20id");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");

  // Hard-delete: a removed beneficiary slot should free up so they can
  // designate someone else without bumping into the cap.
  await supabase
    .from("beneficiaries")
    .delete()
    .eq("id", id)
    .eq("owner_user_id", user.id);

  revalidatePath("/settings");
  redirect("/settings?saved=beneficiary-removed");
}
