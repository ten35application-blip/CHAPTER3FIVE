import { Resend } from "resend";

/**
 * Lazy Resend client.
 *
 * The Resend constructor throws if `RESEND_API_KEY` is missing. With
 * Next.js 16 + Turbopack, page-data collection imports server modules
 * eagerly during build — so a missing/transient env var anywhere in
 * the deploy environment crashes the entire build, not just email
 * sending. Lazy-init keeps the build green; the throw only happens at
 * actual send time, where it's caught by our notifications.ts wrapper
 * and logged to email_log as a failed send.
 */

let cached: Resend | null = null;

function getResend(): Resend {
  if (cached) return cached;
  cached = new Resend(process.env.RESEND_API_KEY);
  return cached;
}

// Proxy that forwards every property/method access to the lazy instance.
// Existing call sites can keep doing `resend.emails.send(...)` unchanged.
export const resend = new Proxy({} as Resend, {
  get(_target, prop) {
    const real = getResend() as unknown as Record<string | symbol, unknown>;
    return real[prop];
  },
});
