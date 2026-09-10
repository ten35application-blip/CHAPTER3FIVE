"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * "Have a code?" — Settings, right under Plan (Wilson 2026-09-10).
 * A plan code puts this account on Pro for a month, a year, or for good.
 * Mirrors the phone's PlanCodeRow in app/settings.tsx exactly.
 */
export function PlanCodeRow() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function redeem() {
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/plan-code/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string };
      if (res.ok && body.ok) {
        setNote({ ok: true, text: body.message ?? "Pro is on this account now." });
        setCode("");
        router.refresh();
      } else {
        setNote({ ok: false, text: body.error ?? "That code didn't open anything." });
      }
    } catch {
      setNote({ ok: false, text: "Couldn't reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 py-4">
      <p className="text-sm text-warm-300">
        A code from us puts this account on Pro. Enter it here.
      </p>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void redeem();
        }}
      >
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (note) setNote(null);
          }}
          placeholder="Your code"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          className="h-11 min-w-0 flex-1 rounded-xl bg-ink px-3 text-[15px] uppercase tracking-wide text-warm-50 ring-1 ring-warm-700 placeholder:normal-case placeholder:tracking-normal placeholder:text-warm-500 focus:outline-none focus:ring-2 focus:ring-coral"
        />
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="bg-gradient-cta flex h-11 items-center justify-center rounded-full px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? "Checking…" : "Redeem"}
        </button>
      </form>
      {note ? (
        <p className={`mt-2 text-sm font-semibold ${note.ok ? "text-teal-strong" : "text-coral-strong"}`}>
          {note.text}
        </p>
      ) : null}
    </div>
  );
}
