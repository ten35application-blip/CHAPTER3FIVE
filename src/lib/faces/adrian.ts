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
 * calls Replicate + Flux directly with a hard-coded portrait prompt.
 *
 * Idempotent: if avatar_url is already set, returns it immediately
 * unless opts.force is passed. Concurrent callers race benignly --
 * one wins the write, the loser's second SELECT returns the winner's
 * URL. Fire-and-forget safe: NEVER throws; every failure returns
 * { ok: false, error }.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateImage, stableSeed } from "@/lib/replicate";

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

    const seed = stableSeed(`adrian::${concierge.id}`);
    const generatedUrl = await generateImage({
      prompt: ADRIAN_PROMPT,
      aspectRatio: "1:1",
      seed,
      safetyTolerance: 1,
    });
    if (!generatedUrl) {
      return {
        ok: false,
        error:
          "Replicate returned no output. REPLICATE_API_TOKEN missing or the model refused.",
      };
    }

    const imgRes = await fetch(generatedUrl);
    if (!imgRes.ok) {
      return {
        ok: false,
        error: `download failed (${imgRes.status})`,
      };
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());

    // 0058 avatar_hash uniqueness -- extremely unlikely to collide for
    // a bespoke hand-crafted portrait, but suffix on collision so the
    // partial unique index doesn't block the write.
    let avatarHash = createHash("sha256").update(buf).digest("hex");
    const { data: clash } = await admin
      .from("oracles")
      .select("id")
      .eq("avatar_hash", avatarHash)
      .neq("id", concierge.id)
      .limit(1)
      .maybeSingle();
    if (clash) avatarHash = `${avatarHash}-concierge`;

    const storagePath = "concierge/adrian.webp";
    const { error: uploadErr } = await admin.storage
      .from("avatars")
      .upload(storagePath, buf, {
        contentType: "image/webp",
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
    return {
      ok: false,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}
