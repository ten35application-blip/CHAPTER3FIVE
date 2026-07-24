"use client";

import { useState, useTransition } from "react";
import { formatInheritCodeInput } from "@/lib/legacy/code-format";
import { redeemInheritCode } from "./actions";

export function InheritForm() {
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!code.trim() || pending) return;
    startTransition(async () => {
      // Redirects on success; bounces back with ?error= otherwise.
      await redeemInheritCode(code);
    });
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
          placeholder="chapter-4291-heart-elm"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          className="h-16 w-full rounded-2xl bg-ink-soft px-5 text-center font-mono text-xl font-semibold tracking-tight text-warm-50 shadow-[0_10px_28px_-12px_rgba(28,28,26,0.14)] ring-1 ring-warm-700 outline-none transition-shadow placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:text-warm-500 focus:ring-2 focus:ring-coral/50"
        />
      </label>

      <button
        type="submit"
        disabled={!code.trim() || pending}
        className="bg-gradient-cta flex h-14 w-full items-center justify-center rounded-full text-lg font-semibold text-white shadow-[0_14px_36px_-10px_rgba(217,115,89,0.5),_0_4px_12px_rgba(126,196,196,0.18)] transition-all hover:-translate-y-px active:translate-y-0 active:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Opening the door…" : "Redeem"}
      </button>
    </form>
  );
}
