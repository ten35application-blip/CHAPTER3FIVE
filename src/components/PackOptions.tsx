"use client";

import { useState, useTransition } from "react";
import { ADDON_PACKS } from "@/lib/pricing";

/**
 * Add-on pack options — one-time message/image top-ups on top of any
 * paid tier. Rendered on /upgrade below the plan cards (anchored at
 * #packs so cap-hit CTAs in chat can deep-link straight here).
 *
 * Each pack is EITHER messages OR images — one type per pack, the
 * buyer picks with the toggle BEFORE hitting Reserve (default:
 * messages), and the pick rides to /api/stripe/checkout as
 * `pack_type` so the webhook credits the right balance column.
 * Compact row style on purpose: these are top-ups, not tiers, and
 * full-height cards would compete with the plan cards above.
 *
 * Per-pack Stripe wiring is flagged through `checkoutEnabled`
 * (computed server-side from the STRIPE_PRICE_ID_PACK_* envs — envs
 * aren't readable in a client component). A pack whose Price doesn't
 * exist yet keeps the mailto reserve fallback.
 */
export function PackOptions({
  email,
  checkoutEnabled,
}: {
  email: string;
  /** Which packs have a Stripe Price env configured. */
  checkoutEnabled?: { small: boolean; medium: boolean; large: boolean };
}) {
  const [types, setTypes] = useState<
    Record<string, "message" | "image">
  >({});
  const [pending, startTransition] = useTransition();
  const [pendingPack, setPendingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const anyStripe =
    checkoutEnabled?.small || checkoutEnabled?.medium || checkoutEnabled?.large;

  const startCheckout = (packId: "small" | "medium" | "large") => {
    setError(null);
    setPendingPack(packId);
    startTransition(async () => {
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            purpose: `pack_${packId}`,
            pack_type: types[packId] ?? "message",
          }),
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
      } finally {
        setPendingPack(null);
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-3">
      {ADDON_PACKS.map((pack) => {
        const type = types[pack.id] ?? "message";
        const stripeReady = Boolean(checkoutEnabled?.[pack.id]);
        const isPending = pending && pendingPack === pack.id;
        return (
          <div
            key={pack.id}
            className="flex flex-col gap-4 rounded-2xl border border-warm-700/70 bg-ink-soft/60 p-5 text-left sm:flex-row sm:items-center"
          >
            <div className="flex-1">
              <p className="text-sm font-bold uppercase tracking-[0.14em] text-warm-300">
                {pack.name} pack
                <span className="ml-2 normal-case tracking-normal text-warm-50">
                  {pack.priceLabel}
                </span>
                <span className="ml-1 text-xs font-semibold normal-case tracking-normal text-warm-400">
                  one-time
                </span>
              </p>
              <p className="mt-1 text-sm text-warm-200">
                <strong className="text-warm-50">
                  +{pack.messages} messages
                </strong>{" "}
                <span className="text-warm-400">or</span>{" "}
                <strong className="text-warm-50">+{pack.images} images</strong>{" "}
                &mdash; your pick, one type per pack.
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              {/* Message/image toggle — the pick that decides which
                  balance the webhook credits. Defaults to messages. */}
              <div
                role="radiogroup"
                aria-label={`${pack.name} pack type`}
                className="flex overflow-hidden rounded-full border border-warm-700/70 text-xs font-semibold"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={type === "message"}
                  onClick={() =>
                    setTypes((t) => ({ ...t, [pack.id]: "message" }))
                  }
                  className={`px-3 py-1.5 transition-colors ${
                    type === "message"
                      ? "bg-teal-strong/20 text-teal-strong"
                      : "text-warm-400 hover:text-warm-200"
                  }`}
                >
                  +{pack.messages} messages
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={type === "image"}
                  onClick={() =>
                    setTypes((t) => ({ ...t, [pack.id]: "image" }))
                  }
                  className={`px-3 py-1.5 transition-colors ${
                    type === "image"
                      ? "bg-teal-strong/20 text-teal-strong"
                      : "text-warm-400 hover:text-warm-200"
                  }`}
                >
                  +{pack.images} images
                </button>
              </div>
              {stripeReady ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startCheckout(pack.id)}
                  className="flex h-11 items-center justify-center rounded-full border border-teal-strong/60 px-6 text-sm font-bold text-teal-strong transition-all hover:-translate-y-px hover:bg-teal-strong/10 disabled:opacity-60"
                >
                  {isPending ? "Opening checkout…" : "Reserve"}
                </button>
              ) : (
                <a
                  href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
                    `Reserve me a ${pack.name} pack`,
                  )}&body=${encodeURIComponent(
                    `Hi — I'd like a ${pack.name} add-on pack (${pack.priceLabel} one-time) for my chapter3five account (${email}), as +${
                      type === "image" ? pack.images : pack.messages
                    } ${type === "image" ? "images" : "messages"}. Please send a payment link when it's ready.\n\nThanks.`,
                  )}`}
                  className="flex h-11 items-center justify-center rounded-full border border-teal-strong/60 px-6 text-sm font-bold text-teal-strong transition-all hover:-translate-y-px hover:bg-teal-strong/10"
                >
                  Reserve
                </a>
              )}
            </div>
          </div>
        );
      })}
      {error ? (
        <p className="mt-1 text-center text-xs text-coral-strong">{error}</p>
      ) : null}
      <p className="mt-1 text-center text-xs text-warm-400">
        {anyStripe ? (
          <>
            One-time purchase &mdash; credits land on your account the
            moment payment clears, and they never expire.
          </>
        ) : (
          <>
            Pack checkout is coming online &mdash; reserving emails us
            and we&rsquo;ll add the pack to your account within a day.
          </>
        )}
      </p>
    </div>
  );
}
