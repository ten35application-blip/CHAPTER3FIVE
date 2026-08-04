"use client";

import { useFormStatus } from "react-dom";

/**
 * Signup submit button with a busy label — mobile parity 2026-08-03
 * ("Creating…" while the server action runs, "Create account" idle).
 * Split into its own client file so the page shell can stay a server
 * component and lean on the existing signup server action. Empty-field
 * guarding is handled by the browser `required` attribute on inputs,
 * so this button only needs to know whether the action is in flight.
 */
export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-gradient-cta hover:bg-gradient-cta-hover mt-4 flex h-14 w-full items-center justify-center rounded-full text-lg font-bold tracking-tight text-white shadow-[0_16px_40px_-10px_rgba(232,138,118,0.5),_0_6px_16px_-6px_rgba(126,196,196,0.4)] transition-all hover:-translate-y-px hover:shadow-[0_20px_46px_-10px_rgba(232,138,118,0.55),_0_8px_20px_-6px_rgba(126,196,196,0.45)] active:translate-y-0 active:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Creating…" : "Create account"}
    </button>
  );
}
