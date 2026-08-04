"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

/**
 * "$5 · buy one more slot" button on the Add-a-companion picker.
 * Posts { purpose: "oracle" } to /api/stripe/checkout — the restored
 * 'oracle' branch grants +1 extra_oracle_credits, which
 * canCreateOracle folds into the plan ceiling. The success_url on
 * that branch lands the buyer back on /identity/create?extra=1, so
 * the picker re-renders with card 1 + card 2 flipped to "Included in
 * your plan" and the buyer picks which flow to use the credit on.
 *
 * When the env price id is absent (checkoutEnabled=false) the button
 * degrades to a link to /upgrade so no dead-end 503 is shown.
 *
 * Visual: matches the mobile CardCTA (solid coral OR teal fill, NOT
 * the sitewide gradient). Card 1's overflow buys coral, card 2's
 * overflow buys teal — mobile picks the tone from the card it lives
 * inside, and we mirror that with the `tone` prop so the two picker
 * cards keep their color signature even in the paid state.
 *
 * Web-only surface. Mobile has its own iOS-hide treatment in
 * app/identity/create.tsx — this component never renders inside the
 * app.
 */
export function BuyExtraCompanionCTA({
  checkoutEnabled,
  priceCents,
  fallbackHref,
  label,
  tone = "coral",
}: {
  checkoutEnabled: boolean;
  priceCents: number;
  fallbackHref: string;
  label?: string;
  tone?: "coral" | "teal";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toneClasses =
    tone === "teal"
      ? "bg-teal hover:bg-teal-strong"
      : "bg-coral hover:bg-coral-strong";

  const baseClasses = `flex h-11 w-full items-center justify-center rounded-full text-sm font-bold tracking-[-0.2px] text-white transition-colors active:opacity-90 ${toneClasses}`;

  const buttonLabel = label ?? `Buy 1 more slot · $${priceCents / 100}`;

  if (!checkoutEnabled) {
    return (
      <Link href={fallbackHref} className={baseClasses}>
        {buttonLabel}
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
                body: JSON.stringify({ purpose: "oracle" }),
              });
              if (!res.ok) {
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
        className={`${baseClasses} disabled:opacity-60`}
      >
        {pending ? "Opening checkout…" : buttonLabel}
      </button>
      {error ? (
        <p className="mt-2 text-center text-xs text-coral-strong">{error}</p>
      ) : null}
    </div>
  );
}
