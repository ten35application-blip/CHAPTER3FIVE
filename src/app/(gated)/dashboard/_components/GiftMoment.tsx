"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * THE GIFT MOMENT — web twin of the mobile dashboard's GiftMoment
 * (Wilson 2026-08-26: "we have to make them aware that they got it
 * and they can press okay and they will get it"). Checks /api/gifts
 * on dashboard mount; when the admins have given something, this
 * branded overlay names the gift and the Okay is what claims it.
 * Multiple gifts show one after another.
 *
 * SIGNUP PROMOS (Wilson 2026-09-01): a gift that arrived from a
 * running campaign gets its own copy and, once claimed, the share
 * link and the instructions for earning another — in the same moment,
 * not on some other screen. "Instructions right there WITH THE LINK."
 */

const LABELS: Record<string, { title: string; body: string; done: string }> = {
  pro_month: {
    title: "A free month of Pro",
    body: "The chapter3five team has given you 30 days of Pro — more companions, more room to talk.",
    done: "It's yours — Pro is on right now.",
  },
  companion: {
    title: "A free companion",
    body: "The chapter3five team has given you someone new — a companion of your own, yours to keep.",
    done: "They're being born — check your contacts in about a minute.",
  },
  message_pack: {
    title: "A free message pack",
    body: "The chapter3five team has given you +100 messages.",
    done: "Added — 100 more messages are on your account.",
  },
  image_pack: {
    title: "A free photo pack",
    body: "The chapter3five team has given you +12 photo sends.",
    done: "Added — 12 more photos are on your account.",
  },
  inherit_credit: {
    title: "A free inherit unlock",
    body: "The chapter3five team has given you one free inherit-code redemption.",
    done: "It's yours — redeem any code without the fee.",
  },
};

/** Promo arrivals get a welcome, not a "the team has given you". */
const PROMO_LABELS: Record<string, { title: string; body: string; done: string }> = {
  companion: {
    title: "Welcome — here's a companion, on us",
    body: "Thanks for signing up. We're giving you a companion of your own, free, and they're yours to keep.",
    done: "They're being born — check your contacts in about a minute.",
  },
};

type Gift = { id: string; kind: string; promo_id?: string | null };

export function GiftMoment() {
  const [gift, setGift] = useState<Gift | null>(null);
  const [referral, setReferral] = useState<{
    code: string | null;
    goal: number;
  } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [doneText, setDoneText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/gifts");
      if (!res.ok) return;
      const body = (await res.json()) as {
        gifts?: Gift[];
        referral?: { code: string | null; goal: number } | null;
      };
      if (body.gifts && body.gifts.length > 0) setGift(body.gifts[0]);
      if (body.referral) setReferral(body.referral);
    } catch {
      /* quiet — re-checks next visit */
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const isPromo = Boolean(gift?.promo_id);
  const label = gift
    ? (isPromo ? PROMO_LABELS[gift.kind] : null) ?? LABELS[gift.kind] ?? null
    : null;
  if (!gift || !label) return null;

  const shareLink =
    referral?.code && typeof window !== "undefined"
      ? `${window.location.origin}/join/${referral.code}`
      : null;
  const goal = referral?.goal ?? 5;

  async function claim() {
    if (!gift || claiming) return;
    setClaiming(true);
    try {
      const res = await fetch("/api/gifts/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gift_id: gift.id }),
      });
      if (res.ok) {
        setDoneText(label?.done ?? "It's yours.");
      } else {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setDoneText(
          body.error ??
            "Something hiccuped — it'll be waiting next time you're here.",
        );
      }
    } catch {
      setDoneText("Something hiccuped — it'll be waiting next time you're here.");
    } finally {
      setClaiming(false);
    }
  }

  // The share block only appears AFTER they've claimed, so the gift
  // lands on its own before anything is asked of them.
  const showShare = isPromo && doneText !== null && shareLink !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-ink-soft px-7 py-8 text-center ring-1 ring-warm-700">
        <p className="text-5xl">🎁</p>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-warm-50">
          {label.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-warm-300">
          {doneText ?? label.body}
        </p>

        {showShare ? (
          <div className="mt-5 rounded-2xl bg-ink px-4 py-4 text-left ring-1 ring-warm-700">
            <p className="text-sm font-bold text-teal-strong">
              Want another one?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-warm-300">
              Share your link below. When {goal} people sign up through it and
              start talking, you earn another companion — free, no payment
              needed.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg bg-ink-soft px-3 py-2 text-xs text-warm-100 ring-1 ring-warm-700">
                {shareLink}
              </code>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink!);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    /* clipboard blocked — the link is visible to select */
                  }
                }}
                className="shrink-0 rounded-lg bg-teal/15 px-3 py-2 text-xs font-bold text-teal-strong ring-1 ring-teal/30 transition-colors hover:bg-teal/25"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-warm-400">
              In a hurry? Basic and Pro come with companions of their own —{" "}
              <a
                href="/upgrade"
                className="font-semibold text-coral-strong hover:text-coral"
              >
                see the plans
              </a>
              .
            </p>
          </div>
        ) : null}

        <button
          type="button"
          disabled={claiming}
          onClick={() => {
            if (doneText) {
              setDoneText(null);
              setGift(null);
              void check();
            } else {
              void claim();
            }
          }}
          className="bg-gradient-cta mt-6 h-12 w-full rounded-full text-base font-bold text-white transition-all hover:-translate-y-px active:opacity-90 disabled:opacity-60"
        >
          {claiming ? "Opening…" : doneText ? "Done" : "Okay"}
        </button>
      </div>
    </div>
  );
}
