"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWelcomeEmail } from "@/lib/notifications";

async function emailExists(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.rpc("user_email_exists", {
    check_email: email,
  });
  return data === true;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@")) {
    redirect("/auth/signin?error=Please%20enter%20a%20valid%20email");
  }
  if (!password) {
    redirect("/auth/signin?error=Please%20enter%20your%20password");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/onboarding");
}

export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ageConfirmed = formData.get("age_confirmed") === "on";

  if (!email || !email.includes("@")) {
    redirect("/auth/signup?error=Please%20enter%20a%20valid%20email");
  }
  if (password.length < 8) {
    redirect(
      "/auth/signup?error=Password%20must%20be%20at%20least%208%20characters",
    );
  }
  if (!ageConfirmed) {
    redirect(
      "/auth/signup?error=You%20must%20be%2018%20or%20older%20to%20use%20chapter3five",
    );
  }

  if (await emailExists(email)) {
    redirect(
      `/auth/signup?error=That%20email%20is%20already%20registered.%20Try%20signing%20in%20instead.&exists=1`,
    );
  }

  const supabase = await createClient();
  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
  }

  // If session is returned immediately, email confirmation is disabled and
  // the user is already signed in. Otherwise show "check your email".
  if (data.session && data.user) {
    sendWelcomeEmail({ to: email, userId: data.user.id }).catch((e) =>
      console.error("welcome email failed:", e),
    );
    redirect("/onboarding");
  }
  redirect(`/auth/signup?sent=${encodeURIComponent(email)}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    redirect("/auth/forgot-password?error=Please%20enter%20a%20valid%20email");
  }

  if (!(await emailExists(email))) {
    redirect(
      `/auth/forgot-password?error=No%20account%20found%20with%20that%20email.%20Try%20signing%20up%20instead.&notfound=${encodeURIComponent(email)}`,
    );
  }

  const supabase = await createClient();
  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
  });

  if (error) {
    redirect(
      `/auth/forgot-password?error=${encodeURIComponent(error.message)}`,
    );
  }

  redirect(`/auth/forgot-password?sent=${encodeURIComponent(email)}`);
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    redirect(
      "/auth/reset-password?error=Password%20must%20be%20at%20least%208%20characters",
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin?error=Reset%20link%20expired,%20try%20again");
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/onboarding");
}
