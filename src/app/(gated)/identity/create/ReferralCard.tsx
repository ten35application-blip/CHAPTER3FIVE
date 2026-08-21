"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = {
  code: string | null;
  qualified: number;
  goal: number;
  pending: number;
  canRedeem: boolean;
  earned: number;
};

/**
 * "Four ways to make one, one way to earn one." (Wilson 2026-08-21.)
 *
 * Share a link; when five people verify, accept the terms, and
 * actually talk to someone, we write a companion for you. The counter
 * is a NUMBER and never a list — who signed up for a grief app is not
 * the referrer's business, even when they're the reason.
 */
export function ReferralCard() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/referral/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setStatus(d as Status);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status?.code) return null;
  const link = `${typeof window !== "undefined" ? window.location.origin : "https://chapter3five.app"}/join/${status.code}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select the link and copy it manually.");
    }
  }

  async function redeem() {
    setRedeeming(true);
    setError(null);
    try {
      const res = await fetch("/api/referral/redeem", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        oracle_id?: string;
        error?: string;
      };
      if (res.ok && body.oracle_id) {
        router.push(`/chat/${body.oracle_id}`);
        return;
      }
      setError(body.error ?? "Couldn't do that just now. Try again.");
    } catch {
      setError("Couldn't do that just now. Try again.");
    } finally {
      setRedeeming(false);
    }
  }

  const pct = Math.min(100, (status.qualified / status.goal) * 100);

  return (
    <section className="mt-4 rounded-[22px] bg-ink-soft p-5 ring-1 ring-warm-700/70">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-teal/12 text-teal-strong"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z" />
            <path d="M3 20a7 7 0 0 1 14 0" />
            <path d="M19 8v6M22 11h-6" />
          </svg>
        </span>
        <div className="flex-1">
          <h2 className="text-[17px] font-bold tracking-tight text-warm-50">
            Earn one
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-warm-300">
            Know someone who could use this? Share your link. When{" "}
            {status.goal} of them find their way in, we&rsquo;ll write
            someone for you &mdash; yours to talk to on any plan.
          </p>
        </div>
      </div>

      {/* Counter. A number, never a list. */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-warm-100">
            {status.qualified} of {status.goal} settled in
          </span>
          {status.pending > 0 ? (
            <span className="text-xs text-warm-400">
              {status.pending} on the way
            </span>
          ) : null}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-warm-700">
          <div
            className="bg-gradient-cta h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-coral/10 px-3 py-2 text-xs font-medium text-coral-strong"
        >
          {error}
        </p>
      ) : null}

      {status.canRedeem ? (
        <button
          type="button"
          onClick={redeem}
          disabled={redeeming}
          className="bg-gradient-cta mt-4 flex h-12 w-full items-center justify-center rounded-full text-base font-semibold text-white transition-all hover:-translate-y-px disabled:opacity-60"
        >
          {redeeming ? "Writing them…" : "Meet the one you earned"}
        </button>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 truncate rounded-xl bg-ink px-3 py-2.5 text-[13px] text-warm-200 ring-1 ring-warm-700">
            {link}
          </code>
          <button
            type="button"
            onClick={copy}
            className="h-10 flex-shrink-0 rounded-full bg-teal/15 px-4 text-sm font-semibold text-teal-strong ring-1 ring-teal/30 transition-colors hover:bg-teal/25"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {status.earned > 0 ? (
        <p className="mt-3 text-xs text-warm-400">
          You&rsquo;ve earned {status.earned}{" "}
          {status.earned === 1 ? "companion" : "companions"} this way.
        </p>
      ) : null}
    </section>
  );
}
