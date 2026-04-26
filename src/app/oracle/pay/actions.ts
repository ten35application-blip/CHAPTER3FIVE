"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function startOracleCheckout() {
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
    headers: { "Content-Type": "application/json", cookie: headerList.get("cookie") ?? "" },
    body: JSON.stringify({ purpose: "oracle" }),
  });

  const data = await res.json();
  if (!res.ok || !data.url) {
    redirect(
      `/oracle/pay?error=${encodeURIComponent(data.error ?? "Could not start checkout")}`,
    );
  }
  redirect(data.url);
}
