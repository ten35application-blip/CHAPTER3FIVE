import { createHash } from "node:crypto";
import type { Traits } from "./formula";

/**
 * Canonical serialization + SHA-256 fingerprint of a trait bundle.
 *
 * The uniqueness rule Wilson wrote: "Every identity gets a UUID seed +
 * SHA-256 fingerprint of all traits. Fingerprints are stored with a
 * unique database constraint — no two identities can ever match."
 *
 * "Canonical" here means: object keys sorted lexicographically at every
 * level, arrays serialized in their original order (MBTI order is
 * meaningful — [INTJ, INFP] ≠ [INFP, INTJ] as a persona), no whitespace.
 * This guarantees the same trait bundle always produces the same hex.
 */
export function fingerprintTraits(traits: Traits): string {
  return createHash("sha256").update(canonicalize(traits)).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`,
  );
  return `{${parts.join(",")}}`;
}
