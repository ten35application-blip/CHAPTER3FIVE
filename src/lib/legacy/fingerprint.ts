import { createHash } from "node:crypto";
import type { LegacySubject } from "./synthesize";

/**
 * SHA-256 fingerprint of a legacy identity's source material — the subject
 * metadata plus every answer. Same canonicalization rules as
 * src/lib/identity/fingerprint.ts (keys sorted at every level, no
 * whitespace) so identical answer sets always hash identically and collide
 * on the oracles.fingerprint unique index rather than silently duplicating.
 */
export function fingerprintLegacyAnswers(
  subject: LegacySubject,
  answers: Record<string, string>,
): string {
  return createHash("sha256")
    .update(canonicalize({ answers, subject }))
    .digest("hex");
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
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`);
  return `{${parts.join(",")}}`;
}
