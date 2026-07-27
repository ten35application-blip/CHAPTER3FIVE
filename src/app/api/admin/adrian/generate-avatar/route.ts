import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin/allowlist";
import { generateImage, stableSeed } from "@/lib/replicate";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * ONE-TIME admin utility: generate + persist Adrian's avatar.
 *
 * Adrian (the concierge, oracles.is_concierge = true) is a hand-crafted
 * system object -- he doesn't come from the trait-driven synthesize
 * path that owns the standard face-generation flow (which only runs
 * for randomize/memory mode identities and refuses is_concierge). This
 * route bypasses that path by calling Flux directly with a hard-coded
 * prompt shaped for Adrian's bio (see migration 0101).
 *
 * Idempotent-ish: safe to POST multiple times. Each hit overwrites the
 * existing avatar (upsert = true), so a re-run gives Adrian a fresh
 * face -- useful for iterating on the prompt.
 *
 * Admin-only (allowlist check). If REPLICATE_API_TOKEN isn't set,
 * generateImage returns null and we surface a 500 with a clear reason.
 */
const ADRIAN_PROMPT =
  "Candid iMessage-style portrait of a handsome man in his mid-20s, warm easy smile, wearing a soft heather-grey t-shirt or casual crewneck. Short natural dark hair, thoughtful hazel eyes, light stubble. Sitting in a bright softly-lit modern workspace -- small tech startup vibe with a plant, warm wood, a laptop just out of frame. Natural window light on his face. Shot on a phone camera, not a studio portrait, not an illustration. Approachable, real, quietly confident. Neutral background, soft depth of field. Photorealistic.";

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Look up the concierge by is_concierge flag -- ID lives in the DB,
  // not in code, so we don't hard-code the UUID here.
  const { data: concierge, error: lookupErr } = await admin
    .from("oracles")
    .select("id")
    .eq("is_concierge", true)
    .maybeSingle<{ id: string }>();
  if (lookupErr || !concierge) {
    return NextResponse.json(
      { error: "Concierge oracle not found (0096 seed missing?)" },
      { status: 404 },
    );
  }

  const seed = stableSeed(`adrian::${concierge.id}`);
  const generatedUrl = await generateImage({
    prompt: ADRIAN_PROMPT,
    aspectRatio: "1:1",
    seed,
    safetyTolerance: 1,
  });
  if (!generatedUrl) {
    return NextResponse.json(
      {
        error:
          "Replicate returned no output. Check REPLICATE_API_TOKEN is set in Vercel.",
      },
      { status: 500 },
    );
  }

  // Download from Replicate (their URL expires ~24h) and persist to
  // our own storage so the avatar survives independently.
  const imgRes = await fetch(generatedUrl);
  if (!imgRes.ok) {
    return NextResponse.json(
      { error: `Could not fetch generated image (${imgRes.status})` },
      { status: 500 },
    );
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());

  // Hash for the 0058 partial unique index; suffix if collision.
  let avatarHash = createHash("sha256").update(buf).digest("hex");
  const { data: clash } = await admin
    .from("oracles")
    .select("id")
    .eq("avatar_hash", avatarHash)
    .neq("id", concierge.id)
    .limit(1)
    .maybeSingle();
  if (clash) avatarHash = `${avatarHash}-concierge`;

  // Fixed path so a re-run overwrites in place. upsert:true handles
  // repeats. contentType matches generateImage's webp output.
  const storagePath = `concierge/adrian.webp`;
  const { error: uploadErr } = await admin.storage
    .from("avatars")
    .upload(storagePath, buf, { contentType: "image/webp", upsert: true });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }
  const { data: pub } = admin.storage.from("avatars").getPublicUrl(storagePath);
  // Cache-buster so a re-run isn't masked by the CDN serving the old
  // object under the same path.
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
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
