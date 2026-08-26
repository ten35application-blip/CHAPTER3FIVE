"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * THE GIFT MOMENT — web twin of the mobile dashboard's GiftMoment
 * (Wilson 2026-08-26: "we have to make them aware that they got it
 * and they can press okay and they will get it"). Checks /api/gifts
 * on dashboard mount; when the admins have given something, this
 * branded overlay names the gift and the Okay is what claims it.
 * Multiple gifts show one after another.
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

export function GiftMoment() {
  const [gift, setGift] = useState<{ id: string; kind: string } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [doneText, setDoneText] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch("/api/gifts");
      if (!res.ok) return;
      const body = (await res.json()) as {
        gifts?: { id: string; kind: string }[];
      };
      if (body.gifts && body.gifts.length > 0) setGift(body.gifts[0]);
    } catch {
      /* quiet — re-checks next visit */
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const label = gift ? (LABELS[gift.kind] ?? null) : null;
  if (!gift || !label) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
      <div className="w-full max-w-sm rounded-3xl bg-ink-soft px-7 py-8 text-center ring-1 ring-warm-700">
        <p className="text-5xl">🎁</p>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-warm-50">
          {label.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-warm-300">
          {doneText ?? label.body}
        </p>
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
