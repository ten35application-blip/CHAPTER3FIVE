"use client";

import { useState } from "react";
import { ALLOWED_DOCS, type AllowedDoc } from "@/lib/legal/acceptance";
import { acceptTerms } from "./actions";

/**
 * Web mirror of the mobile /agreements screen — one explicit
 * checkbox per document, all required, matching copy so a user
 * moving between phone and web sees the same acknowledgments in
 * the same order.
 *
 * Field naming: each checkbox posts as `agree_<doc>=on` when
 * checked (native <input type=checkbox name=…>). The server
 * action reads them by name against ALLOWED_DOCS (shared with
 * the acceptance helper), so this UI list and the server-side
 * whitelist can never drift silently.
 */

type Disclosure = {
  key: AllowedDoc;
  title: string;
  body: string;
  href?: string;
};

const DISCLOSURES: readonly Disclosure[] = [
  {
    key: "terms",
    title: "Terms of Service",
    body: "How you use chapter3five — your account, content, refunds, dispute resolution, and platform-specific provisions for App Store and Play.",
    href: "/terms",
  },
  {
    key: "privacy",
    title: "Privacy Policy",
    body: "What we collect, who processes it, and how to delete it.",
    href: "/privacy",
  },
  {
    key: "ai_processing",
    title: "AI processing — Anthropic + OpenAI",
    body: "Your messages, photos, memories, and profile anchors go to Anthropic and OpenAI to power chat, image moderation, and persona realism. Default no retention, no training on your data.",
    href: "/privacy",
  },
  {
    key: "cookies",
    title: "Cookie Policy",
    body: "Cookies and equivalent device storage for sign-in, preferences, and light analytics. No ad cookies, no third-party trackers.",
    href: "/privacy#cookies",
  },
  {
    key: "eula",
    title: "End User License Agreement (EULA)",
    body: "Apple's standard app-store EULA applies to the iOS app; Play Store terms apply on Android. Web use is governed by the Terms of Service above.",
    href: "/eula",
  },
  {
    key: "guidelines",
    title: "Community Guidelines",
    body: "Warm-hearted use only. No harm to real people, no impersonation without consent, no minors, no illegal content.",
    href: "/guidelines",
  },
  {
    key: "age_18plus",
    title: "I am 18 or older",
    body: "chapter3five is adults-only.",
  },
  {
    key: "not_therapy",
    title: "This is not therapy or crisis support",
    body: "Not medical or therapeutic care. If you're in crisis: US 988 (call/text), UK Samaritans 116 123, Mexico SAPTEL +52 55 5259-8121.",
  },
] as const;

export function AcceptForm() {
  const initial = Object.fromEntries(
    ALLOWED_DOCS.map((d) => [d, false]),
  ) as Record<AllowedDoc, boolean>;
  const [checked, setChecked] = useState<Record<AllowedDoc, boolean>>(initial);

  const allChecked = ALLOWED_DOCS.every((d) => checked[d]);

  return (
    <form action={acceptTerms} className="mt-8 flex w-full flex-col gap-3">
      {DISCLOSURES.map((d) => (
        <label
          key={d.key}
          className="flex cursor-pointer items-start gap-3 rounded-2xl bg-ink-soft px-4 py-4 text-left ring-1 ring-warm-700 transition-all hover:ring-coral/40"
        >
          <input
            type="checkbox"
            name={`agree_${d.key}`}
            checked={checked[d.key]}
            onChange={(e) =>
              setChecked((prev) => ({ ...prev, [d.key]: e.target.checked }))
            }
            className="mt-1 h-5 w-5 shrink-0 accent-coral"
          />
          <span className="flex flex-col gap-1">
            <span className="text-sm font-bold text-warm-50">{d.title}</span>
            <span className="text-sm leading-relaxed text-warm-200">
              {d.body}
              {d.href ? (
                <>
                  {" "}
                  <a
                    href={d.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-coral-strong hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Read full
                  </a>
                </>
              ) : null}
            </span>
          </span>
        </label>
      ))}

      <button
        type="submit"
        disabled={!allChecked}
        className="bg-gradient-cta hover:bg-gradient-cta-hover mt-3 flex h-14 w-full items-center justify-center rounded-full text-lg font-bold tracking-tight text-white shadow-[0_16px_40px_-10px_rgba(232,138,118,0.5),_0_6px_16px_-6px_rgba(126,196,196,0.4)] transition-all hover:-translate-y-px hover:shadow-[0_20px_46px_-10px_rgba(232,138,118,0.55),_0_8px_20px_-6px_rgba(126,196,196,0.45)] active:translate-y-0 active:opacity-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:translate-y-0"
      >
        I agree &mdash; let me in
      </button>

      <p className="mt-2 text-center text-xs text-warm-400">
        We save these acknowledgments tagged with the version of this page.
      </p>
    </form>
  );
}
