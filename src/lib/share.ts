import { randomBytes } from "node:crypto";

/**
 * Generate a 12-character share code, formatted as XXXX-XXXX-XXXX.
 * Uses a confusion-safe alphabet (no I, O, 0, 1).
 * Cryptographically random — uses node:crypto under the hood.
 */
export function generateShareCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let raw = "";
  for (let i = 0; i < 12; i++) {
    raw += alphabet[bytes[i] % alphabet.length];
  }
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function normalizeShareCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function formatShareCode(input: string): string {
  const n = normalizeShareCode(input);
  if (n.length !== 12) return input;
  return `${n.slice(0, 4)}-${n.slice(4, 8)}-${n.slice(8, 12)}`;
}
