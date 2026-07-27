/**
 * Adrian avatar generation -- shared helper called by BOTH the manual
 * admin trigger route AND the lazy trigger in the dashboard's after()
 * hook. Wilson's ask was "why do I have to run a command to see the
 * image" -- the answer is now: you don't. First dashboard load after
 * a fresh deploy (or a nulled avatar_url) fires this in the
 * background; the second load has the image.
 *
 * Adrian is a hand-crafted system oracle (oracles.is_concierge=true)
 * and doesn't come from the trait-driven face pipeline (which insists
 * on randomize/memory mode and rejects is_concierge). This helper
 * calls Replicate + FLUX 1.1 Pro directly with a hard-coded portrait
 * prompt, using the SAME SDK + model + timeouts as the battle-tested
 * generateAndSaveFace pipeline in src/lib/faces/generate.ts -- the
 * only difference is the prompt (hard-coded, not trait-derived) and
 * the storage path (concierge/adrian.webp, fixed).
 *
 * Idempotent: if avatar_url is already set, returns immediately unless
 * opts.force is passed. Concurrent callers race benignly -- one wins
 * the write, the loser's second SELECT returns the winner's URL.
 * Fire-and-forget safe: NEVER throws; every failure returns
 * { ok: false, error }.
 */

import { createHash } from "node:crypto";
import Replicate, { type FileOutput } from "replicate";
import { createAdminClient } from "@/lib/supabase/admin";

const FACE_MODEL = "black-forest-labs/flux-1.1-pro" as const;

/** Hard cap on the whole Flux round-trip. Same as generateAndSaveFace. */
const GENERATION_TIMEOUT_MS = 90_000;

const ADRIAN_PROMPT =
  "Candid iMessage-style portrait of a handsome man in his mid-20s, warm easy smile, wearing a soft heather-grey t-shirt or casual crewneck. Short natural dark hair, thoughtful hazel eyes, light stubble. Sitting in a bright softly-lit modern workspace -- small tech startup vibe with a plant, warm wood, a laptop just out of frame. Natural window light on his face. Shot on a phone camera, not a studio portrait, not an illustration. Approachable, real, quietly confident. Neutral background, soft depth of field. Photorealistic.";

export type AdrianAvatarResult =
  | { ok: true; url: string; alreadySet?: boolean }
  | { ok: false; error: string };

export async function ensureAdrianAvatar(opts?: {
  force?: boolean;
}): Promise<AdrianAvatarResult> {
  try {
    const admin = createAdminClient();

    const { data: concierge, error: lookupErr } = await admin
      .from("oracles")
      .select("id, avatar_url")
      .eq("is_concierge", true)
      .maybeSingle<{ id: string; avatar_url: string | null }>();
    if (lookupErr) {
      return { ok: false, error: `concierge lookup: ${lookupErr.message}` };
    }
    if (!concierge) {
      return { ok: false, error: "concierge oracle not found" };
    }
    if (concierge.avatar_url && !opts?.force) {
      return { ok: true, url: concierge.avatar_url, alreadySet: true };
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      return { ok: false, error: "REPLICATE_API_TOKEN not set" };
    }

    // Same Replicate SDK + model + PNG output + timeout as
    // generateAndSaveFace so we inherit its proven behavior across the
    // 9+ personas that have already generated cleanly. Seed derived
    // from the concierge id so a forced re-run is reproducible barring
    // Flux model drift.
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
    const seed = seedFromId(concierge.id);
    const bytes = await runFluxPortrait(replicate, ADRIAN_PROMPT, seed);
    if (!bytes) {
      return { ok: false, error: "Replicate returned no output" };
    }

    // 0058 avatar_hash uniqueness -- extremely unlikely to collide for
    // a bespoke hand-crafted portrait, but suffix on collision so the
    // partial unique index doesn't block the write.
    let avatarHash = createHash("sha256").update(bytes).digest("hex");
    const { data: clash } = await admin
      .from("oracles")
      .select("id")
      .eq("avatar_hash", avatarHash)
      .neq("id", concierge.id)
      .limit(1)
      .maybeSingle();
    if (clash) avatarHash = `${avatarHash}-concierge`;

    const storagePath = "concierge/adrian.png";
    const { error: uploadErr } = await admin.storage
      .from("avatars")
      .upload(storagePath, bytes, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadErr) {
      return { ok: false, error: `upload: ${uploadErr.message}` };
    }
    const { data: pub } = admin.storage
      .from("avatars")
      .getPublicUrl(storagePath);
    // Cache-buster so a forced re-run isn't masked by the CDN serving
    // the old bytes.
    const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

    const { error: updateErr } = await admin
      .from("oracles")
      .update({
        avatar_url: publicUrl,
        avatar_hash: avatarHash,
        face_generation_status: "succeeded",
        face_generation_error: null,
      })
      .eq("id", concierge.id);
    if (updateErr) {
      return { ok: false, error: `oracle update: ${updateErr.message}` };
    }

    return { ok: true, url: publicUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[adrian] generation failed:", err);
    return { ok: false, error: message };
  }
}

/**
 * FLUX 1.1 Pro run → PNG bytes. Copied from generateAndSaveFace so
 * the two paths run identically. Handles the three shapes Replicate's
 * SDK returns (FileOutput stream, URL string, array).
 */
async function runFluxPortrait(
  replicate: Replicate,
  prompt: string,
  seed: number,
): Promise<Buffer | null> {
  const output = await replicate.run(FACE_MODEL, {
    input: {
      prompt,
      aspect_ratio: "1:1",
      seed,
      output_format: "png",
      output_quality: 100,
      safety_tolerance: 1,
      prompt_upsampling: false,
    },
    wait: { mode: "block", timeout: 60 },
    signal: AbortSignal.timeout(GENERATION_TIMEOUT_MS),
  });

  const first = Array.isArray(output) ? output[0] : output;
  if (!first) return null;
  if (typeof (first as FileOutput).blob === "function") {
    const blob = await (first as FileOutput).blob();
    return Buffer.from(await blob.arrayBuffer());
  }
  const res = await fetch(String(first), {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Stable positive-31-bit seed from a UUID (same djb2-xor shape as
 *  src/lib/replicate.ts stableSeed) so a forced re-run is reproducible. */
function seedFromId(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h) ^ input.charCodeAt(i);
  }
  return Math.abs(h) % 2147483647;
}
