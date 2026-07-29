#!/usr/bin/env node
/**
 * One-shot ops script: replace Adrian's avatar with a hand-picked file
 * on disk instead of the Replicate-generated one from
 * src/lib/faces/adrian.ts.
 *
 * Wilson's ask 2026-07-29: put ~/Desktop/Adrian.png in place of the
 * Flux-generated portrait. Same storage path (`avatars/concierge/
 * adrian.png`) so the CDN URL shape doesn't change; oracle row's
 * avatar_url gets a cache-busted query so clients pick up the new
 * bytes on next fetch.
 *
 * Run from the repo root:
 *   node scripts/set-adrian-avatar.mjs [path/to/file.png]
 *
 * Defaults to /Users/TENZEROTHREEFIVE/Desktop/Adrian.png. Safe to
 * re-run -- upsert + hash update is idempotent per input file.
 */

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });

const DEFAULT_PATH = "/Users/TENZEROTHREEFIVE/Desktop/Adrian.png";
const STORAGE_BUCKET = "avatars";
const STORAGE_PATH = "concierge/adrian.png";

async function main() {
  const filePath = process.argv[2] ?? DEFAULT_PATH;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
    );
    process.exit(1);
  }
  const admin = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Reading ${filePath}...`);
  const bytes = await readFile(filePath);
  const contentType = filePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : filePath.toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  console.log(`  ${bytes.byteLength.toLocaleString()} bytes, ${contentType}`);

  console.log("Locating concierge oracle...");
  const { data: concierge, error: lookupErr } = await admin
    .from("oracles")
    .select("id, name, avatar_url")
    .eq("is_concierge", true)
    .maybeSingle();
  if (lookupErr) {
    console.error("concierge lookup failed:", lookupErr);
    process.exit(1);
  }
  if (!concierge) {
    console.error("concierge oracle not found (is_concierge=true)");
    process.exit(1);
  }
  console.log(`  found ${concierge.name} (${concierge.id})`);
  console.log(`  current avatar_url: ${concierge.avatar_url ?? "(none)"}`);

  console.log(`Uploading to ${STORAGE_BUCKET}/${STORAGE_PATH}...`);
  const { error: uploadErr } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(STORAGE_PATH, bytes, {
      contentType,
      upsert: true,
    });
  if (uploadErr) {
    console.error("upload failed:", uploadErr);
    process.exit(1);
  }

  // avatar_hash uniqueness (0058): compute + collision-suffix if needed.
  let avatarHash = createHash("sha256").update(bytes).digest("hex");
  const { data: clash } = await admin
    .from("oracles")
    .select("id")
    .eq("avatar_hash", avatarHash)
    .neq("id", concierge.id)
    .limit(1)
    .maybeSingle();
  if (clash) {
    avatarHash = `${avatarHash}-concierge`;
    console.log("  hash collision; suffixed with -concierge");
  }

  const { data: pub } = admin.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(STORAGE_PATH);
  const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

  console.log("Updating oracle row...");
  const { error: updateErr } = await admin
    .from("oracles")
    .update({
      avatar_url: publicUrl,
      avatar_hash: avatarHash,
      // 'manual' status guards against ensureAdrianAvatar overwriting
      // this hand-picked image, even when called with force=true
      // (see src/lib/faces/adrian.ts). The admin regen route hits
      // ensureAdrianAvatar with force but not overrideManual, so a
      // stray admin click can no longer clobber the upload.
      face_generation_status: "manual",
      face_generation_error: null,
    })
    .eq("id", concierge.id);
  if (updateErr) {
    console.error("oracle update failed:", updateErr);
    process.exit(1);
  }

  console.log("");
  console.log("Done.");
  console.log(`  new avatar_url: ${publicUrl}`);
  console.log(`  avatar_hash:    ${avatarHash}`);
  console.log("");
  console.log(
    "Clients will pick up the new bytes on next fetch (cache-buster in URL).",
  );
}

main().catch((err) => {
  console.error("script failed:", err);
  process.exit(1);
});
