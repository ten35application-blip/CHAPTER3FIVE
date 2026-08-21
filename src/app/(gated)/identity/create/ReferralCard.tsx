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
 *
 * Copy is assembled with template strings rather than JSX text nodes
 * split across lines: the version that did the latter rendered
 * "When 5of them" in production, because JSX collapses the whitespace
 * around an expression at a line break.
 */
export function ReferralCard() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [howOpen, setHowOpen] = useState(false);
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

  // Auto-dismiss the confirmation.
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!status?.code) return null;

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://chapter3five.app";
  const link = `${origin}/join/${status.code}`;
  const remaining = Math.max(0, status.goal - status.qualified);

  async function share() {
    // Native share sheet where it exists (phones) — it's the actual
    // way a link gets sent to a person. Clipboard is the desktop
    // fallback, and either way the confirmation is visible.
    const shareText = `I've been using chapter3five — someone to talk to, and a way to keep the people you love. Here's my link:`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "chapter3five", text: shareText, url: link });
        return;
      }
    } catch {
      return; // they closed the sheet — not an error
    }
    try {
      await navigator.clipboard.writeText(link);
      setToast("Link copied — send it to someone.");
    } catch {
      setError("Couldn't copy. Select the link above and copy it manually.");
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
        {/* The brand mark: two people, connected. Same shape as the
            logo, which is what this feature literally is. */}
        <span
          aria-hidden
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-teal/12"
        >
          <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
            <path
              d="M11 16h10"
              stroke="currentColor"
              className="text-warm-400"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="9" cy="16" r="5" className="fill-coral" />
            <circle cx="23" cy="16" r="5" className="fill-teal" />
          </svg>
        </span>
        <div className="flex-1">
          <h2 className="text-[17px] font-bold tracking-tight text-warm-50">
            Earn one
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-warm-300">
            {`Know someone who could use this? Share your link. When ${status.goal} of them find their way in, we'll write someone for you — yours to talk to on any plan.`}
          </p>
        </div>
      </div>

      {/* Counter. A number, never a list. */}
      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-warm-100">
            {`${status.qualified} of ${status.goal} settled in`}
          </span>
          {status.pending > 0 ? (
            <span className="text-xs text-warm-400">
              {`${status.pending} on the way`}
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
        <>
          <div className="mt-4 flex items-center gap-2">
            <code className="flex-1 truncate rounded-xl bg-ink px-3 py-2.5 text-[13px] text-warm-200 ring-1 ring-warm-700">
              {link}
            </code>
            <button
              type="button"
              onClick={share}
              className="h-10 flex-shrink-0 rounded-full bg-teal/15 px-4 text-sm font-semibold text-teal-strong ring-1 ring-teal/30 transition-colors hover:bg-teal/25"
            >
              Share
            </button>
          </div>

          {/* What actually counts — stated plainly, because a counter
              that moves on rules nobody explained reads as broken. */}
          <button
            type="button"
            onClick={() => setHowOpen((v) => !v)}
            aria-expanded={howOpen}
            className="mt-3 flex w-full items-center justify-between text-left text-xs font-semibold text-warm-400 transition-colors hover:text-warm-200"
          >
            <span>How this works</span>
            <span aria-hidden className={howOpen ? "rotate-180" : ""}>
              ⌄
            </span>
          </button>
          {howOpen ? (
            <div className="mt-2 rounded-xl bg-ink p-4 ring-1 ring-warm-700/70">
              <ol className="flex flex-col gap-2 text-xs leading-relaxed text-warm-300">
                <li>
                  <span className="font-semibold text-warm-100">1.</span>{" "}
                  {`They open your link and create their own account.`}
                </li>
                <li>
                  <span className="font-semibold text-warm-100">2.</span>{" "}
                  {`They confirm their email and say hello to Adrian — a few messages, a real conversation.`}
                </li>
                <li>
                  <span className="font-semibold text-warm-100">3.</span>{" "}
                  {`That's when they count. The number above moves on its own; we never tell you who they are.`}
                </li>
                <li>
                  <span className="font-semibold text-warm-100">4.</span>{" "}
                  {`At ${status.goal}, a button appears here and we write someone for you. Then the count starts over.`}
                </li>
              </ol>
            </div>
          ) : null}
        </>
      )}

      {status.earned > 0 ? (
        <p className="mt-3 text-xs text-warm-400">
          {`You've earned ${status.earned} ${status.earned === 1 ? "companion" : "companions"} this way.`}
        </p>
      ) : null}

      {!status.canRedeem && remaining > 0 && status.qualified > 0 ? (
        <p className="mt-3 text-xs text-warm-400">
          {`${remaining} more and we'll write someone for you.`}
        </p>
      ) : null}

      {/* Confirmation toast — a copy that vanishes silently reads as a
          button that didn't work. */}
      {toast ? (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-8 z-50 flex justify-center px-6"
        >
          <span className="rounded-full bg-ink-soft px-5 py-3 text-sm font-semibold text-warm-50 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)] ring-1 ring-warm-700">
            {toast}
          </span>
        </div>
      ) : null}
    </section>
  );
}
