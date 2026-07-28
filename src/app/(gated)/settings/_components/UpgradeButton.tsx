"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

/**
 * Checkout CTA on /settings and /upgrade. When the matching price
 * env is configured (checkoutEnabled === true), the button POSTs to
 * /api/stripe/checkout with the given purpose (pro_monthly by
 * default; basic_monthly for the Basic card;
 * inherited_slot_purchase for the one-time inherit-slot credit) and
 * redirects to Stripe Checkout. Otherwise it falls back to a link
 * (typically /upgrade) so the mailto flow on that page still works.
 *
 * tone picks the gradient: "coral" (Pro, the default) or "teal"
 * (Basic) so each plan card's button matches its frame.
 */
export function UpgradeButton({
  checkoutEnabled,
  fallbackHref,
  label = "Upgrade to Pro",
  purpose = "pro_monthly",
  tone = "coral",
}: {
  checkoutEnabled: boolean;
  fallbackHref: string;
  label?: string;
  purpose?: "pro_monthly" | "basic_monthly" | "inherited_slot_purchase";
  tone?: "coral" | "teal";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const coralClasses =
    "bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_14px_36px_-10px_rgba(232,138,118,0.55),_0_4px_12px_rgba(126,196,196,0.15)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90";
  const tealClasses =
    "flex h-14 w-full items-center justify-center rounded-full px-6 text-base font-bold text-white transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90";
  const tealStyle = {
    background:
      "linear-gradient(135deg, var(--color-teal) 0%, var(--color-teal-strong) 100%)",
    boxShadow:
      "0 14px 32px -10px rgba(126,196,196,0.5), 0 4px 12px -4px rgba(126,196,196,0.3)",
  } as const;
  const classes = tone === "teal" ? tealClasses : coralClasses;
  const style = tone === "teal" ? tealStyle : undefined;

  if (!checkoutEnabled) {
    return (
      <Link href={fallbackHref} className={classes} style={style}>
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
                body: JSON.stringify({ purpose }),
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
        className={`${classes} disabled:opacity-60`}
        style={style}
      >
        {pending ? "Opening checkout…" : label}
      </button>
      {error ? (
        <p className="mt-3 text-center text-xs text-coral-strong">{error}</p>
      ) : null}
    </div>
  );
}
