#!/usr/bin/env node
/**
 * One-shot ops script (Wilson 2026-08-25): regenerate Adrian's portrait
 * as Pedro's 23-year-old son.
 *
 * Pipeline: upload ~/Downloads/pedro.webp to a temp public path →
 * FLUX Kontext Pro (identity-preserving image+prompt model, the same
 * one in-chat persona photos use) transforms it into a 23-year-old
 * Ecuadorian-Filipino comms-grad in the app's candid phone-camera
 * aesthetic → bytes land at avatars/concierge/adrian.png (same URL
 * shape as always, cache-busted) → oracle row updated with
 * face_generation_status='manual' so the auto-regen path never
 * clobbers it → temp reference deleted.
 *
 * Run from the repo root: node scripts/adrian-from-pedro.mjs
 */

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: ".env.local" });

const SOURCE = "/Users/TENZEROTHREEFIVE/Downloads/pedro.webp";
const BUCKET = "avatars";
const TEMP_PATH = "concierge/pedro-ref-temp.webp";
const FINAL_PATH = "concierge/adrian.png";

const PROMPT =
  "Transform this man into his 23-year-old son: same family resemblance, same warm eyes and smile, but young — a fresh college graduate of Ecuadorian and Filipino heritage. Short natural dark hair, clean or very light stubble, wearing a casual crewneck or soft t-shirt. Candid iMessage-style portrait, sitting in a bright softly-lit modern startup workspace with a plant and warm wood, natural window light on his face. Shot on a phone camera, not a studio portrait. Approachable, energetic, quietly confident. Photorealistic, soft depth of field, 1:1 headshot framing.";

async function main() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const replicateToken = process.env.REPLICATE_API_TOKEN;
  if (!url || !secret) throw new Error("Supabase env missing (.env.local)");
  if (!replicateToken) throw new Error("REPLICATE_API_TOKEN missing");

  const admin = createClient(url, secret);

  // 1. Upload the reference so Replicate can fetch it.
  const source = await readFile(SOURCE);
  const up = await admin.storage.from(BUCKET).upload(TEMP_PATH, source, {
    contentType: "image/webp",
    upsert: true,
  });
  if (up.error) throw new Error(`temp upload: ${up.error.message}`);
  const refUrl = admin.storage.from(BUCKET).getPublicUrl(TEMP_PATH).data
    .publicUrl;
  console.log("reference uploaded:", refUrl);

  // 2. FLUX Kontext Pro — identity-preserving transform.
  const res = await fetch(
    "https://api.replicate.com/v1/models/black-forest-labs/flux-kontext-pro/predictions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${replicateToken}`,
        "Content-Type": "application/json",
        Prefer: "wait=60",
      },
      body: JSON.stringify({
        input: {
          prompt: PROMPT,
          input_image: refUrl,
          aspect_ratio: "1:1",
          output_format: "png",
          safety_tolerance: 1,
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`replicate ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const prediction = await res.json();
  let outputUrl = Array.isArray(prediction.output)
    ? prediction.output[0]
    : prediction.output;
  // Poll if Prefer: wait returned before completion.
  let tries = 0;
  while (!outputUrl && prediction.urls?.get && tries < 30) {
    await new Promise((r) => setTimeout(r, 3000));
    const poll = await fetch(prediction.urls.get, {
      headers: { Authorization: `Bearer ${replicateToken}` },
    });
    const body = await poll.json();
    if (body.status === "failed" || body.status === "canceled") {
      throw new Error(`prediction ${body.status}: ${body.error ?? ""}`);
    }
    outputUrl = Array.isArray(body.output) ? body.output[0] : body.output;
    tries++;
  }
  if (!outputUrl) throw new Error("no output from Replicate");
  console.log("generated:", outputUrl);

  // 3. Download + persist at the canonical path.
  const img = await fetch(outputUrl);
  if (!img.ok) throw new Error(`download ${img.status}`);
  const bytes = Buffer.from(await img.arrayBuffer());
  const save = await admin.storage.from(BUCKET).upload(FINAL_PATH, bytes, {
    contentType: "image/png",
    upsert: true,
  });
  if (save.error) throw new Error(`save: ${save.error.message}`);

  const publicUrl = `${
    admin.storage.from(BUCKET).getPublicUrl(FINAL_PATH).data.publicUrl
  }?v=${Date.now()}`;
  const avatarHash = createHash("sha256").update(bytes).digest("hex");

  const { error: rowErr } = await admin
    .from("oracles")
    .update({
      avatar_url: publicUrl,
      avatar_hash: avatarHash,
      face_generation_status: "manual",
      face_generation_error: null,
    })
    .eq("is_concierge", true);
  if (rowErr) throw new Error(`oracle update: ${rowErr.message}`);

  // 4. Clean the temp reference — Pedro's actual photo shouldn't sit
  // in a public bucket longer than the generation needs it.
  await admin.storage.from(BUCKET).remove([TEMP_PATH]);

  console.log("Adrian updated:", publicUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
