"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign in with your face, no password (2026-09-08). One passkey per
 * device: iCloud Keychain / Google Password Manager carries it to the
 * next phone. This is the credential; the Face ID LOCK in Settings is a
 * different thing (it guards an already signed-in app).
 */
type Passkey = { id: string; friendly_name?: string | null; created_at: string; last_used_at?: string | null };

export default function PasskeysCard() {
  const [supported, setSupported] = useState(false);
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data, error } = await supabase.auth.passkey.list();
    if (error) {
      setKeys([]);
      if (error.message.toLowerCase().includes("disabled")) setNote("Passkeys aren't turned on for this app yet.");
      return;
    }
    setKeys((data ?? []) as Passkey[]);
  }

  useEffect(() => {
    setSupported(typeof window !== "undefined" && typeof window.PublicKeyCredential === "function" && window.isSecureContext);
    void load();
  }, []);

  async function add() {
    setBusy(true);
    setNote(null);
    const supabase = createClient();
    const { error } = await supabase.auth.registerPasskey();
    setBusy(false);
    if (error) {
      const m = error.message.toLowerCase();
      if (m.includes("exists")) setNote("This device already has a passkey for your account.");
      else if (m.includes("disabled")) setNote("Passkeys aren't turned on for this app yet.");
      else if (!(m.includes("abort") || m.includes("cancel") || m.includes("not allowed"))) setNote("That didn't save. Try again.");
      return;
    }
    setNote("Saved. Next time, sign in with your face.");
    void load();
  }

  async function remove(id: string) {
    setBusy(true);
    const supabase = createClient();
    await supabase.auth.passkey.delete({ passkeyId: id });
    setBusy(false);
    void load();
  }

  if (!supported) return null;
  return (
    <section className="rounded-2xl bg-ink-soft p-4 ring-1 ring-warm-700">
      <p className="text-[15px] font-medium text-warm-50">Sign in with your face</p>
      <p className="mt-1 text-xs leading-relaxed text-warm-400">
        Add a passkey and this device signs you in with Face ID, Touch ID, or your fingerprint. No password to remember. It follows you to a new phone through your keychain.
      </p>
      {keys && keys.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink px-3 py-2 text-sm text-warm-100 ring-1 ring-warm-700">
              <span>
                {k.friendly_name || "Passkey"}
                <span className="ml-2 text-xs text-warm-400">added {new Date(k.created_at).toLocaleDateString()}</span>
              </span>
              <button type="button" disabled={busy} onClick={() => void remove(k.id)} className="text-xs font-semibold text-warm-400 underline underline-offset-2 hover:text-coral disabled:opacity-50">
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {note ? <p className="mt-2 text-xs font-medium text-teal-strong">{note}</p> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void add()}
        className="mt-3 flex h-10 items-center justify-center rounded-full border-[1.5px] border-teal-strong px-5 text-sm font-bold text-teal-strong transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {busy ? "Working…" : keys && keys.length > 0 ? "Add this device too" : "Add a passkey to this device"}
      </button>
    </section>
  );
}
