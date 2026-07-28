import { ADDON_PACKS } from "@/lib/pricing";

/**
 * Add-on pack options — one-time message/image top-ups on top of any
 * paid tier. Rendered on /upgrade below the plan cards (anchored at
 * #packs so cap-hit CTAs in chat can deep-link straight here).
 *
 * Each pack is EITHER messages OR images — one type per pack, the
 * buyer picks. Compact row style on purpose: these are top-ups, not
 * tiers, and full-height cards would compete with the plan cards
 * above.
 *
 * NOT Stripe-wired yet — no Price objects exist for the packs, so the
 * button is a mailto reserve flow (same pattern the retired Plus card
 * used before its tier landed). When Wilson creates the pack Prices,
 * swap the mailto for checkout + the credits ledger.
 */
export function PackOptions({ email }: { email: string }) {
  return (
    <div className="flex w-full flex-col gap-3">
      {ADDON_PACKS.map((pack) => (
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
          <a
            href={`mailto:hello@chapter3five.app?subject=${encodeURIComponent(
              `Reserve me a ${pack.name} pack`,
            )}&body=${encodeURIComponent(
              `Hi — I'd like a ${pack.name} add-on pack (${pack.priceLabel} one-time) for my chapter3five account (${email}). I'd like it as [+${pack.messages} messages / +${pack.images} images] — delete whichever I don't want. Please send a payment link when it's ready.\n\nThanks.`,
            )}`}
            className="flex h-11 shrink-0 items-center justify-center rounded-full border border-teal-strong/60 px-6 text-sm font-bold text-teal-strong transition-all hover:-translate-y-px hover:bg-teal-strong/10"
          >
            Reserve
          </a>
        </div>
      ))}
      <p className="mt-1 text-center text-xs text-warm-400">
        Pack checkout is coming online &mdash; reserving emails us and
        we&rsquo;ll add the pack to your account within a day.
      </p>
    </div>
  );
}
