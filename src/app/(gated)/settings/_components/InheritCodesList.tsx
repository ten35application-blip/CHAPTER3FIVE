"use client";

import { useState, useTransition } from "react";

import { retryMintInheritCode, revokeInheritCode } from "../actions";

/**
 * Inherit codes surface, rendered INLINE inside the Profile section
 * (settings/page.tsx) directly below NameField.
 *
 * Two-slot layout — mirrors the 1+1 legacy cap enforced in
 * completeLegacyIdentity (one self + one other per account). Each slot
 * has two states:
 *   - EMPTY: a CTA pointing at the picker with the mode pre-set
 *     (?mode=self or ?mode=other).
 *   - FILLED: the identity's name + code + a Share button (Web Share
 *     API when available, clipboard fallback otherwise).
 *
 * Wilson's ask 2026-07-28: users should SEE the two-slot shape up
 * front — one for themselves, one for a loved one — so the flow
 * doesn't feel like a single ambiguous "inherit code" surface. When a
 * slot fills, the CTA is replaced by the actual code + share button
 * in the same footprint.
 *
 * Pre-mode codes (mode === null, minted before the toggle shipped
 * 2026-07-28) are grouped under the "For someone you love" slot as
 * the historical default. That matches the cap logic which treats
 * unlabeled rows as "other" for the 1+1 count.
 */
type CodeItem = {
  oracleId: string;
  name: string;
  code: string;
  /** "self" = user recorded themselves; "other" = they recorded a
   *  loved one. Null for codes minted before the mode toggle shipped
   *  (2026-07-28) — those group with "other" as the historical
   *  default, matching the completeLegacyIdentity cap counter. */
  mode: "self" | "other" | null;
};

export function InheritCodesList({
  items,
  codeless = [],
}: {
  items: Array<CodeItem>;
  /** Legacy archives that exist but have NO live code — a failed mint
   *  or a revoke. They must never render as an empty slot; the user
   *  paid for these and has nothing to hand anyone. */
  codeless?: Array<{ oracleId: string; name: string }>;
}) {
  // Slot bucketing: mode='self' → self slot; mode='other' OR null →
  // other slot. If somehow more than one exists per mode (shouldn't
  // happen after the 1+1 cap, but defensive), we take the first.
  const selfItem = items.find((i) => i.mode === "self") ?? null;
  const otherItem =
    items.find((i) => i.mode === "other" || i.mode === null) ?? null;

  return (
    <div className="px-4 py-4">
      <p className="mb-4 text-xs leading-relaxed text-warm-400">
        Two slots per account &mdash; one for yourself, one for a loved one.
        Share the code with family so they can meet the person you&rsquo;re
        keeping alive.
      </p>
      <div className="flex flex-col gap-3">
        <Slot
          heading="Your own"
          emptyPlaceholder="When you record yourself, your code will appear here."
          item={selfItem}
        />
        <Slot
          heading="For someone you love"
          emptyPlaceholder="When you record someone you love, their code will appear here."
          item={otherItem}
        />
        {codeless.map((c) => (
          <NeedsCodeSlot key={c.oracleId} oracleId={c.oracleId} name={c.name} />
        ))}
      </div>
    </div>
  );
}

/**
 * A legacy archive that exists but has no live code.
 *
 * Either the mint failed at creation (best-effort, and previously
 * silent — the user paid, answered thirty questions, and Settings
 * rendered an empty placeholder as though none of it happened), or they
 * revoked the only code and had no way to issue another.
 *
 * Says plainly that the archive is safe, because that is the thing the
 * person is actually afraid of.
 */
function NeedsCodeSlot({
  oracleId,
  name,
}: {
  oracleId: string;
  name: string;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-2xl bg-ink p-3.5 ring-1 ring-coral/40">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-coral-strong">
        Needs a code
      </p>
      <p className="mt-1.5 truncate text-sm font-medium text-warm-50">{name}</p>

      {code ? (
        <>
          <p className="mt-0.5 font-mono text-xs tracking-wider text-warm-300">
            {code}
          </p>
          <div className="mt-2">
            <ShareButton code={code} name={name} />
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-[12px] leading-4 text-warm-300">
            This archive is saved and safe &mdash; it just doesn&rsquo;t have a
            code to share yet. Make one now and you can hand it to family.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await retryMintInheritCode(oracleId);
                if (res.ok) setCode(res.code);
                else setError(res.error);
              })
            }
            className="mt-2.5 rounded-full bg-coral-strong px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {pending ? "Making a code…" : "Make a code"}
          </button>
        </>
      )}

      {error ? (
        <p className="mt-1.5 text-[11px] text-red-500">{error}</p>
      ) : null}
    </div>
  );
}

