"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

  if (!email || !email.includes("@")) {
    redirect("/auth/signup?error=Please%20enter%20a%20valid%20email");
  }
  if (password.length < 8) {
    redirect(
      "/auth/signup?error=Password%20must%20be%20at%20least%208%20characters",
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
  if (data.session) {
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
