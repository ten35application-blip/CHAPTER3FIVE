import Anthropic from "@anthropic-ai/sdk";

/**
 * Lazy Anthropic client.
 *
 * Same reasoning as src/lib/resend.ts — the Anthropic SDK constructor
 * throws when ANTHROPIC_API_KEY is missing, which crashes the Next.js
 * build during page-data collection if the env var is ever absent.
 * Lazy-init keeps build green; the throw only happens at actual API
 * call time, which is wrapped with try/catch + Sentry capture +
 * in-character fallback in /api/chat.
 */

let cached: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (cached) return cached;
  cached = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return cached;
}

export const anthropic = new Proxy({} as Anthropic, {
  get(_target, prop) {
    const real = getAnthropic() as unknown as Record<string | symbol, unknown>;
    return real[prop];
  },
});

export const ANTHROPIC_MODEL = "claude-sonnet-4-6";
