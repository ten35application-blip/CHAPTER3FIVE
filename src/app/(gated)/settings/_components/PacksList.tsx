"use client";

import { useState } from "react";

/**
 * "Extra usage" surface for Settings. Shows the three one-time
 * add-on packs so users can proactively top up before or after
 * hitting a cap.
 *
 * Each pack credits BOTH message_credits and image_credits on the
 * user's profile — Wilson's product spec 2026-07-28: "you get both
 * that many messages and photos, it's not separate." One button per
 * pack, one payment, both counters bumped by the pack's amounts.
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
        purchase that adds messages AND photos to whatever&rsquo;s
        left of your monthly quota.
      </p>
      {PACKS.map((pack) => (
        <PackRow key={pack.purpose} pack={pack} />
      ))}
    </div>
  );
}

function PackRow({ pack }: { pack: Pack }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: pack.purpose }),
      });
      if (!res.ok) {
        // Env not wired yet -> 503 from the endpoint. Surface plainly
        // so this doesn't look like a mystery failure.
        if (res.status === 503) {
          setError("Pack checkout isn't configured yet.");
        } else {
          setError("Couldn't start checkout. Try again in a moment.");
        }
        setPending(false);
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
      setPending(false);
    } catch (err) {
      console.error("[packs] checkout POST failed:", err);
      setError("Network hiccup. Try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-warm-50">
          {pack.name}{" "}
          <span className="ml-1 text-sm font-semibold text-warm-200">
            ${(pack.priceCents / 100).toFixed(0)}
          </span>
        </p>
        <p className="mt-1 text-xs text-warm-400">
          {pack.messages} messages &amp; {pack.images} photos
        </p>
        {error ? (
          <p role="alert" className="mt-1.5 text-xs font-medium text-coral-strong">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void buy()}
        disabled={pending}
        className="bg-gradient-cta shrink-0 rounded-full px-4 py-2 text-xs font-semibold text-white shadow-[0_4px_10px_-2px_rgba(232,138,118,0.35)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
      >
        {pending ? "Opening…" : "Take me to pay"}
      </button>
    </div>
  );
}
