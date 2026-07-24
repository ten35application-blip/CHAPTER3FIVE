"use client";

import { useState } from "react";
import { acceptTerms } from "./actions";

/**
 * The one interactive moment on /onboarding: a single checkbox and a
 * submit that stays disabled until it's checked. Client component only
 * because of the checked-state; the actual write happens in the
 * acceptTerms server action.
 */
export function AcceptForm() {
  const [agreed, setAgreed] = useState(false);

  return (
    <form action={acceptTerms} className="mt-8 flex w-full flex-col gap-5">
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-ink-soft px-4 py-4 text-left ring-1 ring-warm-700">
        <input
          type="checkbox"
          name="agree"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-coral"
        />
        <span className="text-sm leading-relaxed text-warm-100">
          I&apos;ve read and agree to the Terms, Privacy Policy, and
          Community Guidelines.
        </span>
      </label>

      <button
        type="submit"
        disabled={!agreed}
        className="bg-gradient-cta hover:bg-gradient-cta-hover flex h-14 w-full items-center justify-center rounded-full text-lg font-bold tracking-tight text-white shadow-[0_16px_40px_-10px_rgba(232,138,118,0.5),_0_6px_16px_-6px_rgba(126,196,196,0.4)] transition-all hover:-translate-y-px hover:shadow-[0_20px_46px_-10px_rgba(232,138,118,0.55),_0_8px_20px_-6px_rgba(126,196,196,0.45)] active:translate-y-0 active:opacity-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
      >
        I agree &mdash; take me in
      </button>
    </form>
  );
}