function Slot({
  heading,
  emptyPlaceholder,
  item,
}: {
  heading: string;
  emptyPlaceholder: string;
  item: CodeItem | null;
}) {
  return (
    <div className="rounded-2xl bg-ink p-3.5 ring-1 ring-warm-700">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-coral-strong">
        {heading}
      </p>
      {item ? (
        <FilledSlot item={item} />
      ) : (
        // Passive placeholder. Wilson's ask 2026-07-28: Settings is a
        // state mirror, not a discovery surface -- creation lives on
        // /identity/create, and the picker is the canonical door. No
        // CTA here so the section reads like Settings, not marketing.
        <p className="mt-1.5 text-xs italic leading-relaxed text-warm-400">
          {emptyPlaceholder}
        </p>
      )}
    </div>
  );
}

function FilledSlot({ item }: { item: CodeItem }) {
  // Two-step revoke. A single tap is too cheap for something that can
  // lock a family out of a person, and there is no undo — the code is
  // gone and a new one has to be reissued and re-delivered.
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-warm-50">
            {item.name}
          </p>
          <p className="mt-0.5 font-mono text-xs tracking-wider text-warm-300">
            {item.code}
          </p>
        </div>
        <ShareButton code={item.code} name={item.name} />
      </div>

      {confirming ? (
        <div className="mt-2 rounded-xl bg-warm-700 px-3 py-2.5">
          <p className="text-[12px] leading-4 text-warm-200">
            Revoking stops anyone new from using this code. Anyone who has
            already redeemed it keeps their copy &mdash; that one is theirs
            now. The old code stops working for good, but your archive is
            untouched and you can make a fresh code right here afterwards.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await revokeInheritCode(item.oracleId);
                  if (!res.ok) {
                    setError(res.error);
                    setConfirming(false);
                  }
                })
              }
              className="rounded-full bg-coral-strong px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {pending ? "Revoking…" : "Revoke it"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-warm-300"
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          className="mt-1.5 text-[11px] font-medium text-warm-400 underline underline-offset-2 transition-colors hover:text-warm-200"
        >
          Revoke this code
        </button>
      )}

      {error ? (
        <p className="mt-1.5 text-[11px] text-red-500">{error}</p>
      ) : null}
    </div>
  );
}

function ShareButton({ code, name }: { code: string; name: string }) {
  // Two feedback states because the two flows land differently:
  //   "Copied" — clipboard fallback (Web Share unsupported / dismissed)
  //   "Shared" — the OS share sheet came back with a completed hand-off
  const [status, setStatus] = useState<"idle" | "copied" | "shared">("idle");

  async function onShare() {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    // What the recipient reads. Chosen for text-message tone: short,
    // warm, includes the plain code so they can copy from the SMS
    // itself, and points them at the exact redemption page.
    const shareText =
      `I made an inherit code so you can meet ${name} on chapter3five.\n\n` +
      `Code: ${code}\n\n` +
      `Redeem it at ${origin}/identity/inherit`;
    const title = `Meet ${name} on chapter3five`;

    // Web Share is well-supported on iOS/Android; on desktop Chromium
    // it may or may not be present. Feature-detect and fall back to
    // clipboard copy so the code never ends up unreachable.
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({ title, text: shareText });
        setStatus("shared");
        window.setTimeout(() => setStatus("idle"), 1600);
        return;
      } catch (err) {
        // AbortError = user dismissed the sheet: not an error, just no-op.
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Any other failure falls through to the clipboard path so the
        // user still ends up with the code on their pasteboard.
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch {
      // Clipboard unavailable — the code is still visible in the row
      // above so the user can hand-select it.
    }
  }

  const label =
    status === "shared" ? "Shared" : status === "copied" ? "Copied" : "Share";

  return (
    <button
      type="button"
      onClick={() => void onShare()}
      aria-label={`Share the inherit code for ${name}`}
      className="flex shrink-0 items-center gap-1.5 rounded-full bg-coral px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-coral-strong"
    >
      <span aria-hidden>
        <ShareIcon />
      </span>
      <span>{label}</span>
    </button>
  );
}

function ShareIcon() {
  // Paper plane -- Wilson's ask 2026-07-28 ("a paperplane with our
  // colors"). Filled triangle body + a subtle inner fold line so it
  // reads as "send", not a random arrow. Uses currentColor so the
  // parent's gradient text-fill (bg-gradient-cta on the button)
  // paints it in the coral+teal palette.
  return (
    <svg
      viewBox="0 0 20 20"
      width="13"
      height="13"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.6 2.4a1 1 0 0 1 .3 1.02l-4.2 13.3a1 1 0 0 1-1.83.16l-2.62-4.9-4.9-2.62a1 1 0 0 1 .16-1.83L17.02 2.1a1 1 0 0 1 .58.3zM8.7 11.3l1.7 3.18 2.85-9.03L8.7 11.3z" />
    </svg>
  );
}
