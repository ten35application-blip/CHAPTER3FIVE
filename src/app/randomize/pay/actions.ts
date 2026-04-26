"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";

export async function startCheckout() {
  const headerList = await headers();
  const host = headerList.get("host") ?? "chapter3five.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  // Hit our own checkout endpoint, then redirect the user to Stripe's URL.
  const res = await fetch(`${origin}/api/stripe/checkout`, {
    method: "POST",
    headers: {
      cookie: headerList.get("cookie") ?? "",
    },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    redirect(
      `/randomize/pay?error=${encodeURIComponent(data.error ?? "Could not start checkout")}`,
    );
  }

  const data = (await res.json()) as { url?: string };
  if (!data.url) {
    redirect("/randomize/pay?error=No%20checkout%20URL%20returned");
  }
  redirect(data.url);
}
