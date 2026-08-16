"use client";

import { useState } from "react";

/**
 * Guided YYYY-MM-DD entry (Wilson 2026-08-15, mobile parity): digits
 * only, the dashes type themselves when the year/month complete, and
 * the rest of the template stays visible as ghost text ahead of the
 * cursor. The ghost renders the typed prefix transparently in the same
 * font so the remaining template sits exactly where the next character
 * will land. Submits through the surrounding server-action form via
 * the hidden-free controlled input (name attribute preserved).
 */
export function GuidedDobInput() {
  const [dob, setDob] = useState("");

  return (
    <div className="relative">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center px-4 text-base"
      >
        <span className="whitespace-pre text-transparent">{dob}</span>
        <span className="whitespace-pre text-warm-400">
          {"YYYY-MM-DD".slice(dob.length)}
        </span>
      </div>
      <input
        type="text"
        name="date_of_birth"
        inputMode="numeric"
        autoComplete="bday"
        required
        pattern="\d{4}-\d{2}-\d{2}"
        value={dob}
        onChange={(e) => {
          const raw = e.target.value;
          const digits = raw.replace(/\D/g, "").slice(0, 8);
          let shaped = digits;
          if (digits.length > 6)
            shaped = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
          else if (digits.length > 4)
            shaped = `${digits.slice(0, 4)}-${digits.slice(4)}`;
          // Materialize the next dash as soon as a segment completes —
          // but only while typing forward, or backspace could never
          // cross a dash.
          const typingForward = raw.length > dob.length;
          if (typingForward && (digits.length === 4 || digits.length === 6)) {
            shaped = `${shaped}-`;
          }
          setDob(shaped);
        }}
        className="relative h-12 w-full rounded-2xl bg-transparent px-4 text-base text-warm-50 outline-none ring-1 ring-warm-700 focus:ring-2 focus:ring-coral"
      />
      <div className="absolute inset-0 -z-10 rounded-2xl bg-ink-soft" />
    </div>
  );
}
