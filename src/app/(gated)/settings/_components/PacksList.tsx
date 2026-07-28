"use client";

import { useState } from "react";

/**
 * "Extra usage" surface — compact single-row picker. Wilson's ask
 * 2026-07-28: the three-row layout felt repetitive; collapsed to one
 * copy line + a dropdown + one "Take me to pay" button.
 *
 * Each pack still credits BOTH message_credits AND image_credits per
 * the 2026-07-28 product spec ("you get both that many messages and
 * photos"). The dropdown label shows exactly what each pack adds so
 * the buyer sees the trade-off before hitting checkout.
 */
type PackId = "pack_small" | "pack_medium" | "pack_large";

type Pack = {
  id: PackId;
  name: string;
  priceCents: number;
  messages: number;
  images: number;
};

// Duplicated from PRICING to keep this client-safe. Pack names match
// the display convention Wilson chose 2026-07-28 ("Small Pack /
// Medium Pack / Large Pack" -- explicit, matches how the Stripe
// dashboard products are named).
const PACKS: Pack[] = [
  {
    id: "pack_small",
    name: "Small Pack",
    priceCents: 500,
    messages: 100,
    images: 12,
  },
  {
    id: "pack_medium",
    name: "Medium Pack",
    priceCents: 1000,
    messages: 250,
    images: 30,
  },
  {
    id: "pack_large",
    name: "Large Pack",
    priceCents: 2000,
    messages: 600,
    images: 75,
  },
];

export function PacksList() {
  const [selected, setSelected] = useState<PackId>("pack_small");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedPack = PACKS.find((p) => p.id === selected) ?? PACKS[0];

  async function buy() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: selected }),
      });
      if (!res.ok) {
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
    <div className="px-4 py-4">
      <p className="text-xs leading-relaxed text-warm-400">
        Extra messages? Extra images? Grab an add-on pack from $5.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex-1">
          <span className="sr-only">Choose a pack</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value as PackId)}
            disabled={pending}
            className="h-11 w-full appearance-none rounded-full bg-warm-700/40 px-4 pr-9 text-sm font-medium text-warm-50 ring-1 ring-warm-700/60 transition-colors hover:bg-warm-700/60 focus:outline-none focus:ring-2 focus:ring-coral/50 disabled:opacity-60"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='none' stroke='%239ca394' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M5 8l5 5 5-5'/></svg>\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
              backgroundSize: "16px",
            }}
          >
            {PACKS.map((pack) => (
              <option key={pack.id} value={pack.id}>
                {pack.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void buy()}
          disabled={pending}
          className="bg-gradient-cta h-11 shrink-0 rounded-full px-5 text-sm font-semibold text-white shadow-[0_4px_10px_-2px_rgba(232,138,118,0.35)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          {pending ? "Opening…" : "Take me to pay"}
        </button>
      </div>
      <p className="mt-2 text-xs text-warm-400">
        {selectedPack.name}: ${(selectedPack.priceCents / 100).toFixed(0)}{" "}
        &mdash; adds {selectedPack.messages} messages &amp;{" "}
        {selectedPack.images} photos.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-coral-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
