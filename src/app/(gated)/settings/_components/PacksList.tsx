"use client";

import { useState } from "react";

/**
 * "Extra usage" surface for Settings. Shows the three one-time
 * add-on packs so users can proactively top up before or after
 * hitting a cap — Wilson's ask 2026-07-28: "or you can go into the
 * settings at any time... it'll have the amounts you can click and
 * then press take me to pay."
 *
 * Each pack has TWO buttons (messages vs photos) because pack_type
 * is chosen at checkout, not baked into the price. The checkout
 * endpoint already understands purpose='pack_small|medium|large' +
 * pack_type='message|image' metadata; the webhook credits the right
 * counter (message_credits or image_credits) on success.
 *
 * Compact-list style, not marketing cards — matches the "Settings
 * reads like Settings" bar we set for the inherit codes surface.
 */
type Pack = {
  purpose: "pack_small" | "pack_medium" | "pack_large";
  name: string;
  priceCents: number;
  messages: number;
  images: number;
};

// Duplicated from PRICING to keep this client-safe (pricing.ts pulls
// in nothing sensitive but avoiding a client bundle grow-through is
// worth the 6 lines of static data here).
const PACKS: Pack[] = [
  {
    purpose: "pack_small",
    name: "Small pack",
    priceCents: 500,
    messages: 100,
    images: 12,
  },
  {
    purpose: "pack_medium",
    name: "Medium pack",
    priceCents: 1000,
    messages: 250,
    images: 30,
  },
  {
    purpose: "pack_large",
    name: "Large pack",
    priceCents: 2000,
    messages: 600,
    images: 75,
  },
];

export function PacksList() {
  return (
    <div className="flex flex-col divide-y divide-warm-700/60">
      <p className="px-4 pb-3 pt-4 text-xs leading-relaxed text-warm-400">
        Top up whenever you want &mdash; each pack is a one-time
        purchase and adds to whatever's left of your monthly quota.
      </p>
      {PACKS.map((pack) => (
        <PackRow key={pack.purpose} pack={pack} />
      ))}
    </div>
  );
}

function PackRow({ pack }: { pack: Pack }) {
  const [pending, setPending] = useState<null | "message" | "image">(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(packType: "message" | "image") {
    setError(null);
    setPending(packType);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: pack.purpose,
          pack_type: packType,
        }),
      });
      if (!res.ok) {
        // Env not wired yet -> 503 from the endpoint. Surface plainly
        // so this doesn't look like a mystery failure.
        if (res.status === 503) {
          setError("Pack checkout isn't configured yet.");
        } else {
          setError("Couldn't start checkout. Try again in a moment.");
        }
        setPending(null);
        return;
      }
      const body = (await res.json()) as { url?: string };
      if (body.url) {
        // Full-page nav to Stripe -- checkout expects to own the
        // whole browser context, not iframe from us.
        window.location.href = body.url;
        return;
      }
      setError("Checkout link missing. Try again.");
      setPending(null);
    } catch (err) {
      console.error("[packs] checkout POST failed:", err);
      setError("Network hiccup. Try again.");
      setPending(null);
    }
  }

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[15px] font-medium text-warm-50">{pack.name}</p>
        <p className="text-sm font-semibold text-warm-100">
          ${(pack.priceCents / 100).toFixed(0)}
        </p>
      </div>
      <p className="mt-1 text-xs text-warm-400">
        {pack.messages} messages &nbsp;or&nbsp; {pack.images} photos
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void buy("message")}
          disabled={pending !== null}
          className="rounded-full bg-warm-700/40 px-3.5 py-1.5 text-xs font-medium text-warm-100 ring-1 ring-warm-700/60 transition-colors hover:bg-warm-700/60 disabled:opacity-60"
        >
          {pending === "message" ? "Opening checkout…" : "Buy for messages"}
        </button>
        <button
          type="button"
          onClick={() => void buy("image")}
          disabled={pending !== null}
          className="rounded-full bg-warm-700/40 px-3.5 py-1.5 text-xs font-medium text-warm-100 ring-1 ring-warm-700/60 transition-colors hover:bg-warm-700/60 disabled:opacity-60"
        >
          {pending === "image" ? "Opening checkout…" : "Buy for photos"}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-coral-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
