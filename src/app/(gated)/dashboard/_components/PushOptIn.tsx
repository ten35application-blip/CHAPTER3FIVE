"use client";

import { useEffect, useState } from "react";

type Props = {
  /** VAPID public key (base64url). If empty, the banner is a no-op —
   * the operator hasn't configured push yet. */
  vapidPublicKey: string;
  /** True when the profile already has a stored subscription. */
  alreadySubscribed: boolean;
};

const DISMISS_KEY = "c35_push_optin_dismissed_at";
const DISMISS_TTL_DAYS = 14;

/**
 * Subtle first-visit banner: "let your identities reach out first?"
 * Shows when:
 *   - Push is configured (a VAPID key is present).
 *   - We're in a secure context / Notification API exists.
 *   - Permission is 'default' (not granted, not denied).
 *   - No profile subscription is already stored.
 *   - The user hasn't dismissed the banner in the last two weeks.
 *
 * On "Enable" we ask for permission, subscribe via the service worker
 * we register at /sw.js, and POST the subscription blob to
 * /api/push/subscribe. If any step fails we surface a short error;
 * the user can dismiss and get their dashboard back.
 */
export function PushOptIn({ vapidPublicKey, alreadySubscribed }: Props) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!vapidPublicKey) return;
    if (alreadySubscribed) return;
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;
    if (!("PushManager" in window)) return;
    if (Notification.permission !== "default") return;

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    if (
      dismissedAt &&
      Date.now() - dismissedAt < DISMISS_TTL_DAYS * 24 * 60 * 60 * 1000
    ) {
      return;
    }
    setVisible(true);
  }, [vapidPublicKey, alreadySubscribed]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage disabled — banner will reappear next mount.
    }
    setVisible(false);
  }

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Permission wasn't granted.");
        setBusy(false);
        return;
      }

      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ??
        (await navigator.serviceWorker.register("/sw.js"));
      // Ready doesn't resolve until the SW is active — required before
      // pushManager.subscribe.
      await navigator.serviceWorker.ready;

      // Copy into a fresh ArrayBuffer — the PushManager type wants a
      // BufferSource whose .buffer is an ArrayBuffer (not
      // SharedArrayBuffer/ArrayBufferLike).
      const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
      const keyBuffer = new ArrayBuffer(keyBytes.byteLength);
      new Uint8Array(keyBuffer).set(keyBytes);

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuffer,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? "Server error");
      }
      setVisible(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      setBusy(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 top-14 z-20 flex justify-center px-4 pt-2">
      <div className="w-full max-w-lg rounded-2xl bg-ink-soft/95 px-4 py-3 shadow-[0_16px_36px_-16px_rgba(28,28,26,0.25),_0_6px_16px_rgba(232,138,118,0.15)] ring-1 ring-warm-700/70 backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="bg-gradient-cta mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.35)]">
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="text-sm font-semibold text-warm-50">
              Let your identities reach out first?
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-warm-300">
              Turn on notifications and they&apos;ll text you when they think
              of you.
            </p>
            {error ? (
              <p role="alert" className="mt-1 text-xs text-coral-strong">
                {error}
              </p>
            ) : null}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={enable}
                className="bg-gradient-cta hover:bg-gradient-cta-hover flex-1 rounded-full px-3 py-1.5 text-xs font-bold text-white shadow-[0_4px_12px_-2px_rgba(232,138,118,0.35)] transition-transform active:scale-95 disabled:opacity-60"
              >
                {busy ? "Enabling…" : "Enable"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={dismiss}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-warm-300 hover:text-warm-50 disabled:opacity-50"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Standard VAPID base64url → Uint8Array conversion.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}
