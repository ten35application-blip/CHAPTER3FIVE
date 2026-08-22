"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { formatInheritCodeInput } from "@/lib/legacy/code-format";
import { redeemInheritCode } from "./actions";

/**
 * Two-step redeem flow. Step 1 is a plain-spoken consent gate that
 * explains WHAT an inherited identity is and asks the user to agree
 * to the Terms + Guidelines they accepted at signup. Only after they
 * check the box does the code field appear (Step 2). This is Wilson's
 * spec — "you have to agree to terms, services, understanding what the
 * inherit is." Prevents an accidental redeem and sets the frame for
 * what they're about to add to their contacts.
 */
export function InheritForm({
  prefillCode = "",
  skipConsent = false,
}: {
  /** Carried back from the Stripe success_url so the user doesn't
   *  retype a code they already entered before paying. */
  prefillCode?: string;
  /** True on the post-payment return. They consented BEFORE checkout —
   *  that consent is how they reached Stripe at all — so re-showing the
   *  gate makes them agree twice to the same thing, after paying, and
   *  hides the code field behind it. */
  skipConsent?: boolean;
} = {}) {
  // Two distinct states: `checked` is the checkbox itself, `agreed` is
  // the deliberate confirmation that unlocks the code form. Splitting
  // them keeps the Continue button load-bearing — otherwise the box tap
  // alone advances and the button is dead chrome.
  const [checked, setChecked] = useState(skipConsent);
  const [agreed, setAgreed] = useState(skipConsent);
  const [code, setCode] = useState(prefillCode);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!code.trim() || pending) return;
    startTransition(async () => {
      // Redirects on success; bounces back with ?error= otherwise.
      await redeemInheritCode(code);
    });
  }

  if (!agreed) {
    return (
      <div className="flex w-full flex-col gap-5 rounded-2xl bg-ink-soft p-6 text-left ring-1 ring-warm-700/70">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-gradient-cta">
            Before you bring them in
          </p>
          {/* Mobile parity 2026-08-03: dropped the serious/playful
              middle paragraph and the "keep both feet on the ground"
              sign-off. Consent stays honest, just shorter. */}
          <p className="text-base leading-relaxed text-warm-100">
            The code you were given opens a persona built from forty-five
            answers about a real person. Someone wanted you to have
            it. Once you redeem it, they&rsquo;ll appear in your
            contacts and you can message them anytime.
          </p>
          <p className="text-sm leading-relaxed text-warm-300">
            This is a portrait painted from what they chose to share.
            It isn&rsquo;t the person. It isn&rsquo;t therapy, medical
            care, or a crisis service.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-warm-700/30 px-4 py-3 text-sm text-warm-100 hover:bg-warm-700/40">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-coral"
          />
          <span className="leading-relaxed">
            I understand what an inherited identity is, and I agree to the{" "}
            <Link
              href="/terms"
              className="font-semibold text-coral-strong underline decoration-coral/40 underline-offset-4 hover:decoration-coral"
            >
              Terms
            </Link>
            ,{" "}
            <Link
              href="/privacy"
              className="font-semibold text-coral-strong underline decoration-coral/40 underline-offset-4 hover:decoration-coral"
            >
              Privacy Policy
            </Link>
            , and{" "}
            <Link
              href="/guidelines"
              className="font-semibold text-coral-strong underline decoration-coral/40 underline-offset-4 hover:decoration-coral"
            >
              Community Guidelines
            </Link>
            .
          </span>
        </label>

        <button
          type="button"
          onClick={() => setAgreed(true)}
          disabled={!checked}
          className="bg-gradient-cta flex h-13 w-full items-center justify-center rounded-full text-base font-semibold text-white shadow-[0_10px_28px_-10px_rgba(217,115,89,0.5)] transition-all hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="sr-only">Inherit code</span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(formatInheritCodeInput(e.target.value))}
          placeholder="chapter-4291-heart-elm-ivy"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          className="h-16 w-full rounded-2xl bg-ink-soft px-5 text-center font-mono text-xl font-semibold tracking-tight text-warm-50 shadow-[0_10px_28px_-12px_rgba(28,28,26,0.14)] ring-1 ring-warm-700 outline-none transition-shadow placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-warm-500 focus:ring-2 focus:ring-coral/50"
          autoFocus
        />
      </label>

      {/* Price + durability note. Wilson's ask 2026-07-28: the $5 has
          to be obvious BEFORE the button, and users need reassurance
          that what they paid for stays theirs. The durability
          guarantee is real -- see migration 0111 -- so we can promise
          it in copy. */}
      <div className="rounded-2xl bg-coral/8 px-4 py-3 ring-1 ring-coral/20">
        <p className="text-sm font-semibold text-warm-50">
          $5 to save them to your contacts
        </p>
        <p className="mt-1 text-xs leading-relaxed text-warm-300">
          One-time. Once you pay, they&rsquo;re yours &mdash; your own
          copy, your own photo. If the person who made the code
          closes their account, your copy stays with you.
        </p>
      </div>

      <button
        type="submit"
        disabled={!code.trim() || pending}
        className="bg-gradient-cta flex h-14 w-full items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5),_0_4px_12px_rgba(126,196,196,0.18)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Bringing them in…" : "Save to my contacts"}
      </button>
      {/* Say what's happening, in the same words mobile uses (Wilson
          2026-08-21). "Opening the door" was pretty and told nobody
          anything; a person who just paid to open a dead relative's
          archive should not have to guess. */}
      {pending ? (
        <p className="mt-3 text-center text-[13px] leading-relaxed text-warm-400">
          Copying their archive into your account. This takes a few
          seconds &mdash; stay on this page.
        </p>
      ) : null}
    </form>
  );
}
