"use client";

import { useEffect, useState } from "react";

/**
 * Settings → Notifications: one combined row, same copy as mobile
 * (Wilson 2026-08-06: "Push Notifications / New messages, mentions,
 * and activity from your identities" — and once decided, the switch
 * lives at the platform level, not in our UI).
 *
 * Browser reality: Notification.permission has three states.
 *   "default" → we can still ask; the row's button runs the same
 *     request-permission + service-worker subscribe flow the
 *     dashboard's PushOptIn banner proved out.
 *   "granted" / "denied" → the browser owns the switch from here;
 *     no site can flip it, so the row shows the truth and points at
 *     the browser's site settings. That's the exact behavior Wilson
 *     described — "once approved, you can't edit in settings since
 *     it's notifications for the app in general."
 *
 * Uses NEXT_PUBLIC_VAPID_PUBLIC_KEY directly — the same public key the
 * dashboard passes into PushOptIn; public by design, safe in a client
 * bundle.
 */
export function PushPermissionRow() {
  const [state, setState] = useState<
    "default" | "granted" | "denied" | "unsupported" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let status: PermissionStatus | null = null;
    (async () => {
      if (
        typeof Notification === "undefined" ||
        !("serviceWorker" in navigator)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (!cancelled) setState(Notification.permission);
      try {
        // Live wire: if they flip the switch in the browser's site
        // settings while this page is open, the row updates itself.
        status = await navigator.permissions.query({
          name: "notifications" as PermissionName,
        });
        status.onchange = () => {
          if (!cancelled) setState(Notification.permission);
        };
      } catch {
        /* Safari doesn't expose this query — the mount read stands. */
      }
    })();
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      setState(permission);
      if (permission !== "granted") return;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      if (!vapidPublicKey) return;
      const reg =
        (await navigator.serviceWorker.getRegistration("/sw.js")) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const keyBytes = urlBase64ToUint8Array(vapidPublicKey);
      const keyBuffer = new ArrayBuffer(keyBytes.byteLength);
      new Uint8Array(keyBuffer).set(keyBytes);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBuffer,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    } catch {
      setError("Couldn't finish turning notifications on — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className="flex w-6 flex-shrink-0 items-center justify-center text-warm-300"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-warm-50">
          Push Notifications
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-warm-400">
          New messages, mentions, and activity from your identities.
        </p>
        {error ? (
          <p className="mt-1 text-xs text-coral-strong">{error}</p>
        ) : null}
      </div>
      {state === "default" ? (
        <button
          type="button"
          onClick={() => void enable()}
          disabled={busy}
          className="rounded-full bg-coral px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-coral-strong disabled:opacity-50"
        >
          {busy ? "…" : "Turn on"}
        </button>
      ) : (
        <span
          className={`text-[13px] font-bold ${
            state === "granted" ? "text-teal-strong" : "text-warm-400"
          }`}
          title={
            state === "granted" || state === "denied"
              ? "Managed in your browser's site settings"
              : undefined
          }
        >
          {state === "granted"
            ? "On"
            : state === "denied"
              ? "Off"
              : state === "unsupported"
                ? "Unavailable"
                : "…"}
        </span>
      )}
    </div>
  );
}

// Standard VAPID base64url → Uint8Array conversion (same as PushOptIn).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
