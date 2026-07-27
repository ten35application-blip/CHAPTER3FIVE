"use client";

import { useState, useTransition } from "react";

/**
 * "Manage subscription" — posts to /api/stripe/portal and redirects
 * to the Stripe Billing Portal. Users cancel, update card, view
 * invoices there.
 *
 * The portal session is short-lived (Stripe defaults ~1 hour), so
 * this button always mints a fresh one on click rather than caching
 * a URL server-side.
 */
export function ManageSubscriptionButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const res = await fetch("/api/stripe/portal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ return_url: "/settings" }),
              });
              if (!res.ok) {
                if (res.status === 404) {
                  setError(
                    "We don't have a subscription on file for this account.",
                  );
                  return;
                }
                setError("Couldn't open the billing portal. Try again.");
                return;
              }
              const data = (await res.json()) as { url?: string };
              if (data.url) {
                window.location.href = data.url;
                return;
              }
              setError("Couldn't open the billing portal. Try again.");
            } catch {
              setError("Network error. Try again.");
            }
          });
        }}
        className="flex h-14 w-full items-center justify-center rounded-full bg-ink-elevated text-base font-semibold text-warm-50 ring-1 ring-warm-700 transition-all hover:bg-warm-800/70 active:opacity-90 disabled:opacity-60"
      >
        {pending ? "Opening…" : "Manage subscription"}
      </button>
      {error ? (
        <p className="mt-3 text-center text-xs text-coral-strong">{error}</p>
      ) : null}
    </div>
  );
}
