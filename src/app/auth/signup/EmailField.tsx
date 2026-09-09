"use client";

import { useEffect, useRef, useState } from "react";
import { suggestEmailFix } from "@/lib/auth/emailTypo";

/**
 * The email box on signup, with a typo net. On submit, if the address
 * looks like a slip (icloud.con, gmial.com, va.gvo…), the form stops
 * once and asks "Did you mean…?" — one tap fixes it, one tap keeps it.
 * Wilson 2026-09-09: "I accidentally spelled .com wrong and it still
 * made it and didn't say hey this seems wrong."
 */
export function EmailField() {
  const ref = useRef<HTMLInputElement>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const acknowledged = useRef<string | null>(null);

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const onSubmit = (e: Event) => {
      const value = ref.current?.value ?? "";
      const fix = suggestEmailFix(value);
      if (fix && acknowledged.current !== value.trim().toLowerCase()) {
        e.preventDefault();
        setSuggestion(fix);
      }
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, []);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-warm-200">Email</span>
      <input
        ref={ref}
        type="email"
        name="email"
        autoComplete="email"
        required
        onChange={() => { if (suggestion) setSuggestion(null); }}
        className="h-12 rounded-2xl bg-ink-soft px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 placeholder:text-warm-400 focus:ring-2 focus:ring-coral"
        placeholder="you@example.com"
      />
      {suggestion ? (
        <div role="alert" className="mt-1 rounded-2xl border-[1.5px] border-coral bg-ink-soft p-3">
          <p className="text-sm font-semibold text-warm-50">Did you mean {suggestion}?</p>
          <p className="mt-1 text-xs text-warm-300">The confirmation link goes to this address. If it&rsquo;s wrong, it never arrives.</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (ref.current) ref.current.value = suggestion;
                acknowledged.current = suggestion;
                setSuggestion(null);
              }}
              className="bg-gradient-cta flex h-9 items-center justify-center rounded-full px-4 text-sm font-bold text-white"
            >
              Use {suggestion}
            </button>
            <button
              type="button"
              onClick={() => {
                acknowledged.current = (ref.current?.value ?? "").trim().toLowerCase();
                setSuggestion(null);
              }}
              className="flex h-9 items-center justify-center rounded-full px-3 text-sm font-semibold text-teal-strong hover:opacity-80"
            >
              Keep what I typed
            </button>
          </div>
        </div>
      ) : null}
    </label>
  );
}
