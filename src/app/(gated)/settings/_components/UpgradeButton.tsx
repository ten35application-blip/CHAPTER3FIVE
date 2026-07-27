"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

/**
 * Upgrade CTA on /settings and /upgrade. When STRIPE_PRICE_ID_PRO_MONTHLY
 * is configured (checkoutEnabled === true), the button POSTs to
 * /api/stripe/checkout with purpose=pro_monthly and redirects to
 * Stripe Checkout. Otherwise it falls back to a link (typically /upgrade)
 * so the mailto flow on that page still works.
 */
export function UpgradeButton({
  checkoutEnabled,
  fallbackHref,
  label = "Upgrade to Pro",
}: {
  checkoutEnabled: boolean;
  fallbackHref: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!checkoutEnabled) {
    return (
      <Link
        href={fallbackHref}
        className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_14px_36px_-10px_rgba(232,138,118,0.55),_0_4px_12px_rgba(126,196,196,0.15)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90"
      >
        {label}
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ purpose: "pro_monthly" }),
              });
              if (!res.ok) {
                const body = (await res.json().catch(() => null)) as
                  | { error?: string }
                  | null;
                if (body?.error === "already_subscribed") {
                  setError(
                    "You already have an active subscription. Head to Settings → Manage subscription.",
                  );
                  return;
                }
                setError("Couldn't start checkout. Try again.");
                return;
              }
              const data = (await res.json()) as { url?: string };
              if (data.url) {
                window.location.href = data.url;
                return;
              }
              setError("Couldn't start checkout. Try again.");
            } catch {
              setError("Network error. Try again.");
            }
          });
        }}
        className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_14px_36px_-10px_rgba(232,138,118,0.55),_0_4px_12px_rgba(126,196,196,0.15)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90 disabled:opacity-60"
      >
        {pending ? "Opening checkout…" : label}
      </button>
      {error ? (
        <p className="mt-3 text-center text-xs text-coral-strong">{error}</p>
      ) : null}
    </div>
  );
}
